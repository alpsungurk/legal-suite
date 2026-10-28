-- =====================================================================================
-- Vekalet planına anlaşma bilgisi ve belge (sözleşme, vekaletname…)
--   - fee_plans.agreement: anlaşma bilgisi (serbest metin); not zaten fee_plans.note
--   - Belgeler attachments'ta entity = 'plan', entity_id = plan olarak tutulur (makbuzlardaki gibi).
--     Görme planın iznine bağlıdır: vekalet planının dosyalarını yalnızca "vekalet" izni olan görür
--     (documents / expenses görme izni olsa bile). Yükleme "vekalet" ekleme / düzenleme iznine de açıktır.
--   - Plan silinince dosyaları da silinir (Storage temizliği kuyruğa alınır); çöp kutusuna atılırken
--     korunur, kalıcı silinirse temizlenir.
-- Tekrar çalıştırılabilir. (20261029160000_vekalet_izni.sql sonrası)
-- =====================================================================================

alter table public.fee_plans add column if not exists agreement text;

alter table public.attachments drop constraint if exists attachments_entity_check;
alter table public.attachments add constraint attachments_entity_check
  check (entity in ('expense', 'document', 'logo', 'plan'));

drop policy if exists attachments_select on public.attachments;
create policy attachments_select on public.attachments for select to authenticated
  using (org_id = app.current_org_id()
         and (case when entity = 'plan' and entity_id is not null
                   then app.plan_access(entity_id, 'view')
                   else (created_by = auth.uid() or app.can('documents', 'view') or app.can('expenses', 'view'))
              end));

drop policy if exists attachments_insert on public.attachments;
create policy attachments_insert on public.attachments for insert to authenticated
  with check (org_id = app.current_org_id() and created_by = auth.uid()
              and (app.can('documents', 'create') or app.can('expenses', 'create') or app.is_admin()
                   or app.can('vekalet', 'create') or app.can('vekalet', 'edit')));

-- Plan silinince dosyaları da gider (çöp kutusuna atılırken korunur)
create or replace function app.drop_plan_files() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(current_setting('app.trash_mode', true), '') = '1' then return null; end if;
  delete from public.attachments where org_id = old.org_id and entity = 'plan' and entity_id = old.id;
  return null;
end $$;
drop trigger if exists trg_plan_files on public.fee_plans;
create trigger trg_plan_files after delete on public.fee_plans
  for each row execute function app.drop_plan_files();

-- Çöp kutusu: plan dosyaları da çöp satırının eklerine yazılır
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

  -- Vekalet (yalnızca izinli kullanıcıya açık) planlar ayrıca sayılır: silme yetkisi ona göre denetlenir
  select count(*) into n from jsonb_array_elements(v_rows) e
   where e ->> 't' = 'fee_plans' and coalesce((e -> 'r' ->> 'admin_only')::boolean, false);
  if n > 0 then v_counts := v_counts || jsonb_build_object('vekalet_plans', n); end if;

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
         or (a.entity = 'plan' and a.entity_id = any(v_plan))
         or a.id in (select d.attachment_id from public.documents d where d.org_id = p_org and d.id = any(v_doc)));

  return jsonb_build_object('rows', v_rows, 'relinks', v_rel, 'attachments', v_att, 'counts', v_counts,
                            'items', v_items, 'money', v_money, 'keep', v_keep);
end $$;
revoke all on function app.trash_collect(uuid, text, uuid) from public, anon, authenticated;

create or replace function app.trash_purge_row(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare t public.trash%rowtype;
begin
  select * into t from public.trash where id = p_id;
  if not found then return; end if;
  -- Yeniden kullanılmayan ekler silinir; tetikleyici Storage temizliğini sıraya alır
  delete from public.attachments a
  where a.org_id = t.org_id
    and a.id in (select (x #>> '{}')::uuid from jsonb_array_elements(t.payload -> 'attachments') x)
    and not exists (select 1 from public.documents d where d.attachment_id = a.id)
    and not exists (select 1 from public.expenses e where a.entity = 'expense' and e.id = a.entity_id)
    and not exists (select 1 from public.fee_plans fp where a.entity = 'plan' and fp.id = a.entity_id);
  delete from public.trash where id = p_id;
end $$;
revoke all on function app.trash_purge_row(uuid) from public, anon, authenticated;
