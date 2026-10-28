-- =====================================================================================
-- Masraf iadesi: büronun müvekkil adına ödediği masrafı müvekkil sonradan öder
--   - expenses.reimbursed_on: müvekkilin ödediği tarih (boşsa henüz alınmadı)
--   - expenses.reimbursed_account_id: paranın girdiği hesap (isteğe bağlı)
--   - v_client_balances: iade tarihinde cariye alacak yazılır
--   - v_account_balances: iade, girdiği hesaba giriş olarak yazılır
-- Tekrar çalıştırılabilir.
-- =====================================================================================

alter table public.expenses add column if not exists reimbursed_on date;
alter table public.expenses add column if not exists reimbursed_account_id uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'expenses_reimbursed_account_fk') then
    alter table public.expenses add constraint expenses_reimbursed_account_fk
      foreign key (org_id, reimbursed_account_id) references public.accounts (org_id, id);
  end if;
end $$;

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
    , 2) as balance
  from public.accounts a
  where a.org_id = app.current_org_id() and app.can('accounts', 'view');

create or replace view public.v_client_balances
with (security_invoker = true) as
  with charged as (
    select e.org_id, e.amount, e.reimbursed_on,
      coalesce(e.client_id, cs.client_id,
        (select en.client_id from public.enforcements en where en.id = e.enforcement_id and en.org_id = e.org_id)) as client_id
    from public.expenses e
    left join public.cases cs on cs.id = e.case_id and cs.org_id = e.org_id
    where e.charge_to = 'Müvekkil' and e.paid_by = 'Büro'
  )
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
      coalesce((select sum(x.amount) from charged x where x.org_id = c.org_id and x.client_id = c.id), 0)
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
      + coalesce((select sum(x.amount) from charged x
                  where x.org_id = c.org_id and x.client_id = c.id and x.reimbursed_on is not null), 0)
      + c.closed_payable
    , 2) as credit
  ) k
  where c.org_id = app.current_org_id() and app.can('ledger', 'view');

grant select on public.v_account_balances, public.v_client_balances to authenticated;

-- Dosya kapatma: iade edilen masraf cariye alacak, girdiği hesaba giriş olarak hesaplanır
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
    + coalesce((select sum(e.amount) from public.expenses e where e.org_id = v_org and e.case_id = p_case
                and e.charge_to = 'Müvekkil' and e.paid_by = 'Büro' and e.reimbursed_on is not null), 0)
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
      union all
      select e.reimbursed_account_id, e.amount from public.expenses e
        where e.org_id = v_org and e.case_id = p_case and e.reimbursed_on is not null
          and e.reimbursed_account_id is not null and e.charge_to = 'Müvekkil' and e.paid_by = 'Büro'
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
