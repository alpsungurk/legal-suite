-- =====================================================================================
-- İcra modülü: avukat geri bildirimleri (AVUKAT-GERI-BILDIRIM.md)
--   - Taraf ayrımı (alacaklı olduğumuz / borçlu olduğumuz)
--   - Takip bilgileri, son haciz tarihi, durdurulma sebebi
--   - Durumlar: Açık / Durdurulmuş / Kapalı
--   - Yeni seçim listeleri (Ayarlar → Kategoriler) ve haciz süresi ayarları
--   - Şirket listeleri
--   - İcra işlem geçmişi (enforcement_events)
--   - Haczin düşmesine yaklaşan dosyalar için günlük cron bildirimi
--
-- Tekrar çalıştırılabilir. Mevcut kayıtlar silinmez; yeni kolonların hepsi varsayılanla gelir.
-- =====================================================================================

-- ---- 1. İcra dosyası alanları ---------------------------------------------------------------
alter table public.enforcements add column if not exists side text not null default 'Alacaklı';
alter table public.enforcements add column if not exists details text;
alter table public.enforcements add column if not exists last_seizure_date date;
alter table public.enforcements add column if not exists stop_reason text;
alter table public.enforcements alter column status set default 'Açık';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'enforcements_side_check') then
    alter table public.enforcements
      add constraint enforcements_side_check check (side in ('Alacaklı', 'Borçlu'));
  end if;
end $$;

create index if not exists enf_org_side_idx on public.enforcements (org_id, side);
create index if not exists enf_seizure_idx on public.enforcements (org_id, last_seizure_date)
  where last_seizure_date is not null;

-- ---- 2. Büro ayarları: yeni listeler, haciz süresi, şirket listeleri -------------------------
alter table public.org_settings add column if not exists enforcement_stop_reasons text[] not null
  default '{"Borçlu itirazı",Şikâyet,"Tedbir kararı",Diğer}';
alter table public.org_settings add column if not exists inquiry_types text[] not null
  default '{Araç,Taşınmaz,"Alacaklı olduğu icra dosyası",Banka,"SGK (maaş)","SGK Mosip (şirketler için)","Firma sorgu"}';
alter table public.org_settings add column if not exists seizure_types text[] not null
  default '{Araç,Taşınmaz,Maaş,Banka}';
alter table public.org_settings add column if not exists result_types text[] not null
  default '{Olumlu,Olumsuz,"Düşük miktar","Cevap bekleniyor"}';
alter table public.org_settings add column if not exists enforcement_event_types text[] not null
  default '{"Ödeme emri tebliği","Ödeme emri iadesi",İtiraz,"Kesinleştirme talebi",Sorgu,Haciz,"Banka cevabı","Borçlu ekleme talebi",Diğer}';
alter table public.org_settings add column if not exists seizure_valid_months int not null default 12;
alter table public.org_settings add column if not exists seizure_reminder_days int not null default 14;
alter table public.org_settings add column if not exists company_lists jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'org_settings_seizure_months_check') then
    alter table public.org_settings
      add constraint org_settings_seizure_months_check check (seizure_valid_months between 1 and 60);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'org_settings_seizure_days_check') then
    alter table public.org_settings
      add constraint org_settings_seizure_days_check check (seizure_reminder_days between 1 and 120);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'org_settings_company_lists_check') then
    alter table public.org_settings
      add constraint org_settings_company_lists_check check (jsonb_typeof(company_lists) = 'array');
  end if;
end $$;

-- Durumlar: Açık / Durdurulmuş / Kapalı ana durumlar; eski değerler listede kalır
alter table public.org_settings alter column enforcement_statuses
  set default '{Açık,Durdurulmuş,Kapalı,Derdest,Haciz,Satış,"Ödeme planı","Tahsil edildi",Kapandı}';

-- Mevcut bürolar: eksik olan ana durumlar listenin başına eklenir (bu değişiklik denetim kaydına girmez)
select set_config('app.skip_audit', '1', true);
update public.org_settings s
   set enforcement_statuses = (
         select array_agg(u.x order by u.ord)
         from unnest(array['Açık', 'Durdurulmuş', 'Kapalı']) with ordinality as u(x, ord)
         where not (u.x = any (s.enforcement_statuses))
       ) || s.enforcement_statuses
 where not (array['Açık', 'Durdurulmuş', 'Kapalı'] <@ s.enforcement_statuses);
select set_config('app.skip_audit', '', true);

-- ---- 3. İcra işlem geçmişi ------------------------------------------------------------------
create table if not exists public.enforcement_events (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null default app.current_org_id() references public.organizations (id) on delete cascade,
  enforcement_id uuid not null,
  debtor_id      uuid,
  date           date not null default current_date,
  type           text not null,
  inquiry_type   text,
  seizure_type   text,
  result         text,
  amount         numeric(14, 2) check (amount is null or amount >= 0),
  note           text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  created_by     uuid default auth.uid(),
  unique (org_id, id),
  foreign key (org_id, enforcement_id) references public.enforcements (org_id, id) on delete cascade,
  foreign key (org_id, debtor_id) references public.debtors (org_id, id) on delete set null (debtor_id)
);
create index if not exists enf_events_enf_idx on public.enforcement_events (org_id, enforcement_id, date);

select app.apply_rls('enforcement_events', 'enforcements', true);
grant select, insert, update, delete on public.enforcement_events to authenticated;
revoke all on public.enforcement_events from anon;

drop trigger if exists trg_touch on public.enforcement_events;
create trigger trg_touch before update on public.enforcement_events
  for each row execute function app.touch_updated_at();
drop trigger if exists trg_force_org on public.enforcement_events;
create trigger trg_force_org before insert or update on public.enforcement_events
  for each row execute function app.force_org();
drop trigger if exists trg_audit on public.enforcement_events;
create trigger trg_audit after insert or update or delete on public.enforcement_events
  for each row execute function app.audit();

-- Denetim etiketi: 'enforcement_events' → 'İcra işlemi' (fonksiyonun geri kalanı aynı)
create or replace function app.audit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  o jsonb; n jsonb; d jsonb := '{}'::jsonb; k text; j jsonb;
  v_org uuid; v_id uuid; v_label text; v_action text;
begin
  if coalesce(current_setting('app.skip_audit', true), '') = '1' then return null; end if;
  o := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  n := case when tg_op in ('UPDATE', 'INSERT') then to_jsonb(new) end;
  j := coalesce(n, o);
  v_org := (j ->> 'org_id')::uuid;
  v_id  := coalesce(j ->> 'id', j ->> 'org_id')::uuid;
  v_label := case tg_table_name
    when 'clients' then 'Müvekkil' when 'cases' then 'Dosya' when 'expenses' then 'Masraf'
    when 'accounts' then 'Hesap' when 'account_transactions' then 'Hesap hareketi'
    when 'fee_plans' then 'Tahsilat planı' when 'installment_payments' then 'Tahsilat'
    when 'reminders' then 'Ajanda' when 'debtors' then 'Borçlu' when 'enforcements' then 'İcra dosyası'
    when 'payment_promises' then 'Ödeme sözü' when 'collections' then 'İcra tahsilatı'
    when 'enforcement_events' then 'İcra işlemi'
    when 'documents' then 'Belge' when 'profiles' then 'Kullanıcı' when 'org_settings' then 'Ayarlar'
    else tg_table_name end;
  v_action := case tg_op when 'INSERT' then 'Ekleme' when 'UPDATE' then 'Güncelleme' else 'Silme' end;
  if tg_op = 'UPDATE' then
    for k in select jsonb_object_keys(n) loop
      if k in ('updated_at', 'created_at') then continue; end if;
      if n -> k is distinct from o -> k then
        d := d || jsonb_build_object(k, jsonb_build_object('before', o -> k, 'after', n -> k));
      end if;
    end loop;
    if d = '{}'::jsonb then return null; end if;   -- değişiklik yok
  end if;
  insert into public.activities (org_id, actor_id, action, entity, entity_id, detail, changes)
  values (
    v_org, auth.uid(), v_action, v_label, v_id,
    left(coalesce(j ->> 'name', j ->> 'title', j ->> 'no', j ->> 'description', j ->> 'type', j ->> 'amount', ''), 300),
    case when tg_op = 'UPDATE' then d end
  );
  return null;
end $$;

-- Gerçek zamanlı yayın (varsa)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.enforcement_events;
    exception when duplicate_object then null;
    end;
  end if;
end $$;

-- ---- 4. Haciz hatırlatması ------------------------------------------------------------------
-- Haczin düşeceği tarih = son haciz tarihi + büro ayarındaki ay (varsayılan 12).
-- İki bildirim gider (dosyanın sorumlularına; sorumlu yoksa büro yöneticilerine):
--   1) Önceden: düşme tarihinden ayardaki gün kadar önce (varsayılan 14)
--   2) Gününde: düşme günü ("Haciz bugün düşüyor"); cron bir gün kaçırırsa 3 gün içinde
-- Hangi bildirimin gönderildiği seizure_notices'ta tutulur. Bildirimler saklama süresi dolunca
-- silinse de aynı hatırlatma bir daha gönderilmez. Son haciz tarihi değişirse yeni tarih için
-- hatırlatmalar yeniden başlar.
create table if not exists public.seizure_notices (
  org_id         uuid not null references public.organizations (id) on delete cascade,
  enforcement_id uuid not null,
  due            date not null,
  kind           text not null check (kind in ('once', 'gun')),
  created_at     timestamptz not null default now(),
  primary key (enforcement_id, due, kind),
  foreign key (org_id, enforcement_id) references public.enforcements (org_id, id) on delete cascade
);
-- Yalnızca sunucu (cron) kullanır: istemciye kapalı (politika yok = erişim yok)
alter table public.seizure_notices enable row level security;
revoke all on public.seizure_notices from anon, authenticated;

-- Bu dosyanın önceki sürümünün gönderdiği bildirimler yeniden gönderilmesin
insert into public.seizure_notices (org_id, enforcement_id, due, kind)
select distinct n.org_id, split_part(n.dedupe_key, ':', 2)::uuid, split_part(n.dedupe_key, ':', 3)::date, 'once'
from public.notifications n
where n.type = 'Haciz' and n.dedupe_key ~ '^haciz:[0-9a-f-]{36}:\d{4}-\d{2}-\d{2}$'
  and exists (select 1 from public.enforcements e where e.id = split_part(n.dedupe_key, ':', 2)::uuid)
on conflict do nothing;

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
        and en.status not in ('Kapalı', 'Kapandı', 'Tahsil edildi')
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

-- Zamanlanmış iş: her gün 08:00 (TR)
do $$
begin
  if to_regclass('cron.job') is not null then
    perform cron.unschedule(jobid) from cron.job where jobname = 'lexkasa-haciz';
    perform cron.schedule('lexkasa-haciz', '0 5 * * *', 'select app.cron_seizure_reminders()');
  else
    raise notice 'pg_cron yok: haciz hatırlatması kurulmadı. Database > Extensions > pg_cron açıp bu dosyayı yeniden çalıştırın.';
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
      'lexkasa-aylik-ucret', 'lexkasa-bildirimler', 'lexkasa-saklama', 'lexkasa-keepalive', 'lexkasa-haciz'
    )
    order by j.jobname;
end $$;

revoke all on function public.list_cron_jobs() from public, anon;
grant execute on function public.list_cron_jobs() to authenticated;
