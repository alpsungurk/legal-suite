-- =====================================================================================
-- İcra süreleri (avukatın "İcra Örnek Liste Talimat.xlsx" dosyası)
--   - Takip şekli (Örnek No: 2 … 44) ve her şeklin süre kuralı (Ayarlar'dan değiştirilebilir)
--   - Kapanış sebebi (Yetkisizlik, Takipsizlik, Vazgeçme/Feragat, Takibin İptali, İnfaz, Haricen Tahsil)
--   - Takip bilgileri için hazır seçenekler (elle yazılabilir)
--   - İşlem geçmişinde yapılandırılmış veri: sorgu sonuçları (7 başlık), 89/1 bankaları ve cevapları
--   - Süreler: kesinleştirme / tahliye (tebliğ + şeklin süresi + 1 gün), haciz yenileme,
--     89/2 (89/1'den 13 gün sonra cevapsız banka), işveren borçlu ekleme (maaş haczi tebliğinden 31. gün),
--     taksit / ödeme sözü günleri → her gün 08:00'de dosya sorumlularına bildirim
-- Tekrar çalıştırılabilir. Mevcut kayıtlar değişmez.
-- =====================================================================================

-- ---- 1. İcra dosyası: takip şekli ve kapanış sebebi -------------------------------------------
alter table public.enforcements add column if not exists procedure text;
alter table public.enforcements add column if not exists close_reason text;

-- ---- 2. İşlem geçmişi: yapılandırılmış veri ---------------------------------------------------
-- Sorgu: {"inquiry": {"arac": 2, "tasinmaz": 1, "icra": 0, "banka": 3, "bankalar": "Ziraat, İş", "sgk": "Aktif", "mosip": "Pasif", "firma": 1}}
-- 89/1:  {"banks": [{"name": "Ziraat", "answers": ["Olumsuz"]}, {"name": "Garanti", "answers": []}]}
-- Süre işlendi olarak işaretlendiyse: {"doneAt": "2026-10-20"}
alter table public.enforcement_events add column if not exists data jsonb;

-- ---- 3. Büro ayarları -------------------------------------------------------------------------
alter table public.org_settings add column if not exists enforcement_close_reasons text[] not null
  default '{Yetkisizlik,Takipsizlik,"Vazgeçme/Feragat","Takibin İptali",İnfaz,"Haricen Tahsil"}';
alter table public.org_settings add column if not exists claim_types text[] not null
  default '{"Araç Mahrumiyet Bedeli Alacağı","Dekont Alacağı","Kira Alacağı","Çek Alacağı","Senet Alacağı","Bono Alacağı","Fatura Alacağı","Ürün Bedeli Alacağı","İlam Vekalet Ücreti Alacağı"}';
alter table public.org_settings add column if not exists bank_answer_types text[] not null
  default '{Hacizli,Rehinli,Olumsuz,"Tahsil edilebilir"}';
alter table public.org_settings add column if not exists bank_response_days int not null default 13;
alter table public.org_settings add column if not exists salary_response_days int not null default 30;
-- Takip şekilleri: ödeme emri tebliğinden itibaren süre (gün) ve süre bitince yapılacak iş
alter table public.org_settings add column if not exists procedures jsonb not null default '[
  {"name": "Örnek No: 2",  "days": 7,  "action": "Kesinleştirme"},
  {"name": "Örnek No: 3",  "days": null, "action": null},
  {"name": "Örnek No: 4-5","days": 7,  "action": "Kesinleştirme"},
  {"name": "Örnek No: 6",  "days": 30, "action": "Kesinleştirme"},
  {"name": "Örnek No: 7",  "days": 7,  "action": "Kesinleştirme"},
  {"name": "Örnek No: 8",  "days": 15, "action": "Kesinleştirme"},
  {"name": "Örnek No: 9",  "days": 30, "action": "Kesinleştirme"},
  {"name": "Örnek No: 10", "days": 10, "action": "Kesinleştirme"},
  {"name": "Örnek No: 11", "days": null, "action": null},
  {"name": "Örnek No: 12", "days": null, "action": null},
  {"name": "Örnek No: 13", "days": 30, "action": "Kesinleştirme"},
  {"name": "Örnek No: 13 (hasılat kirası)", "days": 60, "action": "Kesinleştirme"},
  {"name": "Örnek No: 14", "days": 15, "action": "Tahliye"},
  {"name": "Örnek No: 44", "days": null, "action": null}
]'::jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'org_settings_bank_days_check') then
    alter table public.org_settings
      add constraint org_settings_bank_days_check check (bank_response_days between 1 and 120);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'org_settings_salary_days_check') then
    alter table public.org_settings
      add constraint org_settings_salary_days_check check (salary_response_days between 1 and 120);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'org_settings_procedures_check') then
    alter table public.org_settings
      add constraint org_settings_procedures_check check (jsonb_typeof(procedures) = 'array');
  end if;
end $$;

-- Durdurulma sebepleri ve işlem türleri: talimattaki değerler eklenir (eskiler korunur)
alter table public.org_settings alter column enforcement_stop_reasons
  set default '{"Takibe İtiraz","İcra Mahkemesine İtiraz","İhtiyati Tedbir","Tehir-i İcra Kararı",Diğer}';
alter table public.org_settings alter column enforcement_event_types
  set default '{"Ödeme emri tebliği","Ödeme emri iadesi",İtiraz,Kesinleşme,Sorgu,Haciz,"Maaş haczi tebliği","89/1 haciz ihbarnamesi","89/2 haciz ihbarnamesi","Banka cevabı","Borçlu ekleme talebi","Tahliye talebi","Taksitli anlaşma","Haricen tahsil talebi","Kesinleştirme talebi",Diğer}';

select set_config('app.skip_audit', '1', true);
update public.org_settings s
   set enforcement_stop_reasons = s.enforcement_stop_reasons || (
         select coalesce(array_agg(u.x order by u.ord), '{}')
         from unnest(array['Takibe İtiraz', 'İcra Mahkemesine İtiraz', 'İhtiyati Tedbir', 'Tehir-i İcra Kararı', 'Diğer'])
              with ordinality as u(x, ord)
         where not (u.x = any (s.enforcement_stop_reasons))
       ),
       enforcement_event_types = s.enforcement_event_types || (
         select coalesce(array_agg(u.x order by u.ord), '{}')
         from unnest(array['Kesinleşme', 'Maaş haczi tebliği', '89/1 haciz ihbarnamesi', '89/2 haciz ihbarnamesi',
                           'Tahliye talebi', 'Taksitli anlaşma', 'Haricen tahsil talebi'])
              with ordinality as u(x, ord)
         where not (u.x = any (s.enforcement_event_types))
       );
select set_config('app.skip_audit', '', true);

-- ---- 4. Ayar koruması: yeni kolonlar "Kategoriler" bölümüne bağlı -----------------------------
create or replace function app.guard_settings_update() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  k text; o jsonb := to_jsonb(old); n jsonb := to_jsonb(new);
  old_arr text[]; new_arr text[]; old_map jsonb; new_map jsonb;
  added boolean; removed boolean; changed boolean;
begin
  if auth.uid() is null or app.is_admin() then return new; end if;
  for k in select jsonb_object_keys(n) loop
    if k = 'updated_at' or n -> k is not distinct from o -> k then continue; end if;

    if k = 'firm' then
      if not app.can('settings_firm', 'edit') then
        raise exception 'Bu ayarı değiştirme yetkiniz yok (%)', k using errcode = '42501';
      end if;

    elsif k in (
      'case_types', 'case_statuses', 'expense_types', 'reminder_types', 'document_categories',
      'fee_kinds', 'payment_methods', 'enforcement_statuses', 'enforcement_types', 'contact_channels',
      'courts', 'enforcement_offices', 'enforcement_stop_reasons', 'inquiry_types', 'seizure_types',
      'result_types', 'enforcement_event_types', 'enforcement_close_reasons', 'claim_types', 'bank_answer_types'
    ) then
      old_arr := array(select jsonb_array_elements_text(o -> k));
      new_arr := array(select jsonb_array_elements_text(n -> k));
      added   := exists (select 1 from unnest(new_arr) x where x <> all (old_arr));
      removed := exists (select 1 from unnest(old_arr) x where x <> all (new_arr));
      if added and not app.can('settings_categories', 'create') then
        raise exception 'Listeye değer ekleme yetkiniz yok (%)', k using errcode = '42501';
      end if;
      if removed and not app.can('settings_categories', 'delete') then
        raise exception 'Listeden değer silme yetkiniz yok (%)', k using errcode = '42501';
      end if;
      if not added and not removed and not app.can('settings_categories', 'edit') then
        raise exception 'Bu ayarı değiştirme yetkiniz yok (%)', k using errcode = '42501';
      end if;

    elsif k in ('seizure_valid_months', 'seizure_reminder_days', 'closed_case_retention_months',
                'bank_response_days', 'salary_response_days', 'procedures') then
      if not app.can('settings_categories', 'edit') then
        raise exception 'Bu ayarı değiştirme yetkiniz yok (%)', k using errcode = '42501';
      end if;

    elsif k = 'company_lists' then
      old_map := coalesce((select jsonb_object_agg(e ->> 'id', e) from jsonb_array_elements(o -> k) e), '{}'::jsonb);
      new_map := coalesce((select jsonb_object_agg(e ->> 'id', e) from jsonb_array_elements(n -> k) e), '{}'::jsonb);
      added   := exists (select 1 from jsonb_object_keys(new_map) i where not old_map ? i);
      removed := exists (select 1 from jsonb_object_keys(old_map) i where not new_map ? i);
      changed := exists (select 1 from jsonb_each(new_map) j where old_map ? j.key and old_map -> j.key is distinct from j.value);
      if added and not app.can('settings_companies', 'create') then
        raise exception 'Şirket listesi ekleme yetkiniz yok' using errcode = '42501';
      end if;
      if removed and not app.can('settings_companies', 'delete') then
        raise exception 'Şirket listesi silme yetkiniz yok' using errcode = '42501';
      end if;
      if (changed or (not added and not removed)) and not app.can('settings_companies', 'edit') then
        raise exception 'Şirket listesini düzenleme yetkiniz yok' using errcode = '42501';
      end if;

    else
      raise exception 'Bu ayarı yalnızca yönetici değiştirebilir (%)', k using errcode = '42501';
    end if;
  end loop;
  return new;
end $$;

-- ---- 5. Süreler: tek kaynak (uygulamadaki hesap da aynı kuralları kullanır) ---------------------
-- Yalnızca alacaklı olduğumuz, kapanmamış dosyalar. remind_from: hatırlatmanın başladığı gün.
create or replace view public.v_icra_deadlines with (security_invoker = true) as
with s as (
  select org_id, seizure_valid_months as m, seizure_reminder_days as lead, procedures,
         bank_response_days as bd, salary_response_days as sd
  from public.org_settings
),
en as (
  select * from public.enforcements
  where side = 'Alacaklı' and status not in ('Kapalı', 'Kapandı', 'Tahsil edildi')
)
-- Kesinleştirme / tahliye: ödeme emri tebliğ tarihi + takip şeklinin süresi + 1 gün
select 'teb:' || ev.id as id, ev.org_id, ev.enforcement_id, ev.id as event_id, ev.debtor_id,
       coalesce(pr.p ->> 'action', 'Kesinleştirme') as kind, ev.date as base_date,
       ev.date + (pr.p ->> 'days')::int + 1 as due_date,
       ev.date + (pr.p ->> 'days')::int + 1 as remind_from,
       (coalesce(ev.data, '{}'::jsonb) ? 'doneAt'
        or exists (select 1 from public.enforcement_events l
                   where l.enforcement_id = ev.enforcement_id and l.date >= ev.date and l.id <> ev.id
                     and l.type = case when pr.p ->> 'action' = 'Tahliye' then 'Tahliye talebi' else 'Kesinleşme' end)
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
where en.last_seizure_date is not null
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
where ev.type = '89/1 haciz ihbarnamesi'
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
where ev.type = 'Maaş haczi tebliği'
union all
-- Taksit / ödeme sözü günü
select 'prm:' || pp.id, pp.org_id, pp.enforcement_id, null, pp.debtor_id, 'Taksit / ödeme sözü', pp.due_date,
       pp.due_date, pp.due_date, false
from public.payment_promises pp
join en on en.id = pp.enforcement_id and en.org_id = pp.org_id
where pp.status = 'Bekliyor';

grant select on public.v_icra_deadlines to authenticated;
revoke all on public.v_icra_deadlines from anon;

-- ---- 6. Günlük süre bildirimi -----------------------------------------------------------------
create table if not exists public.icra_deadline_notices (
  org_id     uuid not null references public.organizations (id) on delete cascade,
  key        text not null,
  created_at timestamptz not null default now(),
  primary key (org_id, key)
);
alter table public.icra_deadline_notices enable row level security;
revoke all on public.icra_deadline_notices from anon, authenticated;

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

-- Günlük iş: haciz hatırlatması + diğer icra süreleri (her gün 08:00 TR)
create or replace function app.cron_icra_daily() returns int
language plpgsql security definer set search_path = '' as $$
begin
  return app.cron_seizure_reminders() + app.cron_icra_deadlines();
end $$;
revoke all on function app.cron_icra_daily() from public, anon, authenticated;

do $$
begin
  if to_regclass('cron.job') is not null then
    perform cron.unschedule(jobid) from cron.job where jobname = 'lexkasa-haciz';
    perform cron.schedule('lexkasa-haciz', '0 5 * * *', 'select app.cron_icra_daily()');
  else
    raise notice 'pg_cron yok: icra süreleri işi kurulmadı. Database > Extensions > pg_cron açıp bu dosyayı yeniden çalıştırın.';
  end if;
end $$;
