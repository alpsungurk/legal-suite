-- =====================================================================================
-- 89/1 → 89/2 → 89/3 → menfi tespit yoksa banka haczi kesinleşme
--   - Varsayılan banka cevap süresi 15 gün (hatırlatma = gün + 1 → 16. gün)
--   - İşlem türü: 89/3 haciz ihbarnamesi
--   - v_icra_deadlines + cron bildirim başlıkları
-- Tekrar çalıştırılabilir. Mevcut süre ayarları değiştirilmez (yalnızca kolon varsayılanı).
-- =====================================================================================

alter table public.org_settings alter column bank_response_days set default 15;

-- Varsayılan işlem türleri listesine 89/3
alter table public.org_settings alter column enforcement_event_types
  set default '{"Ödeme emri tebliği","Ödeme emri iadesi",İtiraz,Kesinleşme,Sorgu,Haciz,"Maaş haczi tebliği","89/1 haciz ihbarnamesi","89/2 haciz ihbarnamesi","89/3 haciz ihbarnamesi","Banka cevabı","Borçlu ekleme talebi","Tahliye talebi","Taksitli anlaşma","Haricen tahsil talebi","Kesinleştirme talebi",Diğer}';

select set_config('app.skip_audit', '1', true);
update public.org_settings
   set enforcement_event_types = enforcement_event_types || array['89/3 haciz ihbarnamesi']
 where not ('89/3 haciz ihbarnamesi' = any (enforcement_event_types));
select set_config('app.skip_audit', '', true);

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
-- Kesinleştirme / tahliye / itiraz-ödeme
select 'teb:' || ev.id as id, ev.org_id, ev.enforcement_id, ev.id as event_id, ev.debtor_id,
       case when en.side = 'Borçlu' then 'İtiraz / ödeme süresi'
            else coalesce(pr.p ->> 'action', 'Kesinleştirme') end as kind,
       ev.date as base_date,
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
-- Haciz yenileme
select 'hz:' || en.id || ':' || (en.last_seizure_date + make_interval(months => s.m))::date,
       en.org_id, en.id, null, null, 'Haciz yenileme', en.last_seizure_date,
       (en.last_seizure_date + make_interval(months => s.m))::date,
       (en.last_seizure_date + make_interval(months => s.m))::date - s.lead,
       false
from en join s on s.org_id = en.org_id
where en.last_seizure_date is not null and en.side = 'Alacaklı'
union all
-- 89/1 → 89/2
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
-- 89/2 → 89/3
select 'b892:' || ev.id, ev.org_id, ev.enforcement_id, ev.id, ev.debtor_id, '89/3 haciz ihbarnamesi', ev.date,
       ev.date + s.bd + 1, ev.date + s.bd + 1,
       (coalesce(ev.data, '{}'::jsonb) ? 'doneAt'
        or (jsonb_array_length(coalesce(ev.data -> 'banks', '[]'::jsonb)) > 0
            and not exists (select 1 from jsonb_array_elements(ev.data -> 'banks') b
                            where jsonb_array_length(coalesce(b -> 'answers', '[]'::jsonb)) = 0))
        or exists (select 1 from public.enforcement_events l
                   where l.enforcement_id = ev.enforcement_id and l.date >= ev.date and l.id <> ev.id
                     and l.type = '89/3 haciz ihbarnamesi'))
from public.enforcement_events ev
join en on en.id = ev.enforcement_id and en.org_id = ev.org_id
join s on s.org_id = ev.org_id
where ev.type = '89/2 haciz ihbarnamesi' and en.side = 'Alacaklı'
union all
-- 89/3 → menfi tespit yoksa banka haczi kesinleşme
select 'b893:' || ev.id, ev.org_id, ev.enforcement_id, ev.id, ev.debtor_id, 'Banka haczi kesinleşme', ev.date,
       ev.date + s.bd + 1, ev.date + s.bd + 1,
       (coalesce(ev.data, '{}'::jsonb) ? 'doneAt'
        or (jsonb_array_length(coalesce(ev.data -> 'banks', '[]'::jsonb)) > 0
            and not exists (select 1 from jsonb_array_elements(ev.data -> 'banks') b
                            where jsonb_array_length(coalesce(b -> 'answers', '[]'::jsonb)) = 0))
        or exists (select 1 from public.enforcement_events l
                   where l.enforcement_id = ev.enforcement_id and l.date >= ev.date and l.id <> ev.id
                     and l.type = 'Kesinleşme'))
from public.enforcement_events ev
join en on en.id = ev.enforcement_id and en.org_id = ev.org_id
join s on s.org_id = ev.org_id
where ev.type = '89/3 haciz ihbarnamesi' and en.side = 'Alacaklı'
union all
-- Maaş haczi → işveren borçlu ekleme
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
-- Taksit / ödeme sözü
select 'prm:' || pp.id, pp.org_id, pp.enforcement_id, null, pp.debtor_id, 'Taksit / ödeme sözü', pp.due_date,
       pp.due_date, pp.due_date, false
from public.payment_promises pp
join en on en.id = pp.enforcement_id and en.org_id = pp.org_id
where pp.status = 'Bekliyor' and en.side = 'Alacaklı';

grant select on public.v_icra_deadlines to authenticated;
revoke all on public.v_icra_deadlines from anon;

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
             when '89/3 haciz ihbarnamesi' then '89/3 gönderilmeli: cevap vermeyen banka var'
             when 'Banka haczi kesinleşme' then 'Menfi tespit yoksa banka haczi kesinleşmeli'
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
