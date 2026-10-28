-- =====================================================================================
-- Admin'e özel vekalet ücreti
--   - fee_plans.admin_only: true ise plan, taksitleri ve tahsilatları yalnızca yöneticiye
--     görünür (avukata "Tahsilatlar" izni verilmiş olsa bile). Cari / kasa görünümleri
--     security_invoker olduğu için avukatın gördüğü bakiyede bu planlar yer almaz.
--   - Tahsilat RPC'si ve taksit bildirimleri de aynı kurala uyar (bildirim yalnızca admin'e,
--     bağlantı /vekalet).
-- Tekrar çalıştırılabilir.
-- =====================================================================================

alter table public.fee_plans add column if not exists admin_only boolean not null default false;

-- Plan (ya da taksitin planı) bu kullanıcıya açık mı?
create or replace function app.fee_plan_open(p_plan uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.fee_plans fp where fp.id = p_plan and (not fp.admin_only or app.is_admin()))
$$;
create or replace function app.installment_open(p_installment uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.installments i
                 join public.fee_plans fp on fp.id = i.plan_id and fp.org_id = i.org_id
                 where i.id = p_installment and (not fp.admin_only or app.is_admin()))
$$;
revoke all on function app.fee_plan_open(uuid), app.installment_open(uuid) from public, anon;
grant execute on function app.fee_plan_open(uuid), app.installment_open(uuid) to authenticated;

-- fee_plans: standart "fees" kuralı + admin_only satırlar yalnızca yöneticiye
drop policy if exists fee_plans_select on public.fee_plans;
drop policy if exists fee_plans_insert on public.fee_plans;
drop policy if exists fee_plans_update on public.fee_plans;
drop policy if exists fee_plans_delete on public.fee_plans;
create policy fee_plans_select on public.fee_plans for select to authenticated
  using (org_id = app.current_org_id() and app.can('fees', 'view') and (not admin_only or app.is_admin()));
create policy fee_plans_insert on public.fee_plans for insert to authenticated
  with check (org_id = app.current_org_id() and app.can('fees', 'create') and (not admin_only or app.is_admin()));
create policy fee_plans_update on public.fee_plans for update to authenticated
  using (org_id = app.current_org_id() and app.can('fees', 'edit') and (not admin_only or app.is_admin()))
  with check (org_id = app.current_org_id() and (not admin_only or app.is_admin()));
create policy fee_plans_delete on public.fee_plans for delete to authenticated
  using (org_id = app.current_org_id() and app.can('fees', 'delete') and (not admin_only or app.is_admin()));

-- Taksitler ve tahsilatlar: alt tablo kuralı + planı açık olmalı
drop policy if exists installments_select on public.installments;
drop policy if exists installments_insert on public.installments;
drop policy if exists installments_update on public.installments;
drop policy if exists installments_delete on public.installments;
create policy installments_select on public.installments for select to authenticated
  using (org_id = app.current_org_id() and app.can('fees', 'view') and app.fee_plan_open(plan_id));
create policy installments_insert on public.installments for insert to authenticated
  with check (org_id = app.current_org_id() and (app.can('fees', 'create') or app.can('fees', 'edit')) and app.fee_plan_open(plan_id));
create policy installments_update on public.installments for update to authenticated
  using (org_id = app.current_org_id() and (app.can('fees', 'create') or app.can('fees', 'edit')) and app.fee_plan_open(plan_id))
  with check (org_id = app.current_org_id() and app.fee_plan_open(plan_id));
create policy installments_delete on public.installments for delete to authenticated
  using (org_id = app.current_org_id() and (app.can('fees', 'create') or app.can('fees', 'edit')) and app.fee_plan_open(plan_id));

drop policy if exists installment_payments_select on public.installment_payments;
drop policy if exists installment_payments_insert on public.installment_payments;
drop policy if exists installment_payments_update on public.installment_payments;
drop policy if exists installment_payments_delete on public.installment_payments;
create policy installment_payments_select on public.installment_payments for select to authenticated
  using (org_id = app.current_org_id() and app.can('fees', 'view') and app.installment_open(installment_id));
create policy installment_payments_insert on public.installment_payments for insert to authenticated
  with check (org_id = app.current_org_id() and (app.can('fees', 'create') or app.can('fees', 'edit')) and app.installment_open(installment_id));
create policy installment_payments_update on public.installment_payments for update to authenticated
  using (org_id = app.current_org_id() and (app.can('fees', 'create') or app.can('fees', 'edit')) and app.installment_open(installment_id))
  with check (org_id = app.current_org_id() and app.installment_open(installment_id));
create policy installment_payments_delete on public.installment_payments for delete to authenticated
  using (org_id = app.current_org_id() and (app.can('fees', 'create') or app.can('fees', 'edit')) and app.installment_open(installment_id));

-- Tahsilat al: admin'e özel plan yalnızca yöneticiye
create or replace function public.record_installment_payment(
  p_plan uuid, p_installment uuid, p_amount numeric, p_date date, p_method text,
  p_account uuid default null, p_note text default null
) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid := app.current_org_id(); v_left numeric := round(p_amount, 2); v_start int; v_n int := 0;
  r record; v_take numeric; v_last uuid;
begin
  if v_org is null then raise exception 'Oturum bulunamadı' using errcode = '28000'; end if;
  if not app.can('fees', 'edit') then raise exception 'Tahsilat alma yetkiniz yok' using errcode = '42501'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Tutar sıfırdan büyük olmalı' using errcode = '22023'; end if;
  -- Admin'e özel (vekalet) plan yalnızca yöneticiye açıktır
  if not exists (select 1 from public.fee_plans where id = p_plan and org_id = v_org
                 and (not admin_only or app.is_admin())) then
    raise exception 'Plan bulunamadı' using errcode = 'P0002';
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

-- Taksit bildirimleri: admin'e özel planınki yalnızca yöneticiye
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
    join public.profiles p on p.org_id = i.org_id and p.active and app.can_user(p.id, 'fees', 'view')
                              and (not fp.admin_only or p.role = 'admin')
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
    join public.profiles p on p.org_id = i.org_id and p.active and app.can_user(p.id, 'fees', 'view')
                              and (not fp.admin_only or p.role = 'admin')
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
