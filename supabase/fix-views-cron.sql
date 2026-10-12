-- 1) Bakiye/taksit/cari view: security_invoker (UNRESTRICTED gider)
--    v_account_options bilinçli DEFINER kalır (masraf formunda avukat hesap seçer)
-- 2) Cron saatlerini Ayarlar'da salt okunur göstermek için list_cron_jobs

create or replace view public.v_account_options as
  select a.id, a.org_id, a.name, a.type, a.active
  from public.accounts a
  where a.org_id = app.current_org_id();

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
    , 2) as balance
  from public.accounts a
  where a.org_id = app.current_org_id() and app.can('accounts', 'view');

create or replace view public.v_installments
with (security_invoker = true) as
  with x as (
    select
      i.id, i.org_id, i.plan_id, i.position, i.due_date, i.amount,
      coalesce((select sum(p.amount) from public.installment_payments p where p.installment_id = i.id), 0) as paid,
      (now() at time zone o.timezone)::date as today
    from public.installments i
    join public.organizations o on o.id = i.org_id
  )
  select
    x.id, x.org_id, x.plan_id, fp.client_id, fp.case_id, fp.title as plan_title, x.position, x.due_date, x.amount,
    x.paid,
    greatest(round(x.amount - x.paid, 2), 0) as remaining,
    case
      when x.paid >= x.amount - 0.005 then 'Ödendi'
      when x.due_date < x.today then 'Gecikmiş'
      when x.paid > 0 then 'Kısmi'
      else 'Bekliyor'
    end as status,
    fp.cancelled
  from x
  join public.fee_plans fp on fp.id = x.plan_id and fp.org_id = x.org_id
  where x.org_id = app.current_org_id() and app.can('fees', 'view');

create or replace view public.v_client_balances
with (security_invoker = true) as
  select
    c.id as client_id, c.org_id, c.name,
    d.debit, k.credit,
    round(d.debit - k.credit, 2) as balance,
    case
      when d.debit - k.credit > 0.005 then 'Borçlu'
      when d.debit - k.credit < -0.005 then 'Alacaklı'
      else 'Kapalı'
    end as status
  from public.clients c
  cross join lateral (
    select round(
      coalesce((select sum(e.amount) from public.expenses e
                left join public.cases cs on cs.id = e.case_id and cs.org_id = e.org_id
                where e.org_id = c.org_id and e.charge_to = 'Müvekkil' and e.paid_by = 'Büro'
                  and coalesce(e.client_id, cs.client_id, (select en.client_id from public.enforcements en where en.id = e.enforcement_id and en.org_id = e.org_id)) = c.id), 0)
      + coalesce((select sum(fp.total) from public.fee_plans fp where fp.org_id = c.org_id and fp.client_id = c.id and not fp.cancelled), 0)
      + coalesce((select sum(abs(t.amount)) from public.account_transactions t where t.org_id = c.org_id and t.client_id = c.id and t.category = 'Müvekkile aktarım'), 0)
      + c.closed_receivable
    , 2) as debit
  ) d
  cross join lateral (
    select round(
      coalesce((select sum(p.amount) from public.installment_payments p
                join public.installments i on i.id = p.installment_id and i.org_id = p.org_id
                join public.fee_plans fp on fp.id = i.plan_id and fp.org_id = i.org_id
                where p.org_id = c.org_id and fp.client_id = c.id and not fp.cancelled), 0)
      + coalesce((select sum(co.amount) from public.collections co
                  join public.enforcements en on en.id = co.enforcement_id and en.org_id = co.org_id
                  where co.org_id = c.org_id and en.client_id = c.id), 0)
      + c.closed_payable
    , 2) as credit
  ) k
  where c.org_id = app.current_org_id() and app.can('ledger', 'view');

grant select on public.v_account_options, public.v_account_balances, public.v_installments, public.v_client_balances to authenticated;

drop function if exists public.set_cron_job(text, text);

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
      'lexkasa-aylik-ucret', 'lexkasa-bildirimler', 'lexkasa-saklama', 'lexkasa-keepalive'
    )
    order by j.jobname;
end $$;

revoke all on function public.list_cron_jobs() from public, anon;
grant execute on function public.list_cron_jobs() to authenticated;
