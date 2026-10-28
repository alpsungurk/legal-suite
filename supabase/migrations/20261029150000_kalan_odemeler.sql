-- =====================================================================================
-- Çöp kutusu: tutar / döküm + "kalan ödemeler"
--   (20261029130000_cop_kutusu.sql uygulandıktan SONRA çalışır; o dosya değiştirilmez)
--   - trash.amounts / trash.items: silinen kayıtların tutar toplamları ve tek tek dökümü
--   - public.payment_ledger ("Kalan ödemeler"): silinen kayıtlarda bize ödenmiş para (ücret tahsilatı,
--     icra tahsilatı, masraf iadesi) kalıcı bir deftere yazılır. Kasa / banka bakiyesine dahildir,
--     30 günde silinmez; satırları yetkili kullanıcı tek tek silebilir. Kayıt geri yüklenirse
--     defterdeki karşılığı kalkar (çift sayım olmaz).
--   - trash_preview: neyin birlikte gideceğini tutarlarıyla ve saklanacak ödemeyle gösterir
-- Tekrar çalıştırılabilir.
-- =====================================================================================

alter table public.trash add column if not exists amounts jsonb not null default '{}'::jsonb;
alter table public.trash add column if not exists items jsonb not null default '[]'::jsonb;

create table if not exists public.payment_ledger (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null default app.current_org_id() references public.organizations (id) on delete cascade,
  date        date not null,
  amount      numeric(14, 2) not null check (amount > 0),
  method      text,
  account_id  uuid,
  client_name text not null default '',
  source      text not null default '',
  kind        text not null,
  trash_id    uuid references public.trash (id) on delete set null,
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid(),
  unique (org_id, id),
  foreign key (org_id, account_id) references public.accounts (org_id, id)
);
create index if not exists payment_ledger_org_idx on public.payment_ledger (org_id, date desc);
create index if not exists payment_ledger_trash_idx on public.payment_ledger (trash_id);

alter table public.payment_ledger enable row level security;
drop policy if exists payment_ledger_select on public.payment_ledger;
drop policy if exists payment_ledger_delete on public.payment_ledger;
-- Satırları yalnızca çöp kutusu RPC'leri (security definer) ekler; kullanıcı görür ve siler
create policy payment_ledger_select on public.payment_ledger for select to authenticated
  using (org_id = app.current_org_id() and app.can('accounts', 'view'));
create policy payment_ledger_delete on public.payment_ledger for delete to authenticated
  using (org_id = app.current_org_id() and app.can('accounts', 'delete'));
revoke all on public.payment_ledger from anon;
grant select, delete on public.payment_ledger to authenticated;

-- Hesap bakiyesi: kalan ödemeler de girer (son tanım 20261029120000_masraf_iadesi.sql)
create or replace view public.v_account_balances
with (security_invoker = true) as
  select
    a.id, a.org_id, a.name, a.type, a.active, a.opening_balance,
    round(
      a.opening_balance
      + coalesce((select sum(p.amount) from public.installment_payments p where p.org_id = a.org_id and p.account_id = a.id), 0)
      + coalesce((select sum(c.amount) from public.collections c where c.org_id = a.org_id and c.account_id = a.id), 0)
      + coalesce((select sum(t.amount) from public.account_transactions t where t.org_id = a.org_id and t.account_id = a.id), 0)
      - coalesce((select sum(e.amount) from public.expenses e where e.org_id = a.org_id and e.account_id = a.id and e.paid_by = 'Büro'), 0)
      + coalesce((select sum(e.amount) from public.expenses e
                  where e.org_id = a.org_id and e.reimbursed_account_id = a.id and e.reimbursed_on is not null
                    and e.charge_to = 'Müvekkil' and e.paid_by = 'Büro'), 0)
      + coalesce((select sum(l.amount) from public.payment_ledger l where l.org_id = a.org_id and l.account_id = a.id), 0)
    , 2) as balance
  from public.accounts a
  where a.org_id = app.current_org_id() and app.can('accounts', 'view');
grant select on public.v_account_balances to authenticated;

create or replace function app.trash_collect(p_org uuid, p_entity text, p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_cli uuid[] := '{}'; v_case uuid[] := '{}'; v_enf uuid[] := '{}'; v_deb uuid[] := '{}';
  v_exp uuid[] := '{}'; v_plan uuid[] := '{}'; v_rem uuid[] := '{}'; v_doc uuid[] := '{}';
  v_tx uuid[] := '{}'; v_sg uuid[] := '{}'; v_prom uuid[] := '{}'; v_inst uuid[] := '{}';
  v_rows jsonb := '[]'::jsonb; v_rel jsonb := '[]'::jsonb; v_counts jsonb := '{}'::jsonb;
  v_items jsonb := '[]'::jsonb; v_money jsonb := '{}'::jsonb; v_keep jsonb := '[]'::jsonb;
  v_att jsonb; n int;
begin
  case p_entity
    when 'clients' then v_cli := array[p_id];
    when 'cases' then v_case := array[p_id];
    when 'enforcements' then v_enf := array[p_id];
    when 'debtors' then v_deb := array[p_id];
    when 'expenses' then v_exp := array[p_id];
    when 'fee_plans' then v_plan := array[p_id];
    when 'reminders' then v_rem := array[p_id];
    when 'documents' then v_doc := array[p_id];
    when 'account_transactions' then v_tx := array[p_id];
    when 'salary_garnishments' then v_sg := array[p_id];
    else raise exception 'Bu kayıt türü çöp kutusuna atılamaz: %', p_entity using errcode = '22023';
  end case;

  -- Müvekkil: bütün dosyaları, icraları ve ona yazılan her şey
  if cardinality(v_cli) > 0 then
    v_case := v_case || array(select id from public.cases where org_id = p_org and client_id = any(v_cli));
    v_enf  := v_enf  || array(select id from public.enforcements where org_id = p_org and client_id = any(v_cli));
    v_exp  := v_exp  || array(select id from public.expenses where org_id = p_org and client_id = any(v_cli));
    v_plan := v_plan || array(select id from public.fee_plans where org_id = p_org and client_id = any(v_cli));
    v_rem  := v_rem  || array(select id from public.reminders where org_id = p_org and client_id = any(v_cli));
    v_doc  := v_doc  || array(select id from public.documents where org_id = p_org and client_id = any(v_cli));
    v_tx   := v_tx   || array(select id from public.account_transactions where org_id = p_org and client_id = any(v_cli));
    v_sg   := v_sg   || array(select id from public.salary_garnishments where org_id = p_org and client_id = any(v_cli));
  end if;
  -- Dava dosyası: masrafları, planları, ajandası, belgeleri (icra yalnızca bağı kopar)
  if cardinality(v_case) > 0 then
    v_exp  := v_exp  || array(select id from public.expenses where org_id = p_org and case_id = any(v_case));
    v_plan := v_plan || array(select id from public.fee_plans where org_id = p_org and case_id = any(v_case));
    v_rem  := v_rem  || array(select id from public.reminders where org_id = p_org and case_id = any(v_case));
    v_doc  := v_doc  || array(select id from public.documents where org_id = p_org and case_id = any(v_case));
  end if;
  -- İcra dosyası: ajandası ve belgeleri (masraf yalnızca bağı kopar)
  if cardinality(v_enf) > 0 then
    v_rem := v_rem || array(select id from public.reminders where org_id = p_org and enforcement_id = any(v_enf));
    v_doc := v_doc || array(select id from public.documents where org_id = p_org and enforcement_id = any(v_enf));
  end if;
  -- Virman: iki bacak birlikte
  if cardinality(v_tx) > 0 then
    v_tx := v_tx || array(select t.id from public.account_transactions t
                          where t.org_id = p_org and t.transfer_id is not null
                            and t.transfer_id in (select transfer_id from public.account_transactions where id = any(v_tx)));
  end if;

  v_case := array(select distinct unnest(v_case)); v_enf := array(select distinct unnest(v_enf));
  v_exp  := array(select distinct unnest(v_exp));  v_plan := array(select distinct unnest(v_plan));
  v_rem  := array(select distinct unnest(v_rem));  v_doc := array(select distinct unnest(v_doc));
  v_tx   := array(select distinct unnest(v_tx));   v_sg := array(select distinct unnest(v_sg));
  v_prom := array(select id from public.payment_promises where org_id = p_org
                  and (enforcement_id = any(v_enf) or debtor_id = any(v_deb)));
  v_inst := array(select id from public.installments where org_id = p_org and plan_id = any(v_plan));

  -- Satırlar: ebeveynden çocuğa (geri yükleme bu sırayla ekler, silme tersinden)
  with src(ord, t, r) as (
              select 1,  'clients', to_jsonb(x) from public.clients x where x.org_id = p_org and x.id = any(v_cli)
    union all select 2,  'cases', to_jsonb(x) from public.cases x where x.org_id = p_org and x.id = any(v_case)
    union all select 3,  'debtors', to_jsonb(x) from public.debtors x where x.org_id = p_org and x.id = any(v_deb)
    union all select 4,  'enforcements', to_jsonb(x) from public.enforcements x where x.org_id = p_org and x.id = any(v_enf)
    union all select 5,  'enforcement_debtors', to_jsonb(x) from public.enforcement_debtors x
                where x.org_id = p_org and (x.enforcement_id = any(v_enf) or x.debtor_id = any(v_deb))
    union all select 6,  'payment_promises', to_jsonb(x) from public.payment_promises x where x.org_id = p_org and x.id = any(v_prom)
    union all select 7,  'collections', to_jsonb(x) from public.collections x
                where x.org_id = p_org and (x.enforcement_id = any(v_enf) or x.debtor_id = any(v_deb))
    union all select 8,  'contact_logs', to_jsonb(x) from public.contact_logs x
                where x.org_id = p_org and (x.enforcement_id = any(v_enf) or x.debtor_id = any(v_deb))
    union all select 9,  'enforcement_events', to_jsonb(x) from public.enforcement_events x
                where x.org_id = p_org and x.enforcement_id = any(v_enf)
    union all select 10, 'seizure_notices', to_jsonb(x) from public.seizure_notices x
                where x.org_id = p_org and x.enforcement_id = any(v_enf)
    union all select 11, 'expenses', to_jsonb(x) from public.expenses x where x.org_id = p_org and x.id = any(v_exp)
    union all select 12, 'fee_plans', to_jsonb(x) from public.fee_plans x where x.org_id = p_org and x.id = any(v_plan)
    union all select 13, 'installments', to_jsonb(x) from public.installments x where x.org_id = p_org and x.id = any(v_inst)
    union all select 14, 'installment_payments', to_jsonb(x) from public.installment_payments x
                where x.org_id = p_org and x.installment_id = any(v_inst)
    union all select 15, 'reminders', to_jsonb(x) from public.reminders x where x.org_id = p_org and x.id = any(v_rem)
    union all select 16, 'documents', to_jsonb(x) from public.documents x where x.org_id = p_org and x.id = any(v_doc)
    union all select 17, 'account_transactions', to_jsonb(x) from public.account_transactions x
                where x.org_id = p_org and x.id = any(v_tx)
    union all select 18, 'salary_garnishments', to_jsonb(x) from public.salary_garnishments x
                where x.org_id = p_org and x.id = any(v_sg)
    union all select 19, 'salary_garnishment_entries', to_jsonb(x) from public.salary_garnishment_entries x
                where x.org_id = p_org and x.queue_id = any(v_sg)
  )
  select coalesce(jsonb_agg(jsonb_build_object('t', t, 'r', r) order by ord), '[]'::jsonb),
         coalesce((select jsonb_object_agg(t, c) from (select t, count(*) c from src group by t) g), '{}'::jsonb)
    into v_rows, v_counts
  from src;

  -- Tek tek döküm (para taşıyanlar önce) ve tablo bazında tutar toplamı: silmeden önce gösterilir,
  -- çöp kutusunda saklanır
  select coalesce(jsonb_agg(q.item), '[]'::jsonb) into v_items from (
    select jsonb_build_object(
             't', x.e ->> 't',
             'label', left(coalesce(x.e -> 'r' ->> 'name', x.e -> 'r' ->> 'title', x.e -> 'r' ->> 'no',
                                    x.e -> 'r' ->> 'employee_name', x.e -> 'r' ->> 'description', ''), 120),
             'amount', coalesce(x.e -> 'r' ->> 'amount', x.e -> 'r' ->> 'total'),
             'date', coalesce(x.e -> 'r' ->> 'date', x.e -> 'r' ->> 'due_date')
           ) as item
    from jsonb_array_elements(v_rows) with ordinality as x(e, o)
    where x.e ->> 't' in ('clients', 'cases', 'debtors', 'enforcements', 'payment_promises', 'collections',
                          'expenses', 'fee_plans', 'installment_payments', 'reminders', 'documents',
                          'account_transactions', 'salary_garnishments')
    order by (x.e ->> 't' in ('collections', 'installment_payments', 'expenses', 'fee_plans',
                              'account_transactions', 'payment_promises')) desc, x.o
    limit 200
  ) q;
  select coalesce(jsonb_object_agg(g.t, g.s), '{}'::jsonb) into v_money from (
    select e ->> 't' as t,
           round(sum(abs((coalesce(e -> 'r' ->> 'amount', e -> 'r' ->> 'total'))::numeric)), 2) as s
    from jsonb_array_elements(v_rows) e
    where e ->> 't' in ('collections', 'installment_payments', 'expenses', 'fee_plans',
                        'account_transactions', 'payment_promises')
    group by 1
  ) g;

  -- Bize ödenmiş para: kayıtla birlikte yok olmasın, "kalan ödemeler" defterine yazılır (kasa bakiyesi bozulmaz).
  -- Para çıkışları (masraf, kasa hareketi) tutulmaz. Müvekkile aktarılmış icra tahsilatı da tutulmaz: o para
  -- zaten hesaptan çıkmıştır.
  select coalesce(jsonb_agg(q.k), '[]'::jsonb) into v_keep from (
    select jsonb_build_object('kind', 'Ücret tahsilatı', 'amount', p.amount, 'date', p.date, 'method', p.method,
                              'account_id', p.account_id, 'client_id', fp.client_id) as k
    from public.installment_payments p
    join public.installments i on i.id = p.installment_id and i.org_id = p.org_id
    join public.fee_plans fp on fp.id = i.plan_id and fp.org_id = i.org_id
    where p.org_id = p_org and p.installment_id = any(v_inst)
    union all
    select jsonb_build_object('kind', 'İcra tahsilatı', 'amount', co.amount, 'date', co.date, 'method', co.method,
                              'account_id', co.account_id, 'client_id', en.client_id)
    from public.collections co
    join public.enforcements en on en.id = co.enforcement_id and en.org_id = co.org_id
    where co.org_id = p_org and co.account_id is not null and not co.transferred_to_client
      and coalesce(co.enforcement_id = any(v_enf) or co.debtor_id = any(v_deb), false)
    union all
    select jsonb_build_object('kind', 'Masraf iadesi', 'amount', e.amount, 'date', e.reimbursed_on, 'method', null,
                              'account_id', e.reimbursed_account_id, 'client_id', coalesce(e.client_id, cs.client_id))
    from public.expenses e
    left join public.cases cs on cs.id = e.case_id and cs.org_id = e.org_id
    where e.org_id = p_org and e.id = any(v_exp) and e.reimbursed_on is not null
      and e.reimbursed_account_id is not null and e.charge_to = 'Müvekkil' and e.paid_by = 'Büro'
  ) q;

  -- Silmede boşaltılan (set null) bağlar: geri yüklemede yeniden kurulur
  with rel(t, id, c, v) as (
              select 'enforcements', e.id, 'case_id', e.case_id from public.enforcements e
                where e.org_id = p_org and e.case_id = any(v_case) and not e.id = any(v_enf)
    union all select 'expenses', e.id, 'enforcement_id', e.enforcement_id from public.expenses e
                where e.org_id = p_org and e.enforcement_id = any(v_enf) and not e.id = any(v_exp)
    union all select 'enforcement_events', e.id, 'debtor_id', e.debtor_id from public.enforcement_events e
                where e.org_id = p_org and e.debtor_id = any(v_deb) and not e.enforcement_id = any(v_enf)
    union all select 'collections', c.id, 'promise_id', c.promise_id from public.collections c
                where c.org_id = p_org and c.promise_id = any(v_prom)
                  and not coalesce(c.enforcement_id = any(v_enf) or c.debtor_id = any(v_deb), false)
  )
  select coalesce(jsonb_agg(jsonb_build_object('t', t, 'id', id, 'c', c, 'v', v)), '[]'::jsonb) into v_rel from rel;

  select coalesce(jsonb_agg(a.id), '[]'::jsonb) into v_att
  from public.attachments a
  where a.org_id = p_org
    and ((a.entity = 'expense' and a.entity_id = any(v_exp))
         or a.id in (select d.attachment_id from public.documents d where d.org_id = p_org and d.id = any(v_doc)));

  return jsonb_build_object('rows', v_rows, 'relinks', v_rel, 'attachments', v_att, 'counts', v_counts,
                            'items', v_items, 'money', v_money, 'keep', v_keep);
end $$;
revoke all on function app.trash_collect(uuid, text, uuid) from public, anon, authenticated;

create or replace function public.trash_preview(p_entity text, p_ids uuid[]) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_org uuid := app.current_org_id(); v_id uuid; v_root jsonb; v_c jsonb; v_p jsonb;
  v_counts jsonb := '{}'::jsonb; v_missing text; v_found int := 0; k text;
  v_items jsonb := '[]'::jsonb; v_money jsonb := '{}'::jsonb; v_keep jsonb := '[]'::jsonb;
begin
  if app.trash_module(p_entity) is null then
    raise exception 'Bu kayıt türü çöp kutusuna atılamaz' using errcode = '22023';
  end if;
  foreach v_id in array coalesce(p_ids, '{}') loop
    v_root := app.trash_root(v_org, p_entity, v_id);
    continue when v_root is null;
    v_found := v_found + 1;
    v_p := app.trash_collect(v_org, p_entity, v_id);
    v_c := v_p -> 'counts';
    v_missing := coalesce(v_missing, app.trash_missing_permission(p_entity, v_root, v_c));
    for k in select jsonb_object_keys(v_c) loop
      v_counts := jsonb_set(v_counts, array[k], to_jsonb(coalesce((v_counts ->> k)::int, 0) + (v_c ->> k)::int));
    end loop;
    for k in select jsonb_object_keys(v_p -> 'money') loop
      v_money := jsonb_set(v_money, array[k], to_jsonb(coalesce((v_money ->> k)::numeric, 0) + (v_p -> 'money' ->> k)::numeric));
    end loop;
    v_items := v_items || (v_p -> 'items');
    v_keep := v_keep || (v_p -> 'keep');
  end loop;
  return jsonb_build_object(
    'counts', v_counts,
    'money', v_money,
    'keep', jsonb_build_object(
      'count', jsonb_array_length(v_keep),
      'amount', coalesce((select sum((kp ->> 'amount')::numeric) from jsonb_array_elements(v_keep) kp), 0)
    ),
    'items', (select coalesce(jsonb_agg(i), '[]'::jsonb) from (select i from jsonb_array_elements(v_items) i limit 200) q),
    'found', v_found,
    'missing', v_missing,
    -- Kasa / cari bakiyesini değiştiren kayıtlar da gidiyor mu?
    'balances', v_counts ?| array['collections', 'installment_payments', 'account_transactions', 'fee_plans', 'expenses']
  );
end $$;
revoke all on function public.trash_preview(text, uuid[]) from public, anon;
grant execute on function public.trash_preview(text, uuid[]) to authenticated;

create or replace function public.trash_delete(p_entity text, p_ids uuid[]) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid := app.current_org_id(); v_id uuid; v_root jsonb; v_p jsonb; v_missing text;
  v_label text; v_n int := 0; r jsonb; v_rows jsonb; v_trash uuid;
begin
  if v_org is null then raise exception 'Oturum bulunamadı' using errcode = '28000'; end if;
  if app.trash_module(p_entity) is null then
    raise exception 'Bu kayıt türü çöp kutusuna atılamaz' using errcode = '22023';
  end if;
  perform set_config('app.trash_mode', '1', true);
  perform set_config('app.skip_audit', '1', true);

  foreach v_id in array coalesce(p_ids, '{}') loop
    -- Aynı çağrıda önceki kökle birlikte gitmiş olabilir (ör. virmanın diğer bacağı)
    v_root := app.trash_root(v_org, p_entity, v_id);
    continue when v_root is null;
    v_p := app.trash_collect(v_org, p_entity, v_id);
    v_missing := app.trash_missing_permission(p_entity, v_root, v_p -> 'counts');
    if v_missing is not null then
      raise exception 'Bu silme için yetkiniz yok (%)', v_missing using errcode = '42501';
    end if;
    v_label := left(coalesce(v_root ->> 'name', v_root ->> 'title', v_root ->> 'no', v_root ->> 'description', ''), 200);

    insert into public.trash (org_id, entity, label, payload, counts, amounts, items, deleted_by)
    values (v_org, p_entity, v_label,
            jsonb_build_object('rows', v_p -> 'rows', 'relinks', v_p -> 'relinks', 'attachments', v_p -> 'attachments'),
            v_p -> 'counts', v_p -> 'money', v_p -> 'items', auth.uid())
    returning id into v_trash;

    -- Bize ödenmiş para silinen kayıtla yok olmasın: kalıcı "kalan ödemeler" defterine (kasa bakiyesi aynı kalır)
    insert into public.payment_ledger (org_id, date, amount, method, account_id, client_name, source, kind, trash_id, created_by)
    select v_org, (k ->> 'date')::date, (k ->> 'amount')::numeric, nullif(k ->> 'method', ''),
           nullif(k ->> 'account_id', '')::uuid,
           coalesce((select c.name from public.clients c where c.org_id = v_org and c.id = nullif(k ->> 'client_id', '')::uuid), ''),
           'Silinen: ' || v_label, k ->> 'kind', v_trash, auth.uid()
    from jsonb_array_elements(v_p -> 'keep') k;

    -- Çocuktan ebeveyne sil
    select coalesce(jsonb_agg(e order by o desc), '[]'::jsonb) into v_rows
      from jsonb_array_elements(v_p -> 'rows') with ordinality as a(e, o);
    for r in select value from jsonb_array_elements(v_rows) loop
      if r ->> 't' = 'enforcement_debtors' then
        delete from public.enforcement_debtors
          where enforcement_id = (r -> 'r' ->> 'enforcement_id')::uuid and debtor_id = (r -> 'r' ->> 'debtor_id')::uuid;
      elsif r ->> 't' = 'seizure_notices' then
        delete from public.seizure_notices
          where enforcement_id = (r -> 'r' ->> 'enforcement_id')::uuid
            and due = (r -> 'r' ->> 'due')::date and kind = r -> 'r' ->> 'kind';
      else
        execute format('delete from public.%I where org_id = $1 and id = $2', r ->> 't')
          using v_org, (r -> 'r' ->> 'id')::uuid;
      end if;
    end loop;
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;
revoke all on function public.trash_delete(text, uuid[]) from public, anon;
grant execute on function public.trash_delete(text, uuid[]) to authenticated;

create or replace function public.trash_restore(p_id uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid := app.current_org_id(); t public.trash%rowtype; r jsonb; v_n int := 0;
begin
  select * into t from public.trash where id = p_id and org_id = v_org for update;
  if not found then raise exception 'Çöp kutusunda böyle bir kayıt yok' using errcode = 'P0002'; end if;
  if not (app.can(app.trash_module(t.entity), 'delete') or t.deleted_by = auth.uid()) then
    raise exception 'Geri yükleme yetkiniz yok' using errcode = '42501';
  end if;
  perform set_config('app.skip_audit', '1', true);

  for r in select value from jsonb_array_elements(t.payload -> 'rows') loop
    begin
      execute format(
        'insert into public.%1$I select * from jsonb_populate_record(null::public.%1$I, $1) on conflict do nothing',
        r ->> 't') using r -> 'r';
      v_n := v_n + 1;
    exception when foreign_key_violation then
      raise exception 'Geri yüklenemedi: bağlı olduğu kayıt (müvekkil, hesap ya da borçlu) artık yok. Önce onu geri yükleyin.'
        using errcode = '23503';
    end;
  end loop;

  for r in select value from jsonb_array_elements(t.payload -> 'relinks') loop
    execute format('update public.%1$I set %2$I = $1 where org_id = $2 and id = $3 and %2$I is null', r ->> 't', r ->> 'c')
      using (r ->> 'v')::uuid, v_org, (r ->> 'id')::uuid;
  end loop;

  -- Geri yüklenen kayıtların ödemeleri yeniden yerine döner: defterdeki kopyaları çift sayılmasın
  delete from public.payment_ledger where trash_id = p_id;
  delete from public.trash where id = p_id;
  return v_n;
end $$;
revoke all on function public.trash_restore(uuid) from public, anon;
grant execute on function public.trash_restore(uuid) to authenticated;
