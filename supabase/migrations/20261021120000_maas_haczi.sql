-- =====================================================================================
-- Maaş haczi sıraları
--   - İşveren (müvekkil) + çalışan başına bir kayıt; altında sıralı icra dosyaları
--   - Sıra varsayılanı tebliğ tarihine göre; elle yukarı/aşağı taşınabilir
--   - İsteğe bağlı aylık maaş ödeme günü (1–31) → her gün 08:00 cron'unda kesinti hatırlatması
--   - Durum: Devam ediyor / İşten ayrıldı (+ tarih)
--   - Tutar / kalan borç tutulmaz (avukat talebi)
-- Tekrar çalıştırılabilir.
-- =====================================================================================

create table if not exists public.salary_garnishments (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null default app.current_org_id() references public.organizations (id) on delete cascade,
  client_id     uuid not null,
  employee_name text not null,
  payday        int,
  status        text not null default 'Devam ediyor',
  left_at       date,
  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid default auth.uid(),
  unique (org_id, id),
  foreign key (org_id, client_id) references public.clients (org_id, id),
  constraint salary_garnishments_employee_not_blank check (length(btrim(employee_name)) > 0),
  constraint salary_garnishments_status_check check (status in ('Devam ediyor', 'İşten ayrıldı')),
  constraint salary_garnishments_payday_check check (payday is null or payday between 1 and 31),
  constraint salary_garnishments_left_check check (
    (status = 'Devam ediyor' and left_at is null)
    or (status = 'İşten ayrıldı')
  )
);

create index if not exists salary_garnishments_org_client_idx
  on public.salary_garnishments (org_id, client_id);
create index if not exists salary_garnishments_org_status_idx
  on public.salary_garnishments (org_id, status);

create table if not exists public.salary_garnishment_entries (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null default app.current_org_id() references public.organizations (id) on delete cascade,
  queue_id        uuid not null,
  position       int not null,
  office         text not null,
  file_no        text not null,
  notified_at    date,
  note           text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  created_by     uuid default auth.uid(),
  unique (org_id, id),
  unique (queue_id, position),
  foreign key (org_id, queue_id) references public.salary_garnishments (org_id, id) on delete cascade,
  constraint salary_garnishment_entries_office_not_blank check (length(btrim(office)) > 0),
  constraint salary_garnishment_entries_file_not_blank check (length(btrim(file_no)) > 0),
  constraint salary_garnishment_entries_position_check check (position >= 1)
);

create index if not exists salary_garnishment_entries_queue_idx
  on public.salary_garnishment_entries (queue_id, position);

select app.apply_rls('salary_garnishments', 'enforcements');
select app.apply_rls('salary_garnishment_entries', 'enforcements', true);

grant select, insert, update, delete on public.salary_garnishments to authenticated;
grant select, insert, update, delete on public.salary_garnishment_entries to authenticated;
revoke all on public.salary_garnishments from anon;
revoke all on public.salary_garnishment_entries from anon;

drop trigger if exists trg_touch on public.salary_garnishments;
create trigger trg_touch before update on public.salary_garnishments
  for each row execute function app.touch_updated_at();
drop trigger if exists trg_force_org on public.salary_garnishments;
create trigger trg_force_org before insert or update on public.salary_garnishments
  for each row execute function app.force_org();
drop trigger if exists trg_touch on public.salary_garnishment_entries;
create trigger trg_touch before update on public.salary_garnishment_entries
  for each row execute function app.touch_updated_at();
drop trigger if exists trg_force_org on public.salary_garnishment_entries;
create trigger trg_force_org before insert or update on public.salary_garnishment_entries
  for each row execute function app.force_org();

-- Maaş ödeme günü hatırlatması (isteğe bağlı payday dolu + Devam ediyor)
create table if not exists public.salary_payday_notices (
  org_id     uuid not null references public.organizations (id) on delete cascade,
  queue_id    uuid not null,
  pay_date   date not null,
  created_at timestamptz not null default now(),
  primary key (org_id, queue_id, pay_date)
);
alter table public.salary_payday_notices enable row level security;
revoke all on public.salary_payday_notices from anon, authenticated;

create or replace function app.cron_salary_payday_reminders() returns int
language plpgsql security definer set search_path = '' as $$
declare r record; v_n int := 0; k int; v_today date; v_dom int; v_last int;
begin
  for r in select id, timezone from public.organizations where active loop
    v_today := (now() at time zone r.timezone)::date;
    v_dom := extract(day from v_today)::int;
    v_last := extract(day from (date_trunc('month', v_today) + interval '1 month - 1 day'))::int;

    with due as (
      select q.id, q.employee_name, q.payday, c.name as employer
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
    select r.id, p.id,
           'Maaş haczi kesinti günü',
           due.employer || ' · ' || due.employee_name || ' · ayın ' || due.payday || '. günü',
           'Maaş haczi',
           '/icra/maas-haczi',
           'maas-payday:' || due.id || ':' || v_today
    from due
    join fresh on fresh.queue_id = due.id
    join public.profiles p on p.org_id = r.id and p.active
      and app.can_user(p.id, 'enforcements', 'view')
    on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
    get diagnostics k = row_count; v_n := v_n + k;

    delete from public.salary_payday_notices
      where org_id = r.id and pay_date < v_today - 400;
  end loop;
  return v_n;
end $$;
revoke all on function app.cron_salary_payday_reminders() from public, anon, authenticated;

create or replace function app.cron_icra_daily() returns int
language plpgsql security definer set search_path = '' as $$
begin
  return app.cron_seizure_reminders()
       + app.cron_icra_deadlines()
       + app.cron_salary_payday_reminders();
end $$;
revoke all on function app.cron_icra_daily() from public, anon, authenticated;

do $$
begin
  if to_regclass('cron.job') is not null then
    perform cron.unschedule(jobid) from cron.job where jobname = 'lexkasa-haciz';
    perform cron.schedule('lexkasa-haciz', '0 5 * * *', 'select app.cron_icra_daily()');
  end if;
end $$;
