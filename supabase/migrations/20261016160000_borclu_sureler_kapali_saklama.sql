-- =====================================================================================
-- 1) Borçlu olduğumuz dosyalarda da süre hatırlatması
--    Ödeme emri tebliğinden itibaren takip şeklinin süresi (Örnek No) dolmadan 2 gün önce,
--    ve son gün hatırlatılır ("İtiraz / ödeme süresi"). Alacaklı tarafındaki süreler aynen kalır.
-- 2) Kapalı dava dosyaları büro açıkça silmedikçe silinmez
--    closed_case_retention_months = 0 → otomatik silme yok (yeni varsayılan). 1-120 verilirse
--    o kadar ay sonra eskisi gibi silinir. Mevcut büroların ayarı 0'a çekilir.
-- Tekrar çalıştırılabilir.
-- =====================================================================================

create or replace view public.v_icra_deadlines with (security_invoker = true) as
with s as (
  select org_id, seizure_valid_months as m, seizure_reminder_days as lead, procedures,
         bank_response_days as bd, salary_response_days as sd
  from public.org_settings
),
en as (
  select * from public.enforcements
  where status not in ('Kapalı', 'Kapandı', 'Tahsil edildi')
)
-- Kesinleştirme / tahliye: ödeme emri tebliğ tarihi + takip şeklinin süresi + 1 gün
select 'teb:' || ev.id as id, ev.org_id, ev.enforcement_id, ev.id as event_id, ev.debtor_id,
       case when en.side = 'Borçlu' then 'İtiraz / ödeme süresi'
            else coalesce(pr.p ->> 'action', 'Kesinleştirme') end as kind,
       ev.date as base_date,
       -- Borçlu olduğumuz dosyada son gün tebliğ + süre; 2 gün önceden hatırlatılır
       case when en.side = 'Borçlu' then ev.date + (pr.p ->> 'days')::int
            else ev.date + (pr.p ->> 'days')::int + 1 end as due_date,
       case when en.side = 'Borçlu' then ev.date + (pr.p ->> 'days')::int - 2
            else ev.date + (pr.p ->> 'days')::int + 1 end as remind_from,
       (coalesce(ev.data, '{}'::jsonb) ? 'doneAt'
        or (en.side = 'Alacaklı' and exists (select 1 from public.enforcement_events l
                   where l.enforcement_id = ev.enforcement_id and l.date >= ev.date and l.id <> ev.id
                     and l.type = case when pr.p ->> 'action' = 'Tahliye' then 'Tahliye talebi' else 'Kesinleşme' end))
       ) as resolved
from public.enforcement_events ev
join en on en.id = ev.enforcement_id and en.org_id = ev.org_id
join s on s.org_id = ev.org_id
cross join lateral (
  select x as p from jsonb_array_elements(s.procedures) x where x ->> 'name' = en.procedure limit 1
) pr
where ev.type = 'Ödeme emri tebliği' and (pr.p ->> 'days') is not null
union all
-- Haciz yenileme: son haciz + süre; süre dolmadan "lead" gün önce hatırlatılır
select 'hz:' || en.id || ':' || (en.last_seizure_date + make_interval(months => s.m))::date,
       en.org_id, en.id, null, null, 'Haciz yenileme', en.last_seizure_date,
       (en.last_seizure_date + make_interval(months => s.m))::date,
       (en.last_seizure_date + make_interval(months => s.m))::date - s.lead,
       false
from en join s on s.org_id = en.org_id
where en.last_seizure_date is not null and en.side = 'Alacaklı'
union all
-- 89/2: 89/1 haciz ihbarnamesinden "bd" gün sonra cevap vermeyen banka varsa
select 'b89:' || ev.id, ev.org_id, ev.enforcement_id, ev.id, ev.debtor_id, '89/2 haciz ihbarnamesi', ev.date,
       ev.date + s.bd + 1, ev.date + s.bd + 1,
       (coalesce(ev.data, '{}'::jsonb) ? 'doneAt'
        or (jsonb_array_length(coalesce(ev.data -> 'banks', '[]'::jsonb)) > 0
            and not exists (select 1 from jsonb_array_elements(ev.data -> 'banks') b
                            where jsonb_array_length(coalesce(b -> 'answers', '[]'::jsonb)) = 0))
        or exists (select 1 from public.enforcement_events l
                   where l.enforcement_id = ev.enforcement_id and l.date >= ev.date and l.id <> ev.id
                     and l.type = '89/2 haciz ihbarnamesi'))
from public.enforcement_events ev
join en on en.id = ev.enforcement_id and en.org_id = ev.org_id
join s on s.org_id = ev.org_id
where ev.type = '89/1 haciz ihbarnamesi' and en.side = 'Alacaklı'
union all
-- Maaş haczi: işverene tebliğden "sd" gün sonra ödeme gelmediyse işveren borçlu eklenir
select 'maas:' || ev.id, ev.org_id, ev.enforcement_id, ev.id, ev.debtor_id, 'İşveren borçlu ekleme', ev.date,
       ev.date + s.sd + 1, ev.date + s.sd + 1,
       (coalesce(ev.data, '{}'::jsonb) ? 'doneAt'
        or exists (select 1 from public.enforcement_events l
                   where l.enforcement_id = ev.enforcement_id and l.date >= ev.date and l.id <> ev.id
                     and l.type = 'Borçlu ekleme talebi'))
from public.enforcement_events ev
join en on en.id = ev.enforcement_id and en.org_id = ev.org_id
join s on s.org_id = ev.org_id
where ev.type = 'Maaş haczi tebliği' and en.side = 'Alacaklı'
union all
-- Taksit / ödeme sözü günü
select 'prm:' || pp.id, pp.org_id, pp.enforcement_id, null, pp.debtor_id, 'Taksit / ödeme sözü', pp.due_date,
       pp.due_date, pp.due_date, false
from public.payment_promises pp
join en on en.id = pp.enforcement_id and en.org_id = pp.org_id
where pp.status = 'Bekliyor' and en.side = 'Alacaklı';

grant select on public.v_icra_deadlines to authenticated;
revoke all on public.v_icra_deadlines from anon;

-- Haciz yenileme ayrı işte (app.cron_seizure_reminders); burada diğer süreler.
-- Hatırlatma günü geldiğinde (ve en geç 3 gün sonrasına kadar) dosyanın sorumlularına bir kez gider.
create or replace function app.cron_icra_deadlines() returns int
language plpgsql security definer set search_path = '' as $$
declare r record; v_n int := 0; k int; v_today date;
begin
  for r in select id, timezone from public.organizations where active loop
    v_today := (now() at time zone r.timezone)::date;
    with due as (
      select d.*, en.no, en.office, en.responsible_ids
      from public.v_icra_deadlines d
      join public.enforcements en on en.id = d.enforcement_id and en.org_id = d.org_id
      where d.org_id = r.id and not d.resolved and d.kind <> 'Haciz yenileme'
        and d.remind_from <= v_today and v_today <= d.due_date + 3
    ),
    fresh as (
      insert into public.icra_deadline_notices (org_id, key)
      select r.id, due.id from due
      on conflict do nothing
      returning key
    )
    insert into public.notifications (org_id, user_id, title, detail, type, link, dedupe_key)
    select r.id, rcpt.uid,
           case due.kind
             when 'Kesinleştirme' then 'Kesinleştirme zamanı'
             when 'Tahliye' then 'Tahliye talebi zamanı'
             when 'İtiraz / ödeme süresi' then 'İtiraz / ödeme süresi doluyor'
             when '89/2 haciz ihbarnamesi' then '89/2 gönderilmeli: cevap vermeyen banka var'
             when 'İşveren borçlu ekleme' then 'Maaş haczi: işveren borçlu eklenmeli'
             else 'Bugün taksit / ödeme sözü günü'
           end,
           due.no || ' · ' || due.office || ' · ' || to_char(due.due_date, 'DD.MM.YYYY'),
           'İcra süresi', '/icra/' || due.enforcement_id,
           'sure:' || due.id
    from due
    join fresh on fresh.key = due.id
    cross join lateral (
      select p.id as uid from public.profiles p
      where p.org_id = r.id and p.active
        and (p.id = any (due.responsible_ids)
             or (p.role = 'admin' and not exists (
                   select 1 from public.profiles q
                   where q.org_id = r.id and q.active and q.id = any (due.responsible_ids))))
    ) rcpt
    on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
    get diagnostics k = row_count; v_n := v_n + k;

    delete from public.icra_deadline_notices where org_id = r.id and created_at < now() - interval '400 days';
  end loop;
  return v_n;
end $$;
revoke all on function app.cron_icra_deadlines() from public, anon, authenticated;

-- ---- Kapalı dosyalar: otomatik silme kapalı (0) olabilir ------------------------------------
alter table public.org_settings drop constraint if exists org_settings_closed_case_months_check;
alter table public.org_settings
  add constraint org_settings_closed_case_months_check check (closed_case_retention_months between 0 and 120);
alter table public.org_settings alter column closed_case_retention_months set default 0;
update public.org_settings set closed_case_retention_months = 0 where closed_case_retention_months = 12;

create or replace function app.cron_purge_closed_cases() returns int
language plpgsql security definer set search_path = '' as $$
declare r record; x record; v_n int := 0; v_today date;
begin
  for r in
    select o.id, o.timezone, coalesce(s.closed_case_retention_months, 0) as months
    from public.organizations o
    left join public.org_settings s on s.org_id = o.id
    where o.active and coalesce(s.closed_case_retention_months, 0) > 0
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
