-- =====================================================================================
-- Aktivite geçmişi tamamen kaldırılır: audit tetikleyicileri, tablo, fonksiyon yazımları.
-- Tekrar çalıştırılabilir.
-- =====================================================================================

-- 1) Dosya kapatma: activities yazmasın
create or replace function app.close_case_core(p_org uuid, p_case uuid, p_actor uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid := p_org; c public.cases%rowtype; v_tz text; v_year int;
  v_debit numeric; v_credit numeric; v_net numeric; v_fee_total numeric; v_fee_paid numeric;
  v_recv numeric := 0; v_pay numeric := 0; r record;
begin
  select * into c from public.cases where id = p_case and org_id = v_org for update;
  if not found then raise exception 'Dosya bulunamadı' using errcode = 'P0002'; end if;
  select timezone into v_tz from public.organizations where id = v_org;
  v_year := extract(year from (now() at time zone v_tz))::int;
  perform set_config('app.skip_audit', '1', true);

  select
    coalesce((select sum(e.amount) from public.expenses e where e.org_id = v_org and e.case_id = p_case and e.charge_to = 'Müvekkil' and e.paid_by = 'Büro'), 0)
    + coalesce((select sum(fp.total) from public.fee_plans fp where fp.org_id = v_org and fp.case_id = p_case and not fp.cancelled), 0),
    coalesce((select sum(p.amount) from public.installment_payments p
              join public.installments i on i.id = p.installment_id and i.org_id = p.org_id
              join public.fee_plans fp on fp.id = i.plan_id and fp.org_id = i.org_id
              where p.org_id = v_org and fp.case_id = p_case and not fp.cancelled), 0)
    into v_debit, v_credit;
  v_net := round(v_debit - v_credit, 2);
  if c.client_id is not null then
    if v_net > 0 then v_recv := v_net; else v_pay := -v_net; end if;
  end if;
  select coalesce(sum(fp.total), 0) into v_fee_total from public.fee_plans fp where fp.org_id = v_org and fp.case_id = p_case and not fp.cancelled;
  select coalesce(sum(p.amount), 0) into v_fee_paid
    from public.installment_payments p
    join public.installments i on i.id = p.installment_id and i.org_id = p.org_id
    join public.fee_plans fp on fp.id = i.plan_id and fp.org_id = i.org_id
    where p.org_id = v_org and fp.case_id = p_case and not fp.cancelled;

  for r in
    select extract(year from p.date)::int as y, sum(p.amount) as s
    from public.installment_payments p
    join public.installments i on i.id = p.installment_id and i.org_id = p.org_id
    join public.fee_plans fp on fp.id = i.plan_id and fp.org_id = i.org_id
    where p.org_id = v_org and fp.case_id = p_case group by 1
  loop perform app.add_year_stats(v_org, r.y, p_fee => r.s); end loop;
  for r in
    select extract(year from e.date)::int as y,
           sum(case when e.charge_to = 'Büro' then e.amount else 0 end) as office,
           sum(case when e.charge_to = 'Büro' then 0 else e.amount end) as client
    from public.expenses e where e.org_id = v_org and e.case_id = p_case group by 1
  loop perform app.add_year_stats(v_org, r.y, p_office => r.office, p_client => r.client); end loop;
  perform app.add_year_stats(v_org, v_year, p_closed => 1);

  insert into public.account_transactions (org_id, account_id, date, amount, category, description, client_id)
  select v_org, d.account_id, (now() at time zone v_tz)::date, d.delta, 'Kapanan dosya',
         'Kapanan dosya ' || c.no || ' · kayıtların hesap etkisi', c.client_id
  from (
    select account_id, round(sum(delta), 2) as delta from (
      select e.account_id, -e.amount as delta from public.expenses e
        where e.org_id = v_org and e.case_id = p_case and e.paid_by = 'Büro' and e.account_id is not null
      union all
      select p.account_id, p.amount from public.installment_payments p
        join public.installments i on i.id = p.installment_id and i.org_id = p.org_id
        join public.fee_plans fp on fp.id = i.plan_id and fp.org_id = i.org_id
        where p.org_id = v_org and fp.case_id = p_case and p.account_id is not null
    ) q group by account_id
  ) d
  where d.delta <> 0;

  delete from public.documents where org_id = v_org and case_id = p_case;
  delete from public.expenses where org_id = v_org and case_id = p_case;
  delete from public.fee_plans where org_id = v_org and case_id = p_case;
  delete from public.reminders where org_id = v_org and case_id = p_case;
  update public.enforcements set case_id = null where org_id = v_org and case_id = p_case;
  delete from public.cases where id = p_case and org_id = v_org;

  if c.client_id is not null then
    update public.clients set
      closed_case_count = closed_case_count + 1,
      closed_receivable = round(closed_receivable + v_recv, 2),
      closed_payable    = round(closed_payable + v_pay, 2),
      closed_fee_total  = round(closed_fee_total + v_fee_total, 2),
      closed_fee_paid   = round(closed_fee_paid + v_fee_paid, 2),
      closed_last_at    = now()
    where id = c.client_id and org_id = v_org;
  end if;

  return jsonb_build_object('receivable', v_recv, 'payable', v_pay, 'fee_total', v_fee_total, 'fee_paid', v_fee_paid);
end $$;
revoke all on function app.close_case_core(uuid, uuid, uuid) from public, anon, authenticated;

-- 2) Saklama: activities satırlarını silme
create or replace function app.cron_retention() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  r record; v_year int; v_through int; n int;
  v_notif int := 0; v_arch int := 0; v_storage int := 0;
begin
  perform set_config('app.skip_audit', '1', true);
  delete from public.notifications where (read and created_at < now() - interval '30 days') or created_at < now() - interval '120 days';
  get diagnostics n = row_count; v_notif := n;

  for r in select id, timezone, retention_months, auto_archive_keep_years, last_auto_archive_year
           from public.organizations where active loop
    if r.auto_archive_keep_years is not null then
      v_year := extract(year from (now() at time zone r.timezone))::int;
      v_through := v_year - r.auto_archive_keep_years - 1;
      if v_through >= 2000 and coalesce(r.last_auto_archive_year, 0) < v_year then
        v_arch := v_arch + app.archive_org(r.id, v_through);
        update public.organizations set last_auto_archive_year = v_year where id = r.id;
      end if;
    end if;
  end loop;

  delete from public.attachments where entity_id is null and entity <> 'logo' and created_at < now() - interval '2 days'
    and not exists (select 1 from public.documents d where d.attachment_id = public.attachments.id);

  if to_regclass('cron.job_run_details') is not null then
    execute $q$delete from cron.job_run_details where end_time < now() - interval '14 days'$q$;
  end if;

  select count(*)::int into v_storage from public.storage_cleanup;
  perform app.cron_storage_cleanup();

  return jsonb_build_object('notifications', v_notif, 'archived', v_arch, 'storage_queue', v_storage);
end $$;
revoke all on function app.cron_retention() from public, anon, authenticated;

-- 3) Arşiv: activities silme / yazma yok
create or replace function app.archive_org(p_org uuid, p_through int) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_end date := make_date(p_through, 12, 31); v_total int := 0; n int; r record; v_tz text; v_now timestamptz := now();
begin
  perform set_config('app.skip_audit', '1', true);
  select timezone into v_tz from public.organizations where id = p_org;

  drop table if exists pg_temp._a_plans;  drop table if exists pg_temp._a_cols;
  create temp table _a_plans on commit drop as
    select fp.id, fp.client_id, fp.cancelled
    from public.fee_plans fp
    where fp.org_id = p_org and fp.date <= v_end
      and (fp.cancelled or fp.total - coalesce((select sum(p.amount) from public.installment_payments p
                                                join public.installments i on i.id = p.installment_id and i.org_id = p.org_id
                                                where i.plan_id = fp.id), 0) <= 0.005)
      and not exists (select 1 from public.installment_payments p
                      join public.installments i on i.id = p.installment_id and i.org_id = p.org_id
                      where i.plan_id = fp.id and p.date > v_end);
  create temp table _a_cols on commit drop as
    select co.id, co.amount, co.date, co.account_id, en.client_id
    from public.collections co
    join public.enforcements en on en.id = co.enforcement_id and en.org_id = co.org_id
    where co.org_id = p_org and co.date <= v_end and co.transferred_to_client;

  for r in
    select client_id, round(sum(debit - credit), 2) as net from (
      select coalesce(e.client_id, cs.client_id, en.client_id) as client_id, e.amount as debit, 0::numeric as credit
        from public.expenses e
        left join public.cases cs on cs.id = e.case_id and cs.org_id = e.org_id
        left join public.enforcements en on en.id = e.enforcement_id and en.org_id = e.org_id
        where e.org_id = p_org and e.date <= v_end and e.charge_to = 'Müvekkil' and e.paid_by = 'Büro'
      union all
      select ap.client_id, fp.total, 0 from _a_plans ap join public.fee_plans fp on fp.id = ap.id where not ap.cancelled
      union all
      select ap.client_id, 0, p.amount from _a_plans ap
        join public.installments i on i.plan_id = ap.id
        join public.installment_payments p on p.installment_id = i.id
        where not ap.cancelled
      union all
      select t.client_id, abs(t.amount), 0 from public.account_transactions t
        where t.org_id = p_org and t.date <= v_end and t.category = 'Müvekkile aktarım' and t.client_id is not null
      union all
      select ac.client_id, 0, ac.amount from _a_cols ac
    ) q where client_id is not null group by client_id
  loop
    if abs(r.net) >= 0.005 then
      update public.clients set
        closed_receivable = round(closed_receivable + greatest(r.net, 0), 2),
        closed_payable    = round(closed_payable + greatest(-r.net, 0), 2),
        closed_last_at    = coalesce(closed_last_at, v_now)
      where id = r.client_id and org_id = p_org;
    end if;
  end loop;

  for r in
    select y,
      sum(fee) as fee, sum(icra) as icra, sum(office) as office, sum(client) as client, sum(oin) as oin, sum(oout) as oout
    from (
      select extract(year from p.date)::int as y, p.amount as fee, 0::numeric as icra, 0::numeric as office, 0::numeric as client, 0::numeric as oin, 0::numeric as oout
        from _a_plans ap join public.installments i on i.plan_id = ap.id join public.installment_payments p on p.installment_id = i.id
      union all select extract(year from date)::int, 0, amount, 0, 0, 0, 0 from _a_cols
      union all select extract(year from e.date)::int, 0, 0,
                 case when e.charge_to = 'Büro' then e.amount else 0 end, case when e.charge_to = 'Büro' then 0 else e.amount end, 0, 0
        from public.expenses e where e.org_id = p_org and e.date <= v_end
      union all select extract(year from t.date)::int, 0, 0, 0, 0,
                 case when t.category = 'Diğer gelir' then t.amount else 0 end,
                 case when t.category = 'Diğer gider' then abs(t.amount) else 0 end
        from public.account_transactions t where t.org_id = p_org and t.date <= v_end
    ) q group by y
  loop
    perform app.add_year_stats(p_org, r.y, r.fee, r.icra, r.office, r.client, r.oin, r.oout);
  end loop;

  update public.accounts a set opening_balance = round(a.opening_balance + d.delta, 2), updated_at = now()
  from (
    select account_id, sum(delta) as delta from (
      select e.account_id, -e.amount as delta from public.expenses e
        where e.org_id = p_org and e.date <= v_end and e.paid_by = 'Büro' and e.account_id is not null
      union all select p.account_id, p.amount from _a_plans ap
        join public.installments i on i.plan_id = ap.id join public.installment_payments p on p.installment_id = i.id
        where p.account_id is not null
      union all select account_id, amount from _a_cols where account_id is not null
      union all select t.account_id, t.amount from public.account_transactions t where t.org_id = p_org and t.date <= v_end
    ) q group by account_id
  ) d
  where a.id = d.account_id and a.org_id = p_org and d.delta <> 0;

  delete from public.expenses where org_id = p_org and date <= v_end;                         get diagnostics n = row_count; v_total := v_total + n;
  delete from public.fee_plans where id in (select id from _a_plans);                         get diagnostics n = row_count; v_total := v_total + n;
  delete from public.collections where id in (select id from _a_cols);                        get diagnostics n = row_count; v_total := v_total + n;
  delete from public.account_transactions where org_id = p_org and date <= v_end;             get diagnostics n = row_count; v_total := v_total + n;
  delete from public.reminders where org_id = p_org and date <= v_end and status <> 'Bekliyor';        get diagnostics n = row_count; v_total := v_total + n;
  delete from public.payment_promises where org_id = p_org and due_date <= v_end and status <> 'Bekliyor'; get diagnostics n = row_count; v_total := v_total + n;
  delete from public.contact_logs where org_id = p_org and date <= v_end;                     get diagnostics n = row_count; v_total := v_total + n;
  delete from public.notifications where org_id = p_org and created_at < (v_end + 1)::timestamptz; get diagnostics n = row_count; v_total := v_total + n;

  insert into public.org_archive (org_id, archived_through) values (p_org, p_through)
    on conflict (org_id) do update set archived_through = greatest(public.org_archive.archived_through, excluded.archived_through);
  drop table if exists pg_temp._a_plans;  drop table if exists pg_temp._a_cols;
  return v_total;
end $$;

-- 4) Tüm audit tetikleyicilerini kaldır
do $$
declare r record;
begin
  for r in
    select c.relname as tbl
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where t.tgname = 'trg_audit' and not t.tgisinternal and n.nspname = 'public'
  loop
    execute format('drop trigger if exists trg_audit on public.%I', r.tbl);
  end loop;
end $$;

drop function if exists app.audit() cascade;

-- 5) Tabloyu sil
drop table if exists public.activities cascade;
