-- =====================================================================================
-- Maaş haczi: kayda sorumlu avukat eklenir; ödeme günü hatırlatması yalnızca sorumlulara,
-- sorumlu yoksa yöneticilere gider (diğer icra hatırlatmalarıyla aynı kural).
-- Eskiden icra görme yetkisi olan herkese gidiyordu. Tekrar çalıştırılabilir.
-- =====================================================================================

alter table public.salary_garnishments
  add column if not exists responsible_ids uuid[] not null default '{}';

create or replace function app.cron_salary_payday_reminders() returns int
language plpgsql security definer set search_path = '' as $$
declare r record; v_n int := 0; k int; v_today date; v_dom int; v_last int;
begin
  for r in select id, timezone from public.organizations where active loop
    v_today := (now() at time zone r.timezone)::date;
    v_dom := extract(day from v_today)::int;
    v_last := extract(day from (date_trunc('month', v_today) + interval '1 month - 1 day'))::int;

    with due as (
      select q.id, q.employee_name, q.payday, q.responsible_ids, c.name as employer
      from public.salary_garnishments q
      join public.clients c on c.id = q.client_id and c.org_id = q.org_id
      where q.org_id = r.id
        and q.status = 'Devam ediyor'
        and q.payday is not null
        and (
          q.payday = v_dom
          or (q.payday > v_last and v_dom = v_last)
        )
    ),
    fresh as (
      insert into public.salary_payday_notices (org_id, queue_id, pay_date)
      select r.id, due.id, v_today from due
      on conflict do nothing
      returning queue_id
    )
    insert into public.notifications (org_id, user_id, title, detail, type, link, dedupe_key)
    select r.id, rcpt.uid,
           'Maaş haczi kesinti günü',
           due.employer || ' · ' || due.employee_name || ' · ayın ' || due.payday || '. günü',
           'Maaş haczi',
           '/icra/maas-haczi',
           'maas-payday:' || due.id || ':' || v_today
    from due
    join fresh on fresh.queue_id = due.id
    cross join lateral (
      select p.id as uid from public.profiles p
      where p.org_id = r.id and p.active
        and (p.id = any (due.responsible_ids)
             or (p.role = 'admin' and not exists (
                   select 1 from public.profiles x
                   where x.org_id = r.id and x.active and x.id = any (due.responsible_ids))))
    ) rcpt
    on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
    get diagnostics k = row_count; v_n := v_n + k;

    delete from public.salary_payday_notices
      where org_id = r.id and pay_date < v_today - 400;
  end loop;
  return v_n;
end $$;
revoke all on function app.cron_salary_payday_reminders() from public, anon, authenticated;
