-- =====================================================================================
-- Kapalı dava dosyaları hemen silinmez
--   Dosya "Kapalı" yapılınca kayıtlarıyla birlikte saklanır; kapanış tarihinden büro ayarındaki
--   süre (varsayılan 12 ay) dolduktan sonra her ayın 1'inde çalışan iş dosyayı siler. Silinirken eskisi gibi
--   müvekkilde yalnızca toplamlar (alacak / verecek, ücret toplamı ve ödenen), yıllık özette o
--   yılın tutarları kalır; kasa / banka bakiyeleri değişmez.
--   "Şimdi kalıcı sil" (public.close_case) yine kullanılabilir.
-- Tekrar çalıştırılabilir.
-- =====================================================================================

alter table public.org_settings add column if not exists closed_case_retention_months int not null default 12;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'org_settings_closed_case_months_check') then
    alter table public.org_settings
      add constraint org_settings_closed_case_months_check check (closed_case_retention_months between 1 and 120);
  end if;
end $$;

-- Kapanış tarihi: "Kapalı" yapılınca boşsa bugün; yeniden açılınca temizlenir (geri sayım baştan başlar)
create or replace function app.case_closing_date() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status = 'Kapalı' then
    if new.closing_date is null then
      new.closing_date := current_date;
    end if;
  elsif tg_op = 'UPDATE' and old.status = 'Kapalı' then
    new.closing_date := null;
  end if;
  return new;
end $$;
drop trigger if exists trg_case_closing on public.cases;
create trigger trg_case_closing before insert or update of status, closing_date on public.cases
  for each row execute function app.case_closing_date();

-- Daha önce "Kapalı" durumda bırakılmış (silinmemiş) dosyalar: geri sayım bugünden başlar
update public.cases set closing_date = current_date where status = 'Kapalı' and closing_date is null;

-- Silme işleminin kendisi (yetki kontrolü çağıranda): close_case ve aylık iş bunu kullanır
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

  -- Bu dosyanın cariye etkisi: masraf + ücret borcu − ödemeler
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

  -- Yıllık özet: silinen ödemeler ve masraflar
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

  -- Kasa / banka bakiyeleri değişmesin: silinen kayıtların hesap etkisi tek harekette tutulur
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

  -- Silme (ekler tetikleyiciyle Storage sırasına girer)
  delete from public.documents where org_id = v_org and case_id = p_case;
  delete from public.expenses where org_id = v_org and case_id = p_case;
  delete from public.fee_plans where org_id = v_org and case_id = p_case;     -- taksit ve ödemeler zincirleme
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

  insert into public.activities (org_id, actor_id, action, entity, entity_id, detail)
    values (v_org, p_actor, 'İşlem', 'Dosya', p_case,
            format('Dosya kapatıldı ve silindi · %s · alacak %s / verecek %s', c.no, v_recv, v_pay));
  return jsonb_build_object('receivable', v_recv, 'payable', v_pay, 'fee_total', v_fee_total, 'fee_paid', v_fee_paid);
end $$;

revoke all on function app.close_case_core(uuid, uuid, uuid) from public, anon, authenticated;

-- "Şimdi kalıcı sil": yetki kontrolü + çekirdek
create or replace function public.close_case(p_case uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_org uuid := app.current_org_id();
begin
  if v_org is null then raise exception 'Oturum bulunamadı' using errcode = '28000'; end if;
  if not app.can('cases', 'delete') then raise exception 'Dosyayı kapatma yetkiniz yok' using errcode = '42501'; end if;
  return app.close_case_core(v_org, p_case, auth.uid());
end $$;
revoke all on function public.close_case(uuid) from public, anon;
grant execute on function public.close_case(uuid) to authenticated;

-- Aylık iş: saklama süresi dolan kapalı dosyaları siler
create or replace function app.cron_purge_closed_cases() returns int
language plpgsql security definer set search_path = '' as $$
declare r record; x record; v_n int := 0; v_today date;
begin
  for r in
    select o.id, o.timezone, coalesce(s.closed_case_retention_months, 12) as months
    from public.organizations o
    left join public.org_settings s on s.org_id = o.id
    where o.active
  loop
    v_today := (now() at time zone r.timezone)::date;
    for x in
      select c.id as case_id
      from public.cases c
      where c.org_id = r.id and c.status = 'Kapalı' and c.closing_date is not null
        and (c.closing_date + make_interval(months => r.months))::date <= v_today
    loop
      perform app.close_case_core(r.id, x.case_id, null);
      v_n := v_n + 1;
    end loop;
  end loop;
  return v_n;
end $$;
revoke all on function app.cron_purge_closed_cases() from public, anon, authenticated;

-- Zamanlanmış iş: her ayın 1'i 03:45 (TR). Önceki sürümde "her gece" kurulmuş olabilir; aynı ad yeniden kurulur.
do $$
begin
  if to_regclass('cron.job') is not null then
    perform cron.unschedule(jobid) from cron.job where jobname = 'lexkasa-kapali-dosya';
    perform cron.schedule('lexkasa-kapali-dosya', '45 0 1 * *', 'select app.cron_purge_closed_cases()');
  else
    raise notice 'pg_cron yok: kapalı dosya silme işi kurulmadı. Database > Extensions > pg_cron açıp bu dosyayı yeniden çalıştırın.';
  end if;
end $$;

-- Ayarlar > Zamanlama ekranı yeni işi de listelesin
create or replace function public.list_cron_jobs()
returns table (jobname text, schedule text, command text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not app.is_admin() then
    raise exception 'Yalnızca yönetici zamanlanmış işleri görebilir' using errcode = '42501';
  end if;
  if to_regclass('cron.job') is null then
    return;
  end if;
  return query
    select j.jobname::text, j.schedule::text, j.command::text
    from cron.job j
    where j.jobname in (
      'lexkasa-aylik-ucret', 'lexkasa-bildirimler', 'lexkasa-saklama', 'lexkasa-keepalive',
      'lexkasa-haciz', 'lexkasa-kapali-dosya'
    )
    order by j.jobname;
end $$;

revoke all on function public.list_cron_jobs() from public, anon;
grant execute on function public.list_cron_jobs() to authenticated;
