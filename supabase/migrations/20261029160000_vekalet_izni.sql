-- =====================================================================================
-- Vekalet ücreti artık bir İZİN modülü (Ayarlar → İzinler → "Vekalet ücreti")
--   Önceden vekalet planları yalnızca yöneticiye açıktı (app.is_admin()). Şimdi admin kime
--   "vekalet" izni (görüntüle / ekle / düzenle / sil) verirse o görür; admin hepsine sahiptir.
--   Vekalet planı (fee_plans.admin_only) "vekalet" iznine, diğer planlar "fees" iznine bağlıdır;
--   taksitler ve tahsilatlar planlarının iznini izler. Tahsilat RPC'si, taksit bildirimleri ve çöp
--   kutusu da aynı kurala uyar. 20261029140000_vekalet_ozel.sql değiştirilmez.
-- Tekrar çalıştırılabilir.
-- =====================================================================================

create or replace function public.my_permissions() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_object_agg(m || '.' || a, app.can(m, a)), '{}'::jsonb)
  from (
    values
      ('clients','view'),('clients','create'),('clients','edit'),('clients','delete'),
      ('cases','view'),('cases','create'),('cases','edit'),('cases','delete'),
      ('documents','view'),('documents','create'),('documents','edit'),('documents','delete'),
      ('expenses','view'),('expenses','create'),('expenses','edit'),('expenses','delete'),
      ('reminders','view'),('reminders','create'),('reminders','edit'),('reminders','delete'),
      ('enforcements','view'),('enforcements','create'),('enforcements','edit'),('enforcements','delete'),
      ('fees','view'),('fees','create'),('fees','edit'),('fees','delete'),
      ('vekalet','view'),('vekalet','create'),('vekalet','edit'),('vekalet','delete'),
      ('ledger','view'),
      ('accounts','view'),('accounts','create'),('accounts','edit'),('accounts','delete'),
      ('reports','view'),
      ('activity','view'),
      ('statements','view'),
      ('settings_firm','view'),('settings_firm','edit'),
      ('settings_categories','view'),('settings_categories','create'),('settings_categories','edit'),('settings_categories','delete'),
      ('settings_companies','view'),('settings_companies','create'),('settings_companies','edit'),('settings_companies','delete'),
      ('settings_users','view'),('settings_users','create'),('settings_users','edit'),
      ('settings_backup','view')
  ) as t(m, a)
$$;
revoke all on function public.my_permissions() from public, anon;
grant execute on function public.my_permissions() to authenticated;

-- Planın izin modülü: vekalet planı "vekalet", diğerleri "fees". view: görme; write: ekle ya da düzenle
create or replace function app.plan_access(p_plan uuid, p_action text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select case when p_action = 'view' then app.can(q.m, 'view')
                else (app.can(q.m, 'create') or app.can(q.m, 'edit')) end
    from (select case when fp.admin_only then 'vekalet' else 'fees' end as m
          from public.fee_plans fp where fp.id = p_plan) q
  ), false)
$$;
create or replace function app.installment_access(p_installment uuid, p_action text) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.plan_access((select i.plan_id from public.installments i where i.id = p_installment), p_action)
$$;
revoke all on function app.plan_access(uuid, text), app.installment_access(uuid, text) from public, anon;
grant execute on function app.plan_access(uuid, text), app.installment_access(uuid, text) to authenticated;

-- fee_plans
drop policy if exists fee_plans_select on public.fee_plans;
drop policy if exists fee_plans_insert on public.fee_plans;
drop policy if exists fee_plans_update on public.fee_plans;
drop policy if exists fee_plans_delete on public.fee_plans;
create policy fee_plans_select on public.fee_plans for select to authenticated
  using (org_id = app.current_org_id() and app.can(case when admin_only then 'vekalet' else 'fees' end, 'view'));
create policy fee_plans_insert on public.fee_plans for insert to authenticated
  with check (org_id = app.current_org_id() and app.can(case when admin_only then 'vekalet' else 'fees' end, 'create'));
create policy fee_plans_update on public.fee_plans for update to authenticated
  using (org_id = app.current_org_id() and app.can(case when admin_only then 'vekalet' else 'fees' end, 'edit'))
  with check (org_id = app.current_org_id() and app.can(case when admin_only then 'vekalet' else 'fees' end, 'edit'));
create policy fee_plans_delete on public.fee_plans for delete to authenticated
  using (org_id = app.current_org_id() and app.can(case when admin_only then 'vekalet' else 'fees' end, 'delete'));

-- installments
drop policy if exists installments_select on public.installments;
drop policy if exists installments_insert on public.installments;
drop policy if exists installments_update on public.installments;
drop policy if exists installments_delete on public.installments;
create policy installments_select on public.installments for select to authenticated
  using (org_id = app.current_org_id() and app.plan_access(plan_id, 'view'));
create policy installments_insert on public.installments for insert to authenticated
  with check (org_id = app.current_org_id() and app.plan_access(plan_id, 'write'));
create policy installments_update on public.installments for update to authenticated
  using (org_id = app.current_org_id() and app.plan_access(plan_id, 'write'))
  with check (org_id = app.current_org_id() and app.plan_access(plan_id, 'write'));
create policy installments_delete on public.installments for delete to authenticated
  using (org_id = app.current_org_id() and app.plan_access(plan_id, 'write'));

-- installment_payments
drop policy if exists installment_payments_select on public.installment_payments;
drop policy if exists installment_payments_insert on public.installment_payments;
drop policy if exists installment_payments_update on public.installment_payments;
drop policy if exists installment_payments_delete on public.installment_payments;
create policy installment_payments_select on public.installment_payments for select to authenticated
  using (org_id = app.current_org_id() and app.installment_access(installment_id, 'view'));
create policy installment_payments_insert on public.installment_payments for insert to authenticated
  with check (org_id = app.current_org_id() and app.installment_access(installment_id, 'write'));
create policy installment_payments_update on public.installment_payments for update to authenticated
  using (org_id = app.current_org_id() and app.installment_access(installment_id, 'write'))
  with check (org_id = app.current_org_id() and app.installment_access(installment_id, 'write'));
create policy installment_payments_delete on public.installment_payments for delete to authenticated
  using (org_id = app.current_org_id() and app.installment_access(installment_id, 'write'));

-- Eski yönetici kontrolü artık kullanılmıyor
drop function if exists app.fee_plan_open(uuid);
drop function if exists app.installment_open(uuid);

-- Tahsilat al: vekalet planı "vekalet" iznine bağlı
create or replace function public.record_installment_payment(
  p_plan uuid, p_installment uuid, p_amount numeric, p_date date, p_method text,
  p_account uuid default null, p_note text default null
) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid := app.current_org_id(); v_left numeric := round(p_amount, 2); v_start int; v_n int := 0;
  r record; v_take numeric; v_last uuid; v_priv boolean;
begin
  if v_org is null then raise exception 'Oturum bulunamadı' using errcode = '28000'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Tutar sıfırdan büyük olmalı' using errcode = '22023'; end if;
  -- Vekalet planı "Vekalet ücreti" iznine, diğerleri "Tahsilatlar" iznine bağlıdır
  select fp.admin_only into v_priv from public.fee_plans fp where fp.id = p_plan and fp.org_id = v_org;
  if v_priv is null or (v_priv and not app.can('vekalet', 'view')) then
    raise exception 'Plan bulunamadı' using errcode = 'P0002';
  end if;
  if not app.can(case when v_priv then 'vekalet' else 'fees' end, 'edit') then
    raise exception 'Tahsilat alma yetkiniz yok' using errcode = '42501';
  end if;
  select position into v_start from public.installments where id = p_installment and plan_id = p_plan and org_id = v_org;
  if v_start is null then raise exception 'Taksit bulunamadı' using errcode = 'P0002'; end if;

  -- seçilen taksitten başlayıp sona, sonra baştan dolaşır
  for r in
    select i.id, i.position, i.amount,
           i.amount - coalesce((select sum(p.amount) from public.installment_payments p where p.installment_id = i.id), 0) as room
    from public.installments i
    where i.plan_id = p_plan and i.org_id = v_org
    order by (case when i.position >= v_start then 0 else 1 end), i.position
  loop
    v_last := r.id;
    exit when v_left <= 0;
    continue when r.room <= 0.005;
    v_take := least(r.room, v_left);
    insert into public.installment_payments (installment_id, date, amount, method, account_id, note)
      values (r.id, p_date, round(v_take, 2), p_method, p_account, p_note);
    v_left := round(v_left - v_take, 2);
    v_n := v_n + 1;
  end loop;
  if v_left > 0 then   -- planın tamamını aşan fazla tutar son taksite yazılır
    insert into public.installment_payments (installment_id, date, amount, method, account_id, note)
      values (v_last, p_date, v_left, p_method, p_account, p_note);
    v_n := v_n + 1;
  end if;
  return v_n;
end $$;

-- Taksit bildirimleri: vekalet planınınki "vekalet" izni olanlara, /vekalet bağlantısıyla
create or replace function app.cron_notifications() returns int
language plpgsql security definer set search_path = '' as $$
declare r record; v_n int := 0; k int; v_today date;
begin
  for r in select id, timezone from public.organizations where active loop
    v_today := (now() at time zone r.timezone)::date;

    -- Geciken taksitler: tahsilat görme izni olanlara, taksit başına bir kez
    insert into public.notifications (org_id, user_id, title, detail, type, link, dedupe_key)
    select r.id, p.id, 'Geciken taksit',
           c.name || ' · ' || to_char(i.amount - paid.s, 'FM999999990.00') || ' ₺', 'Taksit', case when fp.admin_only then '/vekalet' else '/tahsilatlar' end,
           'inst-overdue:' || i.id
    from public.installments i
    join public.fee_plans fp on fp.id = i.plan_id and fp.org_id = i.org_id and not fp.cancelled
    join public.clients c on c.id = fp.client_id and c.org_id = fp.org_id
    cross join lateral (select coalesce(sum(x.amount), 0) as s from public.installment_payments x where x.installment_id = i.id) paid
    join public.profiles p on p.org_id = i.org_id and p.active
                              and app.can_user(p.id, case when fp.admin_only then 'vekalet' else 'fees' end, 'view')
    where i.org_id = r.id and i.due_date < v_today and i.amount - paid.s > 0.005
    on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
    get diagnostics k = row_count; v_n := v_n + k;

    -- 3 gün içinde vadesi gelen taksitler
    insert into public.notifications (org_id, user_id, title, detail, type, link, dedupe_key)
    select r.id, p.id, 'Vadesi yaklaşan taksit',
           c.name || ' · ' || to_char(i.amount - paid.s, 'FM999999990.00') || ' ₺ · ' || to_char(i.due_date, 'DD.MM.YYYY'), 'Taksit', case when fp.admin_only then '/vekalet' else '/tahsilatlar' end,
           'inst-soon:' || i.id
    from public.installments i
    join public.fee_plans fp on fp.id = i.plan_id and fp.org_id = i.org_id and not fp.cancelled
    join public.clients c on c.id = fp.client_id and c.org_id = fp.org_id
    cross join lateral (select coalesce(sum(x.amount), 0) as s from public.installment_payments x where x.installment_id = i.id) paid
    join public.profiles p on p.org_id = i.org_id and p.active
                              and app.can_user(p.id, case when fp.admin_only then 'vekalet' else 'fees' end, 'view')
    where i.org_id = r.id and i.due_date between v_today and v_today + 3 and i.amount - paid.s > 0.005
    on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
    get diagnostics k = row_count; v_n := v_n + k;

    -- Bugün / yarın ajanda: sorumlusuna, gün başına bir kez
    insert into public.notifications (org_id, user_id, title, detail, type, link, dedupe_key)
    select r.id, rm.assignee_id,
           case when rm.date = v_today then 'Bugün: ' else 'Yarın: ' end || rm.type, rm.title, 'Ajanda', '/takvim',
           'rem:' || rm.id || ':' || (case when rm.date = v_today then 'today' else 'tomorrow' end)
    from public.reminders rm
    join public.profiles p on p.id = rm.assignee_id and p.active
    where rm.org_id = r.id and rm.status = 'Bekliyor' and rm.date between v_today and v_today + 1
    on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
    get diagnostics k = row_count; v_n := v_n + k;

    -- Vadesi geçen ödeme sözü / borçlu taksiti: icra dosyasının sorumlularına
    insert into public.notifications (org_id, user_id, title, detail, type, link, dedupe_key)
    select r.id, resp.uid, 'Ödeme sözü tutulmadı',
           d.name || ' · ' || to_char(pp.amount, 'FM999999990.00') || ' ₺', 'Ödeme sözü', '/icra/' || en.id,
           'prm:' || pp.id
    from public.payment_promises pp
    join public.enforcements en on en.id = pp.enforcement_id and en.org_id = pp.org_id
    join public.debtors d on d.id = pp.debtor_id and d.org_id = pp.org_id
    cross join lateral unnest(en.responsible_ids) as resp(uid)
    join public.profiles p on p.id = resp.uid and p.org_id = r.id and p.active
    where pp.org_id = r.id and pp.status = 'Bekliyor' and pp.due_date < v_today
    on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
    get diagnostics k = row_count; v_n := v_n + k;
  end loop;
  return v_n;
end $$;
revoke all on function app.cron_notifications() from public, anon, authenticated;

-- Çöp kutusu: vekalet planı silmek "vekalet" silme izni ister; yetkisizlere tutar / döküm gösterilmez
create or replace function app.trash_missing_permission(p_entity text, p_root jsonb, p_counts jsonb) returns text
language plpgsql stable security definer set search_path = '' as $$
declare k text; m text;
begin
  -- Masrafı giren kendi masrafını silebilir
  if p_entity = 'fee_plans' and coalesce((p_root ->> 'admin_only')::boolean, false) then
    if not app.can('vekalet', 'delete') then return 'vekalet'; end if;
  elsif p_entity = 'expenses' then
    if not (app.can('expenses', 'delete') or (p_root ->> 'created_by')::uuid = auth.uid()) then return 'expenses'; end if;
  elsif not app.can(app.trash_module(p_entity), 'delete') then
    return app.trash_module(p_entity);
  end if;
  for k in select jsonb_object_keys(p_counts) loop
    m := case k
      when 'cases' then 'cases'
      when 'enforcements' then 'enforcements'
      when 'expenses' then 'expenses'
      when 'fee_plans' then case when coalesce((p_counts ->> 'fee_plans')::int, 0) > coalesce((p_counts ->> 'vekalet_plans')::int, 0) then 'fees' end
      when 'vekalet_plans' then 'vekalet'
      when 'reminders' then 'reminders'
      when 'documents' then 'documents'
      when 'account_transactions' then 'accounts'
      when 'salary_garnishments' then 'enforcements'
      else null
    end;
    if m is not null and m <> app.trash_module(p_entity) and not app.can(m, 'delete') then return m; end if;
  end loop;
  return null;
end $$;
revoke all on function app.trash_missing_permission(text, jsonb, jsonb) from public, anon, authenticated;

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
    -- Silme yetkisi yoksa (ör. vekalet planı da gidiyorsa) tutar ve döküm sızdırılmaz
    'money', case when v_missing is null then v_money else '{}'::jsonb end,
    'keep', jsonb_build_object(
      'count', case when v_missing is null then jsonb_array_length(v_keep) else 0 end,
      'amount', case when v_missing is null then coalesce((select sum((kp ->> 'amount')::numeric) from jsonb_array_elements(v_keep) kp), 0) else 0 end
    ),
    'items', case when v_missing is null then (select coalesce(jsonb_agg(i), '[]'::jsonb) from (select i from jsonb_array_elements(v_items) i limit 200) q) else '[]'::jsonb end,
    'found', v_found,
    'missing', v_missing,
    -- Kasa / cari bakiyesini değiştiren kayıtlar da gidiyor mu?
    'balances', v_counts ?| array['collections', 'installment_payments', 'account_transactions', 'fee_plans', 'expenses']
  );
end $$;
revoke all on function public.trash_preview(text, uuid[]) from public, anon;
grant execute on function public.trash_preview(text, uuid[]) to authenticated;
