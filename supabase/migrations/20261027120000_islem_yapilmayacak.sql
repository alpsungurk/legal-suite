-- =====================================================================================
-- "İşlem Yapılmayacak" dosya durumu
--   - Büronun Excel'de koyu lacivert boyadığı dosyalar: kapanmaz, ama süre / haciz
--     hatırlatması ve bildirim üretmez.
--   - Durum listesine "Kapalı"nın hemen arkasına eklenir.
--   - v_icra_deadlines ve app.cron_seizure_reminders bu durumdaki dosyaları atlar.
-- Tekrar çalıştırılabilir.
-- =====================================================================================

alter table public.org_settings alter column enforcement_statuses
  set default '{Açık,Durdurulmuş,Kapalı,"İşlem Yapılmayacak",Derdest,Haciz,Satış,"Ödeme planı","Tahsil edildi",Kapandı}';

select set_config('app.skip_audit', '1', true);
update public.org_settings s
   set enforcement_statuses = case
         when array_position(s.enforcement_statuses, 'Kapalı') is null
           then s.enforcement_statuses || array['İşlem Yapılmayacak']
         else s.enforcement_statuses[1:array_position(s.enforcement_statuses, 'Kapalı')]
              || array['İşlem Yapılmayacak']
              || s.enforcement_statuses[array_position(s.enforcement_statuses, 'Kapalı') + 1:]
       end
 where not ('İşlem Yapılmayacak' = any (s.enforcement_statuses));
select set_config('app.skip_audit', '', true);

create or replace view public.v_icra_deadlines with (security_invoker = true) as
with s as (
  select org_id, seizure_valid_months as m, seizure_reminder_days as lead, procedures,
         bank_response_days as bd, salary_response_days as sd
  from public.org_settings
),
en as (
  select * from public.enforcements
  where status not in ('Kapalı', 'Kapandı', 'Tahsil edildi', 'İşlem Yapılmayacak')
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

create or replace function app.cron_seizure_reminders() returns int
language plpgsql security definer set search_path = '' as $$
declare r record; v_n int := 0; k int; v_today date;
begin
  for r in
    select o.id, o.timezone, coalesce(s.seizure_valid_months, 12) as months,
           coalesce(s.seizure_reminder_days, 14) as lead
    from public.organizations o
    left join public.org_settings s on s.org_id = o.id
    where o.active
  loop
    v_today := (now() at time zone r.timezone)::date;

    with files as (
      select en.id, en.no, en.office, en.responsible_ids,
             (en.last_seizure_date + make_interval(months => r.months))::date as due
      from public.enforcements en
      where en.org_id = r.id
        and en.side = 'Alacaklı'
        and en.last_seizure_date is not null
        and en.status not in ('Kapalı', 'Kapandı', 'Tahsil edildi', 'İşlem Yapılmayacak')
    ),
    due_now as (
      -- önceden uyarı: pencereye girdi, henüz düşmedi
      select f.*, 'once'::text as kind from files f
      where f.due - r.lead <= v_today and v_today < f.due
      union all
      -- düşme günü (en geç 3 gün sonrasına kadar, kaçırılırsa)
      select f.*, 'gun'::text as kind from files f
      where v_today between f.due and f.due + 3
    ),
    fresh as (
      insert into public.seizure_notices (org_id, enforcement_id, due, kind)
      select r.id, d.id, d.due, d.kind from due_now d
      on conflict do nothing
      returning enforcement_id, due, kind
    )
    insert into public.notifications (org_id, user_id, title, detail, type, link, dedupe_key)
    select r.id, rcpt.uid,
           case when d.kind = 'once' then 'Haczin düşmesine ' || (d.due - v_today) || ' gün kaldı'
                when d.due = v_today then 'Haciz bugün düşüyor'
                else 'Haciz süresi doldu' end,
           d.no || ' · ' || d.office || ' · ' || to_char(d.due, 'DD.MM.YYYY'),
           'Haciz', '/icra/' || d.id,
           'haciz:' || d.id || ':' || d.due || case when d.kind = 'gun' then ':gun' else '' end
    from due_now d
    join fresh fr on fr.enforcement_id = d.id and fr.due = d.due and fr.kind = d.kind
    cross join lateral (
      select p.id as uid
      from public.profiles p
      where p.org_id = r.id and p.active
        and (
          p.id = any (d.responsible_ids)
          or (
            -- sorumlusu olmayan (ya da sorumlularının hiçbiri aktif olmayan) dosya yöneticilere gider
            p.role = 'admin'
            and not exists (
              select 1 from public.profiles q
              where q.org_id = r.id and q.active and q.id = any (d.responsible_ids)
            )
          )
        )
    ) rcpt
    on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
    get diagnostics k = row_count; v_n := v_n + k;

    -- Bir yıldan eski gönderim kayıtları gereksiz: temizlenir
    delete from public.seizure_notices where org_id = r.id and due < v_today - 365;
  end loop;
  return v_n;
end $$;

revoke all on function app.cron_seizure_reminders() from public, anon, authenticated;
