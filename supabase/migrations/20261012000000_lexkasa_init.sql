-- =====================================================================================
-- LexKasa — Supabase başlangıç şeması (TEK DOSYA)
--
-- İçerik:
--   1. Yardımcı şema (app) ve izin fonksiyonları (tablolardan önce tanımlanır)
--   2. Tablolar (tenant = organizations; her satır org_id taşır, bileşik yabancı anahtarlarla
--      başka büronun kaydına bağlanmak engellenir)
--   3. Tetikleyiciler (updated_at, org_id kilidi, denetim kaydı, son admin koruması)
--   4. RLS (satır bazlı yetki): izin matrisi = uygulamadaki Ayarlar > İzinler ekranı
--   5. Görünümler (hesap bakiyeleri, taksit durumları, müvekkil cari bakiyeleri)
--   6. İş fonksiyonları (RPC): büro kurma, tahsilat dağıtma, aylık ücret, dosya kapatma, arşiv
--   7. Zamanlanmış işler (pg_cron): aylık ücret, bildirimler, saklama süresi / otomatik arşiv,
--      Supabase projesinin uykuya geçmesini önleyen "keepalive" (5 günde bir)
--   8. Depolama (Storage) kuralları
--
-- Çalıştırma: Supabase CLI (`supabase db push`) ya da SQL Editor'e yapıştırın.
-- Zamanlanmış işler için önce Dashboard > Database > Extensions > pg_cron'u açın.
--
-- Güvenlik ilkeleri:
--   * Tüm tablolarda RLS açık; anon rolünün hiçbir tabloya erişimi yok.
--   * Yetki kontrolü veritabanında yapılır (arayüzdeki gizleme yalnızca kolaylıktır).
--   * SECURITY DEFINER fonksiyonlar `set search_path = ''` ile çalışır ve izni kendileri denetler.
--   * Kullanıcı/yetki yönetimi (profil oluşturma, auth.users) service_role ile (Edge Function) yapılır.
-- =====================================================================================


-- =====================================================================================
-- 1. YARDIMCI ŞEMA
-- =====================================================================================

create schema if not exists app;
revoke all on schema app from public;
grant usage on schema app to authenticated;

-- Fonksiyonlar tablolardan önce tanımlanır (tablo varsayılanları bunları çağırır); gövdeleri çalışırken çözülür
set check_function_bodies = off;

-- Oturumdaki kullanıcının (aktif) bürosu; büro askıdaysa null
create or replace function app.current_org_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select p.org_id
  from public.profiles p
  join public.organizations o on o.id = p.org_id and o.active
  where p.id = auth.uid() and p.active
$$;

create or replace function app.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select p.role = 'admin'
    from public.profiles p
    join public.organizations o on o.id = p.org_id and o.active
    where p.id = auth.uid() and p.active
  ), false)
$$;

-- Bir kullanıcının modül/eylem izni: admin her şeye sahip; avukatta kişisel istisna > rol varsayılanı > kapalı.
-- Ekle/Düzenle/Sil, "Görüntüle" olmadan geçerli değildir (masraflar ve ajanda hariç: orada Görüntüle = başkalarınınkini görme).
create or replace function app.can_user(p_user uuid, p_module text, p_action text default 'view') returns boolean
language sql stable security definer set search_path = '' as $$
  with me as (
    select p.role, p.permissions, s.role_permissions rp
    from public.profiles p
    join public.organizations o on o.id = p.org_id and o.active
    join public.org_settings s on s.org_id = p.org_id
    where p.id = p_user and p.active
  )
  select coalesce((
    select case
      when role = 'admin' then true
      else
        coalesce((permissions ->> (p_module || '.' || p_action))::boolean, (rp ->> (p_module || '.' || p_action))::boolean, false)
        and (
          p_action = 'view'
          or p_module in ('expenses', 'reminders')
          or coalesce((permissions ->> (p_module || '.view'))::boolean, (rp ->> (p_module || '.view'))::boolean, false)
        )
    end
    from me
  ), false)
$$;

create or replace function app.can(p_module text, p_action text default 'view') returns boolean
language sql stable security definer set search_path = '' as $$
  select app.can_user(auth.uid(), p_module, p_action)
$$;



-- =====================================================================================
-- 2. TABLOLAR
-- =====================================================================================

-- ---- Büro (tenant) ------------------------------------------------------------------
create table if not exists public.organizations (
  id                       uuid primary key default gen_random_uuid(),
  name                     text not null check (length(btrim(name)) > 0),
  active                   boolean not null default true,
  timezone                 text not null default 'Europe/Istanbul',
  -- Aktivite geçmişinin tutulacağı ay sayısı (daha eskisi haftalık işte silinir)
  retention_months         int  not null default 24 check (retention_months >= 6),
  -- Doluysa: bu kadar tam yıl tutulur, daha eski yıllar her yıl Ocak'ta otomatik arşivlenir (ayrıntı silinir, toplam kalır).
  -- Boşsa otomatik arşiv kapalıdır (silme geri alınamaz; bilinçli açılmalı).
  auto_archive_keep_years  int  check (auto_archive_keep_years is null or auto_archive_keep_years >= 1),
  last_auto_archive_year   int,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

-- ---- Büro ayarları: bilgiler, kategoriler (açılır listeler), avukat rolünün izinleri ---------
create table if not exists public.org_settings (
  org_id                uuid primary key references public.organizations (id) on delete cascade,
  firm                  jsonb  not null default '{}'::jsonb,
  case_types            text[] not null default '{Dava,İcra,Danışmanlık,Arabuluculuk,Ceza}',
  case_statuses         text[] not null default '{Açık,Derdest,Karar,"Kanun yolu",Kapalı}',
  expense_types         text[] not null default '{Harç,Bilirkişi,Tebligat,Keşif,Yol,Kargo,Noter,Fotokopi,"Ofis gideri",Diğer}',
  reminder_types        text[] not null default '{Duruşma,Keşif,"Evrak teslimi","Süre sonu","Müvekkili ara",Toplantı,Diğer}',
  document_categories   text[] not null default '{Dilekçe,Karar,Tutanak,Vekaletname,Sözleşme,Makbuz,Kimlik,Diğer}',
  fee_kinds             text[] not null default '{"Vekalet ücreti","Aylık ücret",Danışmanlık,"Karşı vekalet ücreti",Diğer}',
  payment_methods       text[] not null default '{Nakit,Havale/EFT,"Kredi kartı",Çek,Diğer}',
  enforcement_statuses  text[] not null default '{Derdest,Haciz,Satış,"Ödeme planı","Tahsil edildi",Kapandı}',
  enforcement_types     text[] not null default '{İlamsız,İlamlı,Kambiyo,Rehin,Kira,Diğer}',
  contact_channels      text[] not null default '{Telefon,WhatsApp,"Yüz yüze",E-posta,Tebligat}',
  courts                text[] not null default '{}',
  enforcement_offices   text[] not null default '{}',
  -- Avukat rolünün varsayılan izinleri: {"clients.view": true, ...}. Admin her şeye sahiptir.
  role_permissions      jsonb  not null default '{
    "clients.view":true,"clients.create":true,"clients.edit":true,
    "cases.view":true,"cases.create":true,"cases.edit":true,
    "documents.view":true,"documents.create":true,"documents.edit":true,"documents.delete":true,
    "expenses.create":true,
    "reminders.create":true,"reminders.edit":true,"reminders.delete":true,
    "enforcements.view":true,"enforcements.create":true,"enforcements.edit":true
  }'::jsonb,
  updated_at            timestamptz not null default now()
);

-- ---- Kullanıcı profili (auth.users ile 1-1; bir kullanıcı tek büroya bağlıdır) ---------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  org_id      uuid not null references public.organizations (id) on delete cascade,
  name        text not null,
  username    text not null check (username ~ '^[a-z0-9çğıöşü._-]{3,}$'),
  email       text not null,
  phone       text,
  title       text,
  role        text not null default 'avukat' check (role in ('admin', 'avukat')),
  active      boolean not null default true,
  -- Role göre varsayılan izinlere kişisel istisna: {"clients.view": false}
  permissions jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (org_id, id)
);
-- Kullanıcı adı tüm bürolarda benzersiz (giriş ekranında büro seçtirilmez)
create unique index if not exists profiles_username_uq on public.profiles (lower(username));
create index if not exists profiles_org_idx on public.profiles (org_id);

-- ---- Ortak sütunlar için kısa not: her veri tablosunda
--      org_id (varsayılan: oturumdaki kullanıcının bürosu), created_at, updated_at, created_by.
--      Yabancı anahtarlar (org_id, x_id) çiftiyle verilir; böylece başka büronun kaydına bağlanılamaz.

create table if not exists public.clients (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null default app.current_org_id() references public.organizations (id) on delete cascade,
  name          text not null check (length(btrim(name)) > 0),
  kind          text not null default 'Bireysel' check (kind in ('Bireysel', 'Kurumsal')),
  email         text not null default '',
  phone         text not null default '',
  status        text not null default 'Aktif' check (status in ('Aktif', 'Pasif')),
  identity      text,
  tax_office    text,
  address       text,
  notes         text,
  monthly_fee            numeric(14, 2) check (monthly_fee is null or monthly_fee >= 0),
  monthly_fee_start_date date,
  -- Kapatılan dosyalardan / arşivlenen yıllardan geriye kalan toplamlar (ayrıntıları silinmiş)
  closed_case_count  int            not null default 0,
  closed_receivable  numeric(14, 2) not null default 0,   -- toplam alacak (müvekkil büroya borçlu)
  closed_payable     numeric(14, 2) not null default 0,   -- toplam verecek (büro müvekkile borçlu)
  closed_fee_total   numeric(14, 2) not null default 0,
  closed_fee_paid    numeric(14, 2) not null default 0,
  closed_last_at     timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid default auth.uid(),
  unique (org_id, id)
);
create index if not exists clients_org_idx on public.clients (org_id, name);
create index if not exists clients_identity_idx on public.clients (org_id, identity) where identity is not null;

create table if not exists public.cases (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null default app.current_org_id() references public.organizations (id) on delete cascade,
  no              text not null,
  title           text not null,
  client_id       uuid,
  court           text,
  esas_no         text,
  type            text not null default 'Dava',
  status          text not null default 'Açık',
  responsible_ids uuid[] not null default '{}',
  opposing_party  text,
  opening_date    date not null default current_date,
  closing_date    date,
  agreed_fee      numeric(14, 2) check (agreed_fee is null or agreed_fee >= 0),
  note            text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid default auth.uid(),
  unique (org_id, id),
  unique (org_id, no),
  foreign key (org_id, client_id) references public.clients (org_id, id)
);
create index if not exists cases_org_client_idx on public.cases (org_id, client_id);
create index if not exists cases_responsible_idx on public.cases using gin (responsible_ids);

create table if not exists public.accounts (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null default app.current_org_id() references public.organizations (id) on delete cascade,
  name            text not null,
  type            text not null check (type in ('Kasa', 'Banka')),
  bank_name       text,
  iban            text,
  opening_balance numeric(14, 2) not null default 0,
  opening_date    date not null default current_date,
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid default auth.uid(),
  unique (org_id, id)
);

create table if not exists public.account_transactions (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null default app.current_org_id() references public.organizations (id) on delete cascade,
  account_id  uuid not null,
  date        date not null default current_date,
  -- Pozitif: giriş, negatif: çıkış
  amount      numeric(14, 2) not null,
  category    text not null check (category in ('Virman', 'Diğer gelir', 'Diğer gider', 'Müvekkile aktarım', 'Kapanan dosya')),
  description text not null default '',
  transfer_id uuid,
  client_id   uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid default auth.uid(),
  foreign key (org_id, account_id) references public.accounts (org_id, id),
  foreign key (org_id, client_id) references public.clients (org_id, id)
);
create index if not exists acctx_org_acc_idx on public.account_transactions (org_id, account_id, date);

create table if not exists public.debtors (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null default app.current_org_id() references public.organizations (id) on delete cascade,
  name       text not null,
  kind       text not null default 'Bireysel' check (kind in ('Bireysel', 'Kurumsal')),
  identity   text,
  phone      text,
  email      text,
  address    text,
  assets     text,
  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  unique (org_id, id)
);

create table if not exists public.enforcements (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null default app.current_org_id() references public.organizations (id) on delete cascade,
  no              text not null,
  office          text not null,
  type            text not null default 'İlamsız',
  client_id       uuid not null,
  principal       numeric(14, 2) not null default 0 check (principal >= 0),
  interest        numeric(14, 2) not null default 0 check (interest >= 0),
  costs           numeric(14, 2) not null default 0 check (costs >= 0),
  status          text not null default 'Derdest',
  opening_date    date not null default current_date,
  responsible_ids uuid[] not null default '{}',
  case_id         uuid,
  note            text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid default auth.uid(),
  unique (org_id, id),
  unique (org_id, no, office),
  foreign key (org_id, client_id) references public.clients (org_id, id),
  foreign key (org_id, case_id) references public.cases (org_id, id) on delete set null (case_id)
);
create index if not exists enf_org_client_idx on public.enforcements (org_id, client_id);

create table if not exists public.enforcement_debtors (
  org_id         uuid not null default app.current_org_id() references public.organizations (id) on delete cascade,
  enforcement_id uuid not null,
  debtor_id      uuid not null,
  primary key (enforcement_id, debtor_id),
  foreign key (org_id, enforcement_id) references public.enforcements (org_id, id) on delete cascade,
  foreign key (org_id, debtor_id) references public.debtors (org_id, id)
);

create table if not exists public.payment_promises (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null default app.current_org_id() references public.organizations (id) on delete cascade,
  enforcement_id uuid not null,
  debtor_id      uuid not null,
  amount         numeric(14, 2) not null check (amount > 0),
  due_date       date not null,
  status         text not null default 'Bekliyor' check (status in ('Bekliyor', 'Tutuldu', 'Tutulmadı', 'İptal')),
  -- Borçluya tanımlanan taksit planına aitse plan kimliği ve sırası
  plan_id        uuid,
  installment_no int,
  note           text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  created_by     uuid default auth.uid(),
  unique (org_id, id),
  foreign key (org_id, enforcement_id) references public.enforcements (org_id, id) on delete cascade,
  foreign key (org_id, debtor_id) references public.debtors (org_id, id)
);
create index if not exists prm_org_due_idx on public.payment_promises (org_id, due_date) where status = 'Bekliyor';

create table if not exists public.collections (
  id                   uuid primary key default gen_random_uuid(),
  org_id               uuid not null default app.current_org_id() references public.organizations (id) on delete cascade,
  enforcement_id       uuid not null,
  debtor_id            uuid not null,
  amount               numeric(14, 2) not null check (amount > 0),
  date                 date not null default current_date,
  method               text not null default 'Havale/EFT',
  account_id           uuid,
  promise_id           uuid,
  transferred_to_client boolean not null default false,
  note                 text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  created_by           uuid default auth.uid(),
  unique (org_id, id),
  foreign key (org_id, enforcement_id) references public.enforcements (org_id, id) on delete cascade,
  foreign key (org_id, debtor_id) references public.debtors (org_id, id),
  foreign key (org_id, account_id) references public.accounts (org_id, id),
  foreign key (org_id, promise_id) references public.payment_promises (org_id, id) on delete set null (promise_id)
);
create index if not exists col_org_enf_idx on public.collections (org_id, enforcement_id, date);

create table if not exists public.contact_logs (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null default app.current_org_id() references public.organizations (id) on delete cascade,
  debtor_id      uuid not null,
  enforcement_id uuid,
  date           date not null default current_date,
  channel        text not null,
  note           text not null,
  user_id        uuid default auth.uid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  created_by     uuid default auth.uid(),
  foreign key (org_id, debtor_id) references public.debtors (org_id, id) on delete cascade,
  foreign key (org_id, enforcement_id) references public.enforcements (org_id, id) on delete cascade
);

-- ---- Ekler (belge, makbuz, logo): dosyanın kendisi Storage'da, burada yalnızca künye ----------
create table if not exists public.attachments (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null default app.current_org_id() references public.organizations (id) on delete cascade,
  name         text not null,
  mime         text not null default 'application/octet-stream',
  size         bigint not null default 0 check (size >= 0 and size <= 15 * 1024 * 1024),
  -- Storage yolu: <org_id>/<uuid>; ilk parça büro kimliği olmak zorundadır
  storage_path text not null unique,
  entity       text not null default 'document' check (entity in ('expense', 'document', 'logo')),
  entity_id    uuid,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid default auth.uid(),
  unique (org_id, id),
  check (split_part(storage_path, '/', 1) = org_id::text)
);
create index if not exists att_entity_idx on public.attachments (org_id, entity, entity_id);

create table if not exists public.expenses (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null default app.current_org_id() references public.organizations (id) on delete cascade,
  title          text not null,
  type           text not null,
  amount         numeric(14, 2) not null check (amount > 0),
  date           date not null default current_date,
  case_id        uuid,
  enforcement_id uuid,
  client_id      uuid,
  -- Müvekkil: müvekkile yansır (carisine borç). Büro: büro gideri.
  charge_to      text not null default 'Müvekkil' check (charge_to in ('Müvekkil', 'Büro')),
  -- Parayı kim ödedi. Müvekkil kendisi ödediyse kasadan çıkış olmaz.
  paid_by        text not null default 'Büro' check (paid_by in ('Büro', 'Müvekkil')),
  account_id     uuid,
  note           text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  created_by     uuid not null default auth.uid(),
  unique (org_id, id),
  foreign key (org_id, case_id) references public.cases (org_id, id),
  foreign key (org_id, enforcement_id) references public.enforcements (org_id, id) on delete set null (enforcement_id),
  foreign key (org_id, client_id) references public.clients (org_id, id),
  foreign key (org_id, account_id) references public.accounts (org_id, id),
  check (charge_to = 'Büro' or client_id is not null or case_id is not null or enforcement_id is not null)
);
create index if not exists exp_org_date_idx on public.expenses (org_id, date desc);
create index if not exists exp_org_case_idx on public.expenses (org_id, case_id);

create table if not exists public.fee_plans (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null default app.current_org_id() references public.organizations (id) on delete cascade,
  title      text not null,
  kind       text not null default 'Vekalet ücreti',
  client_id  uuid not null,
  case_id    uuid,
  date       date not null default current_date,
  total      numeric(14, 2) not null check (total >= 0),
  -- Aylık ücret tahakkukunda dönem (YYYY-MM); aynı müvekkile aynı dönem iki kez yazılamaz
  period     text check (period is null or period ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  cancelled  boolean not null default false,
  note       text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  unique (org_id, id),
  foreign key (org_id, client_id) references public.clients (org_id, id),
  foreign key (org_id, case_id) references public.cases (org_id, id)
);
create unique index if not exists fee_plans_period_uq
  on public.fee_plans (org_id, client_id, period) where period is not null and not cancelled;
create index if not exists fee_plans_org_client_idx on public.fee_plans (org_id, client_id);

create table if not exists public.installments (
  id       uuid primary key default gen_random_uuid(),
  org_id   uuid not null default app.current_org_id() references public.organizations (id) on delete cascade,
  plan_id  uuid not null,
  position int  not null check (position >= 1),
  due_date date not null,
  amount   numeric(14, 2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, id),
  unique (plan_id, position),
  foreign key (org_id, plan_id) references public.fee_plans (org_id, id) on delete cascade
);
create index if not exists inst_org_due_idx on public.installments (org_id, due_date);

create table if not exists public.installment_payments (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null default app.current_org_id() references public.organizations (id) on delete cascade,
  installment_id uuid not null,
  date           date not null default current_date,
  amount         numeric(14, 2) not null check (amount > 0),
  method         text not null,
  account_id     uuid,
  note           text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  created_by     uuid default auth.uid(),
  unique (org_id, id),
  foreign key (org_id, installment_id) references public.installments (org_id, id) on delete cascade,
  foreign key (org_id, account_id) references public.accounts (org_id, id)
);
create index if not exists pay_org_date_idx on public.installment_payments (org_id, date);

create table if not exists public.reminders (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null default app.current_org_id() references public.organizations (id) on delete cascade,
  title          text not null,
  type           text not null,
  date           date not null,
  time           time,
  location       text,
  case_id        uuid,
  client_id      uuid,
  enforcement_id uuid,
  assignee_id    uuid not null default auth.uid(),
  status         text not null default 'Bekliyor' check (status in ('Bekliyor', 'Tamamlandı', 'İptal')),
  note           text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  created_by     uuid default auth.uid(),
  unique (org_id, id),
  foreign key (org_id, case_id) references public.cases (org_id, id) on delete cascade,
  foreign key (org_id, client_id) references public.clients (org_id, id),
  foreign key (org_id, enforcement_id) references public.enforcements (org_id, id) on delete cascade,
  foreign key (org_id, assignee_id) references public.profiles (org_id, id)
);
create index if not exists rem_org_date_idx on public.reminders (org_id, date) where status = 'Bekliyor';
create index if not exists rem_assignee_idx on public.reminders (assignee_id, date);

create table if not exists public.documents (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null default app.current_org_id() references public.organizations (id) on delete cascade,
  name           text not null,
  category       text not null default 'Diğer',
  attachment_id  uuid not null,
  case_id        uuid,
  client_id      uuid,
  enforcement_id uuid,
  uploaded_by    uuid not null default auth.uid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  created_by     uuid default auth.uid(),
  unique (org_id, id),
  foreign key (org_id, attachment_id) references public.attachments (org_id, id),
  foreign key (org_id, case_id) references public.cases (org_id, id) on delete cascade,
  foreign key (org_id, client_id) references public.clients (org_id, id),
  foreign key (org_id, enforcement_id) references public.enforcements (org_id, id) on delete cascade
);

create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null default app.current_org_id() references public.organizations (id) on delete cascade,
  user_id    uuid not null,
  title      text not null,
  detail     text not null default '',
  type       text not null default '',
  link       text,
  read       boolean not null default false,
  -- Aynı uyarının tekrar üretilmesini engeller (zamanlanmış işler için)
  dedupe_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (org_id, user_id) references public.profiles (org_id, id) on delete cascade
);
create unique index if not exists notif_dedupe_uq on public.notifications (user_id, dedupe_key) where dedupe_key is not null;
create index if not exists notif_user_idx on public.notifications (user_id, created_at desc);

create table if not exists public.activities (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations (id) on delete cascade,
  actor_id   uuid,
  action     text not null check (action in ('Ekleme', 'Güncelleme', 'Silme', 'İşlem')),
  entity     text not null,
  entity_id  uuid,
  detail     text not null default '',
  changes    jsonb,
  created_at timestamptz not null default now()
);
create index if not exists act_org_idx on public.activities (org_id, created_at desc);

-- ---- Arşiv: silinen eski kayıtlardan geriye kalan yıllık para toplamları -------------------
create table if not exists public.yearly_stats (
  org_id          uuid not null references public.organizations (id) on delete cascade,
  year            int  not null,
  fee_income      numeric(14, 2) not null default 0,   -- müvekkillerden tahsil edilen ücret
  icra_collected  numeric(14, 2) not null default 0,   -- borçlulardan tahsil edilen
  office_expense  numeric(14, 2) not null default 0,
  client_expense  numeric(14, 2) not null default 0,
  other_income    numeric(14, 2) not null default 0,
  other_expense   numeric(14, 2) not null default 0,
  closed_cases    int            not null default 0,
  updated_at      timestamptz not null default now(),
  primary key (org_id, year)
);
create table if not exists public.org_archive (
  org_id            uuid primary key references public.organizations (id) on delete cascade,
  archived_through  int not null
);

-- ---- Silinen eklerin Storage'daki dosyaları için sıra (servis temizler) --------------------
create table if not exists public.storage_cleanup (
  id        bigint generated always as identity primary key,
  org_id    uuid not null,
  path      text not null,
  queued_at timestamptz not null default now()
);


-- =====================================================================================
-- 3. İZİN ARAYÜZ FONKSİYONU VE TETİKLEYİCİLER
-- =====================================================================================

-- Etkin izinlerin tamamı (arayüz menüyü bununla çizer)
create or replace function public.my_permissions() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_object_agg(m || '.' || a, app.can(m, a)), '{}'::jsonb)
  from (
    values
      ('clients','view'),('clients','create'),('clients','edit'),('clients','delete'),
      ('cases','view'),('cases','create'),('cases','edit'),('cases','delete'),
      ('documents','view'),('documents','create'),('documents','edit'),('documents','delete'),
      ('expenses','view'),('expenses','create'),('expenses','edit'),('expenses','delete'),
      ('reminders','view'),('reminders','create'),('reminders','edit'),('reminders','delete'),
      ('enforcements','view'),('enforcements','create'),('enforcements','edit'),('enforcements','delete'),
      ('fees','view'),('fees','create'),('fees','edit'),('fees','delete'),
      ('ledger','view'),
      ('accounts','view'),('accounts','create'),('accounts','edit'),('accounts','delete'),
      ('reports','view'),
      ('activity','view')
  ) as t(m, a)
$$;


-- =====================================================================================
-- 4. TETİKLEYİCİLER
-- =====================================================================================

-- updated_at
create or replace function app.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- org_id: istemci başka büro adına kayıt açamaz, açılmış kaydın bürosu değişemez
create or replace function app.force_org() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_org uuid;
begin
  -- Yeni büro kurulurken (create_organization) kullanıcı henüz bir büroya bağlı değildir
  if coalesce(current_setting('app.bootstrap', true), '') = '1' then return new; end if;
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      v_org := app.current_org_id();
      if v_org is null then
        raise exception 'Oturum ya da büro bulunamadı' using errcode = '28000';
      end if;
      new.org_id := v_org;
    end if;
  elsif new.org_id is distinct from old.org_id then
    raise exception 'Kaydın bürosu değiştirilemez' using errcode = '42501';
  end if;
  return new;
end $$;

-- Denetim kaydı: kim, neyi, ne zaman, hangi alanı değiştirdi
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
  -- parola vb. gizli alan yok; izin ve ayarlar da kayda girer
  insert into public.activities (org_id, actor_id, action, entity, entity_id, detail, changes)
  values (
    v_org, auth.uid(), v_action, v_label, v_id,
    left(coalesce(j ->> 'name', j ->> 'title', j ->> 'no', j ->> 'description', j ->> 'amount', ''), 300),
    case when tg_op = 'UPDATE' then d end
  );
  return null;
end $$;

-- Ek silinince Storage dosyası sıraya alınır; masraf / belge silinince eki de silinir
create or replace function app.queue_storage_cleanup() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.storage_cleanup (org_id, path) values (old.org_id, old.storage_path);
  return null;
end $$;

create or replace function app.drop_expense_receipts() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.attachments where org_id = old.org_id and entity = 'expense' and entity_id = old.id;
  return null;
end $$;

create or replace function app.drop_document_attachment() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.attachments where org_id = old.org_id and id = old.attachment_id;
  return null;
end $$;

-- Büronun son admin'i silinemez, pasife alınamaz ya da avukata çevrilemez
create or replace function app.protect_last_admin() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.role = 'admin' and old.active
     and (tg_op = 'DELETE' or new.role <> 'admin' or not new.active)
     and not exists (
       select 1 from public.profiles p
       where p.org_id = old.org_id and p.role = 'admin' and p.active and p.id <> old.id
     )
     -- büro silinirken (cascade) engelleme
     and exists (select 1 from public.organizations o where o.id = old.org_id)
  then
    raise exception 'Büronun son yöneticisi silinemez, pasife alınamaz ya da yetkisi düşürülemez' using errcode = '23514';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

-- Yönetici olmayan kullanıcı kendi profilinde yalnızca ad / telefon / ünvanı değiştirebilir
create or replace function app.guard_profile_update() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and not app.is_admin() then
    if new.role is distinct from old.role
       or new.active is distinct from old.active
       or new.permissions is distinct from old.permissions
       or new.org_id is distinct from old.org_id
       or new.username is distinct from old.username
       or new.email is distinct from old.email then
      raise exception 'Bu alanları yalnızca yönetici değiştirebilir' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

-- Tetikleyicileri toplu bağla
do $$
declare t text;
begin
  -- updated_at + org kilidi (org_id'si olan tüm veri tabloları)
  foreach t in array array[
    'organizations','org_settings','profiles','clients','cases','accounts','account_transactions','debtors',
    'enforcements','payment_promises','collections','contact_logs','attachments','expenses','fee_plans',
    'installments','installment_payments','reminders','documents','notifications','yearly_stats'
  ] loop
    execute format('drop trigger if exists trg_touch on public.%I', t);
    execute format('create trigger trg_touch before update on public.%I for each row execute function app.touch_updated_at()', t);
  end loop;

  foreach t in array array[
    'org_settings','profiles','clients','cases','accounts','account_transactions','debtors','enforcements',
    'enforcement_debtors','payment_promises','collections','contact_logs','attachments','expenses','fee_plans',
    'installments','installment_payments','reminders','documents','notifications'
  ] loop
    execute format('drop trigger if exists trg_force_org on public.%I', t);
    execute format('create trigger trg_force_org before insert or update on public.%I for each row execute function app.force_org()', t);
  end loop;

  -- denetim kaydı
  foreach t in array array[
    'org_settings','profiles','clients','cases','accounts','account_transactions','debtors','enforcements',
    'payment_promises','collections','expenses','fee_plans','installment_payments','reminders','documents'
  ] loop
    execute format('drop trigger if exists trg_audit on public.%I', t);
    execute format('create trigger trg_audit after insert or update or delete on public.%I for each row execute function app.audit()', t);
  end loop;
end $$;

drop trigger if exists trg_att_cleanup on public.attachments;
create trigger trg_att_cleanup after delete on public.attachments
  for each row execute function app.queue_storage_cleanup();
drop trigger if exists trg_exp_receipts on public.expenses;
create trigger trg_exp_receipts after delete on public.expenses
  for each row execute function app.drop_expense_receipts();
drop trigger if exists trg_doc_attachment on public.documents;
create trigger trg_doc_attachment after delete on public.documents
  for each row execute function app.drop_document_attachment();
drop trigger if exists trg_last_admin on public.profiles;
create trigger trg_last_admin before update or delete on public.profiles
  for each row execute function app.protect_last_admin();
drop trigger if exists trg_profile_guard on public.profiles;
create trigger trg_profile_guard before update on public.profiles
  for each row execute function app.guard_profile_update();


-- =====================================================================================
-- 5. RLS — satır bazlı yetki
-- =====================================================================================

-- Standart kural: görüntüle / ekle / düzenle / sil izinleri ilgili modülden gelir.
-- p_child = true: alt tablo (taksit, ödeme...) — yazma, modülde "ekle" ya da "düzenle" izni gerektirir.
create or replace function app.apply_rls(p_table text, p_module text, p_child boolean default false) returns void
language plpgsql as $$
declare t text := format('public.%I', p_table); w text;
begin
  execute format('alter table %s enable row level security', t);
  execute format('drop policy if exists %I on %s', p_table || '_select', t);
  execute format('drop policy if exists %I on %s', p_table || '_insert', t);
  execute format('drop policy if exists %I on %s', p_table || '_update', t);
  execute format('drop policy if exists %I on %s', p_table || '_delete', t);
  execute format(
    'create policy %I on %s for select to authenticated using (org_id = app.current_org_id() and app.can(%L, ''view''))',
    p_table || '_select', t, p_module);
  if p_child then
    w := format('(app.can(%1$L, ''create'') or app.can(%1$L, ''edit''))', p_module);
    execute format('create policy %I on %s for insert to authenticated with check (org_id = app.current_org_id() and %s)', p_table || '_insert', t, w);
    execute format('create policy %I on %s for update to authenticated using (org_id = app.current_org_id() and %s) with check (org_id = app.current_org_id())', p_table || '_update', t, w);
    execute format('create policy %I on %s for delete to authenticated using (org_id = app.current_org_id() and %s)', p_table || '_delete', t, w);
  else
    execute format('create policy %I on %s for insert to authenticated with check (org_id = app.current_org_id() and app.can(%L, ''create''))', p_table || '_insert', t, p_module);
    execute format('create policy %I on %s for update to authenticated using (org_id = app.current_org_id() and app.can(%L, ''edit'')) with check (org_id = app.current_org_id())', p_table || '_update', t, p_module);
    execute format('create policy %I on %s for delete to authenticated using (org_id = app.current_org_id() and app.can(%L, ''delete''))', p_table || '_delete', t, p_module);
  end if;
end $$;

select app.apply_rls('clients',              'clients');
select app.apply_rls('cases',                'cases');
select app.apply_rls('documents',            'documents');
select app.apply_rls('debtors',              'enforcements');
select app.apply_rls('enforcements',         'enforcements');
select app.apply_rls('enforcement_debtors',  'enforcements', true);
select app.apply_rls('payment_promises',     'enforcements', true);
select app.apply_rls('collections',          'enforcements', true);
select app.apply_rls('contact_logs',         'enforcements', true);
select app.apply_rls('fee_plans',            'fees');
select app.apply_rls('installments',         'fees', true);
select app.apply_rls('installment_payments', 'fees', true);
select app.apply_rls('accounts',             'accounts');
select app.apply_rls('account_transactions', 'accounts');

-- ---- Masraflar: kendi girdiğini her zaman görür / düzenler / siler; başkalarınınki izne bağlı ----
alter table public.expenses enable row level security;
drop policy if exists expenses_select on public.expenses;
drop policy if exists expenses_insert on public.expenses;
drop policy if exists expenses_update on public.expenses;
drop policy if exists expenses_delete on public.expenses;
create policy expenses_select on public.expenses for select to authenticated
  using (org_id = app.current_org_id() and (app.can('expenses', 'view') or created_by = auth.uid()));
create policy expenses_insert on public.expenses for insert to authenticated
  with check (org_id = app.current_org_id() and app.can('expenses', 'create') and created_by = auth.uid());
create policy expenses_update on public.expenses for update to authenticated
  using (org_id = app.current_org_id() and (app.can('expenses', 'edit') or created_by = auth.uid()))
  with check (org_id = app.current_org_id());
create policy expenses_delete on public.expenses for delete to authenticated
  using (org_id = app.current_org_id() and (app.can('expenses', 'delete') or created_by = auth.uid()));

-- ---- Ajanda: kendine atananı her zaman görür; tamamlama (güncelleme) kendi işinde serbest ----------
alter table public.reminders enable row level security;
drop policy if exists reminders_select on public.reminders;
drop policy if exists reminders_insert on public.reminders;
drop policy if exists reminders_update on public.reminders;
drop policy if exists reminders_delete on public.reminders;
create policy reminders_select on public.reminders for select to authenticated
  using (org_id = app.current_org_id() and (app.can('reminders', 'view') or assignee_id = auth.uid()));
create policy reminders_insert on public.reminders for insert to authenticated
  with check (org_id = app.current_org_id() and app.can('reminders', 'create'));
create policy reminders_update on public.reminders for update to authenticated
  using (org_id = app.current_org_id() and (app.can('reminders', 'edit') or assignee_id = auth.uid()))
  with check (org_id = app.current_org_id());
create policy reminders_delete on public.reminders for delete to authenticated
  using (org_id = app.current_org_id() and app.can('reminders', 'delete'));

-- ---- Ekler: kendi yüklediğini ya da belge / masraf görme izni olanlar görür ------------------------
alter table public.attachments enable row level security;
drop policy if exists attachments_select on public.attachments;
drop policy if exists attachments_insert on public.attachments;
drop policy if exists attachments_update on public.attachments;
drop policy if exists attachments_delete on public.attachments;
create policy attachments_select on public.attachments for select to authenticated
  using (org_id = app.current_org_id()
         and (created_by = auth.uid() or app.can('documents', 'view') or app.can('expenses', 'view')));
create policy attachments_insert on public.attachments for insert to authenticated
  with check (org_id = app.current_org_id() and created_by = auth.uid()
              and (app.can('documents', 'create') or app.can('expenses', 'create') or app.is_admin()));
create policy attachments_update on public.attachments for update to authenticated
  using (org_id = app.current_org_id() and (created_by = auth.uid() or app.is_admin()))
  with check (org_id = app.current_org_id());
create policy attachments_delete on public.attachments for delete to authenticated
  using (org_id = app.current_org_id() and (created_by = auth.uid() or app.is_admin()));

-- ---- Bildirimler: yalnızca sahibi görür / okur / siler; başkasına bildirim ekleme büro içinde serbest -------
alter table public.notifications enable row level security;
drop policy if exists notifications_select on public.notifications;
drop policy if exists notifications_insert on public.notifications;
drop policy if exists notifications_update on public.notifications;
drop policy if exists notifications_delete on public.notifications;
create policy notifications_select on public.notifications for select to authenticated
  using (org_id = app.current_org_id() and user_id = auth.uid());
create policy notifications_insert on public.notifications for insert to authenticated
  with check (org_id = app.current_org_id());
create policy notifications_update on public.notifications for update to authenticated
  using (org_id = app.current_org_id() and user_id = auth.uid())
  with check (org_id = app.current_org_id() and user_id = auth.uid());
create policy notifications_delete on public.notifications for delete to authenticated
  using (org_id = app.current_org_id() and user_id = auth.uid());

-- ---- Aktivite geçmişi: yalnızca "activity" izni olan okur; yazma yalnızca tetikleyici / fonksiyonlarla ---------
alter table public.activities enable row level security;
drop policy if exists activities_select on public.activities;
create policy activities_select on public.activities for select to authenticated
  using (org_id = app.current_org_id() and app.can('activity', 'view'));

-- ---- Yıllık özet / arşiv: raporlar izni okur; yazma yalnızca fonksiyonlarla ---------------------------------
alter table public.yearly_stats enable row level security;
drop policy if exists yearly_stats_select on public.yearly_stats;
create policy yearly_stats_select on public.yearly_stats for select to authenticated
  using (org_id = app.current_org_id() and app.can('reports', 'view'));
alter table public.org_archive enable row level security;
drop policy if exists org_archive_select on public.org_archive;
create policy org_archive_select on public.org_archive for select to authenticated
  using (org_id = app.current_org_id() and app.can('reports', 'view'));

-- ---- Büro ve ayarlar: büro üyeleri okur, yalnızca admin değiştirir -------------------------------------------
alter table public.organizations enable row level security;
drop policy if exists organizations_select on public.organizations;
drop policy if exists organizations_update on public.organizations;
create policy organizations_select on public.organizations for select to authenticated
  using (id = app.current_org_id());
create policy organizations_update on public.organizations for update to authenticated
  using (id = app.current_org_id() and app.is_admin())
  with check (id = app.current_org_id());

alter table public.org_settings enable row level security;
drop policy if exists org_settings_select on public.org_settings;
drop policy if exists org_settings_update on public.org_settings;
create policy org_settings_select on public.org_settings for select to authenticated
  using (org_id = app.current_org_id());
create policy org_settings_update on public.org_settings for update to authenticated
  using (org_id = app.current_org_id() and app.is_admin())
  with check (org_id = app.current_org_id());

-- ---- Profiller: büro üyeleri birbirini görür (liste kutuları için); kendi profilini sınırlı, admin hepsini değiştirir.
--      Profil oluşturma auth.users ile birlikte service_role / create_organization ile yapılır.
alter table public.profiles enable row level security;
drop policy if exists profiles_select on public.profiles;
drop policy if exists profiles_update on public.profiles;
drop policy if exists profiles_delete on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (org_id = app.current_org_id());
create policy profiles_update on public.profiles for update to authenticated
  using (org_id = app.current_org_id() and (id = auth.uid() or app.is_admin()))
  with check (org_id = app.current_org_id());
create policy profiles_delete on public.profiles for delete to authenticated
  using (org_id = app.current_org_id() and app.is_admin() and id <> auth.uid());

-- Storage temizlik sırası: istemciye kapalı (politika yok = hiç erişim yok)
alter table public.storage_cleanup enable row level security;

-- ---- Yetkiler: anon hiçbir şey göremez; authenticated yalnızca RLS'in izin verdiğini yapar -----------------------
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;
revoke all on public.storage_cleanup from authenticated;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on functions from anon;

-- Yazma yetkisi olmayan tablolar için ek koruma (RLS zaten engeller; kemer + pantolon askısı)
revoke insert, update, delete on public.activities, public.yearly_stats, public.org_archive from authenticated;
revoke insert, delete on public.organizations from authenticated;
revoke insert on public.profiles from authenticated;


-- =====================================================================================
-- 6. GÖRÜNÜMLER (yetki kontrolü görünümün içinde yapılır)
-- =====================================================================================

-- Masraf formundaki hesap seçimi: view değil RPC (UNRESTRICTED view uyarısı olmasın).
-- Avukat accounts.view olmadan da masraf formunda hesap seçer; accounts SELECT yine kapalı.
create or replace function public.account_options()
returns table (id uuid, org_id uuid, name text, type text, active boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, a.org_id, a.name, a.type, a.active
  from public.accounts a
  where a.org_id = app.current_org_id()
    and (app.can('accounts', 'view') or app.can('expenses', 'create'));
$$;
revoke all on function public.account_options() from public, anon;
grant execute on function public.account_options() to authenticated;

-- Hesap bakiyeleri (accounts.view) — security_invoker: UNRESTRICTED uyarısını giderir
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

-- Taksitler: ödenen / kalan / durum (fees.view)
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

-- Müvekkil cari bakiyesi (ledger.view): borç = müvekkil büroya borçlanır, alacak = müvekkilin ödemeleri
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
      -- büronun müvekkil adına ödediği masraflar
      coalesce((select sum(e.amount) from public.expenses e
                left join public.cases cs on cs.id = e.case_id and cs.org_id = e.org_id
                where e.org_id = c.org_id and e.charge_to = 'Müvekkil' and e.paid_by = 'Büro'
                  and coalesce(e.client_id, cs.client_id, (select en.client_id from public.enforcements en where en.id = e.enforcement_id and en.org_id = e.org_id)) = c.id), 0)
      -- ücret tahakkukları
      + coalesce((select sum(fp.total) from public.fee_plans fp where fp.org_id = c.org_id and fp.client_id = c.id and not fp.cancelled), 0)
      -- müvekkile yapılan ödemeler
      + coalesce((select sum(abs(t.amount)) from public.account_transactions t where t.org_id = c.org_id and t.client_id = c.id and t.category = 'Müvekkile aktarım'), 0)
      -- kapatılan dosyalardan / arşivden devreden
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

grant select on public.v_account_balances, public.v_installments, public.v_client_balances to authenticated;


-- =====================================================================================
-- 7. İŞ FONKSİYONLARI (RPC)
-- =====================================================================================

-- ---- Giriş: kullanıcı adından e-posta çöz (anon çağırabilir; yalnızca e-postayı döner) ----------------------
-- Not: kullanıcı adının var olup olmadığı anlaşılabilir. İstemezseniz bu fonksiyonu kaldırıp e-postayla giriş kullanın.
create or replace function public.resolve_login(p_identifier text) returns text
language sql stable security definer set search_path = '' as $$
  select p.email
  from public.profiles p
  where p.active and (lower(p.username) = lower(btrim(p_identifier)) or lower(p.email) = lower(btrim(p_identifier)))
  limit 1
$$;

-- ---- Yeni büro kur: auth.signUp'tan hemen sonra çağrılır; çağıran yönetici olur -------------------------------
create or replace function public.create_organization(
  p_org_name text, p_full_name text, p_username text, p_phone text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid(); v_org uuid; v_email text; v_user text := lower(btrim(p_username));
begin
  if v_uid is null then raise exception 'Önce giriş yapın' using errcode = '28000'; end if;
  if exists (select 1 from public.profiles where id = v_uid) then
    raise exception 'Bu hesap zaten bir büroya bağlı' using errcode = '23505';
  end if;
  if length(btrim(coalesce(p_org_name, ''))) = 0 then raise exception 'Büro adını girin' using errcode = '22023'; end if;
  if length(btrim(coalesce(p_full_name, ''))) = 0 then raise exception 'Adınızı girin' using errcode = '22023'; end if;
  if v_user !~ '^[a-z0-9çğıöşü._-]{3,}$' then
    raise exception 'Kullanıcı adı en az 3 karakter olmalı (harf, rakam, . _ -)' using errcode = '22023';
  end if;
  if exists (select 1 from public.profiles where lower(username) = v_user) then
    raise exception 'Bu kullanıcı adı alınmış' using errcode = '23505';
  end if;
  select email into v_email from auth.users where id = v_uid;

  perform set_config('app.skip_audit', '1', true);
  perform set_config('app.bootstrap', '1', true);
  insert into public.organizations (name) values (btrim(p_org_name)) returning id into v_org;
  insert into public.org_settings (org_id, firm)
    values (v_org, jsonb_build_object('name', btrim(p_org_name), 'legalName', btrim(p_org_name), 'email', v_email, 'phone', coalesce(p_phone, '')));
  insert into public.profiles (id, org_id, name, username, email, phone, title, role)
    values (v_uid, v_org, btrim(p_full_name), v_user, coalesce(v_email, ''), p_phone, 'Büro sahibi', 'admin');
  insert into public.accounts (org_id, name, type, created_by) values
    (v_org, 'Büro Kasası', 'Kasa', v_uid),
    (v_org, 'Barokart', 'Banka', v_uid);
  perform set_config('app.bootstrap', '', true);
  return v_org;
end $$;

-- ---- Taksite ödeme: tutar taksitlere sırayla dağıtılır, fazlası son taksite yazılır ---------------------------
create or replace function public.record_installment_payment(
  p_plan uuid, p_installment uuid, p_amount numeric, p_date date, p_method text,
  p_account uuid default null, p_note text default null
) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid := app.current_org_id(); v_left numeric := round(p_amount, 2); v_start int; v_n int := 0;
  r record; v_take numeric; v_last uuid;
begin
  if v_org is null then raise exception 'Oturum bulunamadı' using errcode = '28000'; end if;
  if not app.can('fees', 'edit') then raise exception 'Tahsilat alma yetkiniz yok' using errcode = '42501'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Tutar sıfırdan büyük olmalı' using errcode = '22023'; end if;
  if not exists (select 1 from public.fee_plans where id = p_plan and org_id = v_org) then
    raise exception 'Plan bulunamadı' using errcode = 'P0002';
  end if;
  select position into v_start from public.installments where id = p_installment and plan_id = p_plan and org_id = v_org;
  if v_start is null then raise exception 'Taksit bulunamadı' using errcode = 'P0002'; end if;

  -- seçilen taksitten başlayıp sona, sonra baştan dolaşır
  for r in
    select i.id, i.position, i.amount,
           i.amount - coalesce((select sum(p.amount) from public.installment_payments p where p.installment_id = i.id), 0) as room
    from public.installments i
    where i.plan_id = p_plan and i.org_id = v_org
    order by (case when i.position >= v_start then 0 else 1 end), i.position
  loop
    v_last := r.id;
    exit when v_left <= 0;
    continue when r.room <= 0.005;
    v_take := least(r.room, v_left);
    insert into public.installment_payments (installment_id, date, amount, method, account_id, note)
      values (r.id, p_date, round(v_take, 2), p_method, p_account, p_note);
    v_left := round(v_left - v_take, 2);
    v_n := v_n + 1;
  end loop;
  if v_left > 0 then   -- planın tamamını aşan fazla tutar son taksite yazılır
    insert into public.installment_payments (installment_id, date, amount, method, account_id, note)
      values (v_last, p_date, v_left, p_method, p_account, p_note);
    v_n := v_n + 1;
  end if;
  return v_n;
end $$;

-- ---- Aylık ücret tahakkuku (bir büro için; yinelenen çalıştırma güvenlidir) ------------------------------------
create or replace function app.accrue_org(p_org uuid, p_period text) returns int
language plpgsql security definer set search_path = '' as $$
declare r record; v_plan uuid; v_n int := 0; v_first date := to_date(p_period || '-01', 'YYYY-MM-DD');
begin
  for r in
    select c.id, c.monthly_fee
    from public.clients c
    where c.org_id = p_org and c.status = 'Aktif' and coalesce(c.monthly_fee, 0) > 0
      and (c.monthly_fee_start_date is null or to_char(c.monthly_fee_start_date, 'YYYY-MM') <= p_period)
      and not exists (select 1 from public.fee_plans fp
                      where fp.org_id = p_org and fp.client_id = c.id and fp.period = p_period and not fp.cancelled)
  loop
    insert into public.fee_plans (org_id, title, kind, client_id, date, total, period)
      values (p_org, 'Aylık danışmanlık ücreti', 'Aylık ücret', r.id, v_first, r.monthly_fee, p_period)
      on conflict do nothing
      returning id into v_plan;
    if v_plan is not null then
      insert into public.installments (org_id, plan_id, position, due_date, amount)
        values (p_org, v_plan, 1, v_first + 4, r.monthly_fee);   -- ayın 5'i
      v_n := v_n + 1;
    end if;
    v_plan := null;
  end loop;
  return v_n;
end $$;

create or replace function public.accrue_monthly_fees(p_period text default null) returns int
language plpgsql security definer set search_path = '' as $$
declare v_org uuid := app.current_org_id(); v_tz text; v_period text;
begin
  if v_org is null then raise exception 'Oturum bulunamadı' using errcode = '28000'; end if;
  if not app.can('fees', 'create') then raise exception 'Bu işlem için yetkiniz yok' using errcode = '42501'; end if;
  select timezone into v_tz from public.organizations where id = v_org;
  v_period := coalesce(p_period, to_char((now() at time zone v_tz)::date, 'YYYY-MM'));
  if v_period !~ '^\d{4}-(0[1-9]|1[0-2])$' then raise exception 'Dönem YYYY-AA biçiminde olmalı' using errcode = '22023'; end if;
  return app.accrue_org(v_org, v_period);
end $$;

-- ---- Yıllık özete ekleme yardımcıları -----------------------------------------------------------------------------
create or replace function app.add_year_stats(
  p_org uuid, p_year int, p_fee numeric default 0, p_icra numeric default 0, p_office numeric default 0,
  p_client numeric default 0, p_oincome numeric default 0, p_oexpense numeric default 0, p_closed int default 0
) returns void
language sql security definer set search_path = '' as $$
  insert into public.yearly_stats as y (org_id, year, fee_income, icra_collected, office_expense, client_expense, other_income, other_expense, closed_cases)
  values (p_org, p_year, round(p_fee, 2), round(p_icra, 2), round(p_office, 2), round(p_client, 2), round(p_oincome, 2), round(p_oexpense, 2), p_closed)
  on conflict (org_id, year) do update set
    fee_income = round(y.fee_income + excluded.fee_income, 2),
    icra_collected = round(y.icra_collected + excluded.icra_collected, 2),
    office_expense = round(y.office_expense + excluded.office_expense, 2),
    client_expense = round(y.client_expense + excluded.client_expense, 2),
    other_income = round(y.other_income + excluded.other_income, 2),
    other_expense = round(y.other_expense + excluded.other_expense, 2),
    closed_cases = y.closed_cases + excluded.closed_cases,
    updated_at = now()
$$;

-- ---- Dosyayı kapat: dosya ve bağlı kayıtlar silinir, müvekkilde yalnızca toplamlar kalır -------------------------
create or replace function public.close_case(p_case uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid := app.current_org_id(); c public.cases%rowtype; v_tz text; v_year int;
  v_debit numeric; v_credit numeric; v_net numeric; v_fee_total numeric; v_fee_paid numeric;
  v_recv numeric := 0; v_pay numeric := 0; r record;
begin
  if v_org is null then raise exception 'Oturum bulunamadı' using errcode = '28000'; end if;
  if not app.can('cases', 'delete') then raise exception 'Dosyayı kapatma yetkiniz yok' using errcode = '42501'; end if;
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
    values (v_org, auth.uid(), 'İşlem', 'Dosya', p_case,
            format('Dosya kapatıldı ve silindi · %s · alacak %s / verecek %s', c.no, v_recv, v_pay));
  return jsonb_build_object('receivable', v_recv, 'payable', v_pay, 'fee_total', v_fee_total, 'fee_paid', v_fee_paid);
end $$;

-- ---- Eski yılları arşivle: ayrıntı silinir; yıllık toplamlar, hesap bakiyeleri ve cari bakiyeler korunur ----------
create or replace function app.archive_org(p_org uuid, p_through int) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_end date := make_date(p_through, 12, 31); v_total int := 0; n int; r record; v_tz text; v_now timestamptz := now();
begin
  perform set_config('app.skip_audit', '1', true);
  select timezone into v_tz from public.organizations where id = p_org;

  -- Aday kümeler
  drop table if exists pg_temp._a_plans;  drop table if exists pg_temp._a_cols;
  create temp table _a_plans on commit drop as
    select fp.id, fp.client_id, fp.cancelled
    from public.fee_plans fp
    where fp.org_id = p_org and fp.date <= v_end
      and (fp.cancelled or fp.total - coalesce((select sum(p.amount) from public.installment_payments p
                                                join public.installments i on i.id = p.installment_id and i.org_id = p.org_id
                                                where i.plan_id = fp.id), 0) <= 0.005)
      and not exists (select 1 from public.installment_payments p
                      join public.installments i on i.id = p.installment_id and i.org_id = p.org_id
                      where i.plan_id = fp.id and p.date > v_end);
  create temp table _a_cols on commit drop as
    select co.id, co.amount, co.date, co.account_id, en.client_id
    from public.collections co
    join public.enforcements en on en.id = co.enforcement_id and en.org_id = co.org_id
    where co.org_id = p_org and co.date <= v_end and co.transferred_to_client;

  -- Müvekkil carisine devir: silinen satırların neti (borç − alacak)
  for r in
    select client_id, round(sum(debit - credit), 2) as net from (
      select coalesce(e.client_id, cs.client_id, en.client_id) as client_id, e.amount as debit, 0::numeric as credit
        from public.expenses e
        left join public.cases cs on cs.id = e.case_id and cs.org_id = e.org_id
        left join public.enforcements en on en.id = e.enforcement_id and en.org_id = e.org_id
        where e.org_id = p_org and e.date <= v_end and e.charge_to = 'Müvekkil' and e.paid_by = 'Büro'
      union all
      select ap.client_id, fp.total, 0 from _a_plans ap join public.fee_plans fp on fp.id = ap.id where not ap.cancelled
      union all
      select ap.client_id, 0, p.amount from _a_plans ap
        join public.installments i on i.plan_id = ap.id
        join public.installment_payments p on p.installment_id = i.id
        where not ap.cancelled
      union all
      select t.client_id, abs(t.amount), 0 from public.account_transactions t
        where t.org_id = p_org and t.date <= v_end and t.category = 'Müvekkile aktarım' and t.client_id is not null
      union all
      select ac.client_id, 0, ac.amount from _a_cols ac
    ) q where client_id is not null group by client_id
  loop
    if abs(r.net) >= 0.005 then
      update public.clients set
        closed_receivable = round(closed_receivable + greatest(r.net, 0), 2),
        closed_payable    = round(closed_payable + greatest(-r.net, 0), 2),
        closed_last_at    = coalesce(closed_last_at, v_now)
      where id = r.client_id and org_id = p_org;
    end if;
  end loop;

  -- Yıllık toplamlar
  for r in
    select y,
      sum(fee) as fee, sum(icra) as icra, sum(office) as office, sum(client) as client, sum(oin) as oin, sum(oout) as oout
    from (
      select extract(year from p.date)::int as y, p.amount as fee, 0::numeric as icra, 0::numeric as office, 0::numeric as client, 0::numeric as oin, 0::numeric as oout
        from _a_plans ap join public.installments i on i.plan_id = ap.id join public.installment_payments p on p.installment_id = i.id
      union all select extract(year from date)::int, 0, amount, 0, 0, 0, 0 from _a_cols
      union all select extract(year from e.date)::int, 0, 0,
                 case when e.charge_to = 'Büro' then e.amount else 0 end, case when e.charge_to = 'Büro' then 0 else e.amount end, 0, 0
        from public.expenses e where e.org_id = p_org and e.date <= v_end
      union all select extract(year from t.date)::int, 0, 0, 0, 0,
                 case when t.category = 'Diğer gelir' then t.amount else 0 end,
                 case when t.category = 'Diğer gider' then abs(t.amount) else 0 end
        from public.account_transactions t where t.org_id = p_org and t.date <= v_end
    ) q group by y
  loop
    perform app.add_year_stats(p_org, r.y, r.fee, r.icra, r.office, r.client, r.oin, r.oout);
  end loop;

  -- Kasa / banka: silinen hareketlerin etkisi açılış bakiyesine eklenir
  update public.accounts a set opening_balance = round(a.opening_balance + d.delta, 2), updated_at = now()
  from (
    select account_id, sum(delta) as delta from (
      select e.account_id, -e.amount as delta from public.expenses e
        where e.org_id = p_org and e.date <= v_end and e.paid_by = 'Büro' and e.account_id is not null
      union all select p.account_id, p.amount from _a_plans ap
        join public.installments i on i.plan_id = ap.id join public.installment_payments p on p.installment_id = i.id
        where p.account_id is not null
      union all select account_id, amount from _a_cols where account_id is not null
      union all select t.account_id, t.amount from public.account_transactions t where t.org_id = p_org and t.date <= v_end
    ) q group by account_id
  ) d
  where a.id = d.account_id and a.org_id = p_org and d.delta <> 0;

  -- Silme
  delete from public.expenses where org_id = p_org and date <= v_end;                         get diagnostics n = row_count; v_total := v_total + n;
  delete from public.fee_plans where id in (select id from _a_plans);                         get diagnostics n = row_count; v_total := v_total + n;
  delete from public.collections where id in (select id from _a_cols);                        get diagnostics n = row_count; v_total := v_total + n;
  delete from public.account_transactions where org_id = p_org and date <= v_end;             get diagnostics n = row_count; v_total := v_total + n;
  delete from public.reminders where org_id = p_org and date <= v_end and status <> 'Bekliyor';        get diagnostics n = row_count; v_total := v_total + n;
  delete from public.payment_promises where org_id = p_org and due_date <= v_end and status <> 'Bekliyor'; get diagnostics n = row_count; v_total := v_total + n;
  delete from public.contact_logs where org_id = p_org and date <= v_end;                     get diagnostics n = row_count; v_total := v_total + n;
  delete from public.activities where org_id = p_org and created_at < (v_end + 1)::timestamptz;    get diagnostics n = row_count; v_total := v_total + n;
  delete from public.notifications where org_id = p_org and created_at < (v_end + 1)::timestamptz; get diagnostics n = row_count; v_total := v_total + n;

  insert into public.org_archive (org_id, archived_through) values (p_org, p_through)
    on conflict (org_id) do update set archived_through = greatest(public.org_archive.archived_through, excluded.archived_through);
  insert into public.activities (org_id, actor_id, action, entity, detail)
    values (p_org, auth.uid(), 'İşlem', 'Arşiv', format('%s ve öncesi arşivlendi · %s kayıt silindi, yıllık toplamlar saklandı', p_through, v_total));
  drop table if exists pg_temp._a_plans;  drop table if exists pg_temp._a_cols;
  return v_total;
end $$;

create or replace function public.archive_years(p_through int) returns int
language plpgsql security definer set search_path = '' as $$
declare v_org uuid := app.current_org_id(); v_tz text; v_year int;
begin
  if v_org is null then raise exception 'Oturum bulunamadı' using errcode = '28000'; end if;
  if not app.is_admin() then raise exception 'Arşivleme yalnızca yönetici yapabilir' using errcode = '42501'; end if;
  select timezone into v_tz from public.organizations where id = v_org;
  v_year := extract(year from (now() at time zone v_tz))::int;
  if p_through is null or p_through >= v_year then
    raise exception 'Yalnızca geçmiş yıllar arşivlenebilir' using errcode = '22023';
  end if;
  return app.archive_org(v_org, p_through);
end $$;

-- ---- Kullanıcı kimliğini yalnızca yönetici başka büroya taşıyamaz: profil ekleme service_role ile -------------------

-- Çağrılabilir fonksiyonlar: yalnızca giriş yapmış kullanıcı (resolve_login hariç)
revoke all on function public.create_organization(text, text, text, text) from public, anon;
revoke all on function public.record_installment_payment(uuid, uuid, numeric, date, text, uuid, text) from public, anon;
revoke all on function public.accrue_monthly_fees(text) from public, anon;
revoke all on function public.close_case(uuid) from public, anon;
revoke all on function public.archive_years(int) from public, anon;
revoke all on function public.my_permissions() from public, anon;
revoke all on function public.resolve_login(text) from public;
grant execute on function public.create_organization(text, text, text, text) to authenticated;
grant execute on function public.record_installment_payment(uuid, uuid, numeric, date, text, uuid, text) to authenticated;
grant execute on function public.accrue_monthly_fees(text) to authenticated;
grant execute on function public.close_case(uuid) to authenticated;
grant execute on function public.archive_years(int) to authenticated;
grant execute on function public.my_permissions() to authenticated;
grant execute on function public.resolve_login(text) to anon, authenticated;

-- app şemasındaki yardımcılar: yalnızca RLS ifadeleri için authenticated çağırabilir; zamanlanmış işler yalnızca postgres
revoke all on all functions in schema app from public, anon, authenticated;
grant execute on function app.current_org_id(), app.is_admin(), app.can(text, text), app.can_user(uuid, text, text) to authenticated;


-- =====================================================================================
-- 8. ZAMANLANMIŞ İŞLER
-- =====================================================================================

-- ---- Her gün: bütün bürolar için içinde bulunulan ayın aylık ücretini oluştur (yinelenen çalıştırma zararsız) ------
create or replace function app.cron_accrue_fees() returns int
language plpgsql security definer set search_path = '' as $$
declare r record; v_n int := 0; v_k int;
begin
  for r in select id, timezone from public.organizations where active loop
    v_k := app.accrue_org(r.id, to_char((now() at time zone r.timezone)::date, 'YYYY-MM'));
    v_n := v_n + v_k;
  end loop;
  return v_n;
end $$;

-- ---- Her gün: uyarı bildirimleri (geciken / yaklaşan taksit, yarınki ajanda, geciken ödeme sözü) -------------------
create or replace function app.cron_notifications() returns int
language plpgsql security definer set search_path = '' as $$
declare r record; v_n int := 0; k int; v_today date;
begin
  for r in select id, timezone from public.organizations where active loop
    v_today := (now() at time zone r.timezone)::date;

    -- Geciken taksitler: tahsilat görme izni olanlara, taksit başına bir kez
    insert into public.notifications (org_id, user_id, title, detail, type, link, dedupe_key)
    select r.id, p.id, 'Geciken taksit',
           c.name || ' · ' || to_char(i.amount - paid.s, 'FM999999990.00') || ' ₺', 'Taksit', '/tahsilatlar',
           'inst-overdue:' || i.id
    from public.installments i
    join public.fee_plans fp on fp.id = i.plan_id and fp.org_id = i.org_id and not fp.cancelled
    join public.clients c on c.id = fp.client_id and c.org_id = fp.org_id
    cross join lateral (select coalesce(sum(x.amount), 0) as s from public.installment_payments x where x.installment_id = i.id) paid
    join public.profiles p on p.org_id = i.org_id and p.active and app.can_user(p.id, 'fees', 'view')
    where i.org_id = r.id and i.due_date < v_today and i.amount - paid.s > 0.005
    on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
    get diagnostics k = row_count; v_n := v_n + k;

    -- 3 gün içinde vadesi gelen taksitler
    insert into public.notifications (org_id, user_id, title, detail, type, link, dedupe_key)
    select r.id, p.id, 'Vadesi yaklaşan taksit',
           c.name || ' · ' || to_char(i.amount - paid.s, 'FM999999990.00') || ' ₺ · ' || to_char(i.due_date, 'DD.MM.YYYY'), 'Taksit', '/tahsilatlar',
           'inst-soon:' || i.id
    from public.installments i
    join public.fee_plans fp on fp.id = i.plan_id and fp.org_id = i.org_id and not fp.cancelled
    join public.clients c on c.id = fp.client_id and c.org_id = fp.org_id
    cross join lateral (select coalesce(sum(x.amount), 0) as s from public.installment_payments x where x.installment_id = i.id) paid
    join public.profiles p on p.org_id = i.org_id and p.active and app.can_user(p.id, 'fees', 'view')
    where i.org_id = r.id and i.due_date between v_today and v_today + 3 and i.amount - paid.s > 0.005
    on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
    get diagnostics k = row_count; v_n := v_n + k;

    -- Bugün / yarın ajanda: sorumlusuna, gün başına bir kez
    insert into public.notifications (org_id, user_id, title, detail, type, link, dedupe_key)
    select r.id, rm.assignee_id,
           case when rm.date = v_today then 'Bugün: ' else 'Yarın: ' end || rm.type, rm.title, 'Ajanda', '/takvim',
           'rem:' || rm.id || ':' || (case when rm.date = v_today then 'today' else 'tomorrow' end)
    from public.reminders rm
    join public.profiles p on p.id = rm.assignee_id and p.active
    where rm.org_id = r.id and rm.status = 'Bekliyor' and rm.date between v_today and v_today + 1
    on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
    get diagnostics k = row_count; v_n := v_n + k;

    -- Vadesi geçen ödeme sözü / borçlu taksiti: icra dosyasının sorumlularına
    insert into public.notifications (org_id, user_id, title, detail, type, link, dedupe_key)
    select r.id, resp.uid, 'Ödeme sözü tutulmadı',
           d.name || ' · ' || to_char(pp.amount, 'FM999999990.00') || ' ₺', 'Ödeme sözü', '/icra/' || en.id,
           'prm:' || pp.id
    from public.payment_promises pp
    join public.enforcements en on en.id = pp.enforcement_id and en.org_id = pp.org_id
    join public.debtors d on d.id = pp.debtor_id and d.org_id = pp.org_id
    cross join lateral unnest(en.responsible_ids) as resp(uid)
    join public.profiles p on p.id = resp.uid and p.org_id = r.id and p.active
    where pp.org_id = r.id and pp.status = 'Bekliyor' and pp.due_date < v_today
    on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
    get diagnostics k = row_count; v_n := v_n + k;
  end loop;
  return v_n;
end $$;

-- ---- Haftalık: saklama süresi — eski bildirim / aktivite silinir, ayarlıysa eski yıllar otomatik arşivlenir -------
create or replace function app.cron_retention() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  r record; v_year int; v_through int; n int;
  v_notif int := 0; v_act int := 0; v_arch int := 0; v_storage int := 0;
begin
  perform set_config('app.skip_audit', '1', true);
  -- Okunmuş bildirimler 30 gün, okunmamışlar 120 gün tutulur
  delete from public.notifications where (read and created_at < now() - interval '30 days') or created_at < now() - interval '120 days';
  get diagnostics n = row_count; v_notif := n;

  for r in select id, timezone, retention_months, auto_archive_keep_years, last_auto_archive_year
           from public.organizations where active loop
    delete from public.activities where org_id = r.id and created_at < now() - make_interval(months => r.retention_months);
    get diagnostics n = row_count; v_act := v_act + n;

    -- Otomatik arşiv: yılda bir kez; "N tam yıl tut" → bundan eski yıllar arşivlenir
    if r.auto_archive_keep_years is not null then
      v_year := extract(year from (now() at time zone r.timezone))::int;
      v_through := v_year - r.auto_archive_keep_years - 1;
      if v_through >= 2000 and coalesce(r.last_auto_archive_year, 0) < v_year then
        v_arch := v_arch + app.archive_org(r.id, v_through);
        update public.organizations set last_auto_archive_year = v_year where id = r.id;
      end if;
    end if;
  end loop;

  -- Yüklenip hiçbir kayda bağlanmamış (form iptal edilmiş) ekler 2 gün sonra silinir
  delete from public.attachments where entity_id is null and entity <> 'logo' and created_at < now() - interval '2 days'
    and not exists (select 1 from public.documents d where d.attachment_id = public.attachments.id);

  -- pg_cron çalışma geçmişi şişmesin (14 günden eskisi silinir)
  if to_regclass('cron.job_run_details') is not null then
    execute $q$delete from cron.job_run_details where end_time < now() - interval '14 days'$q$;
  end if;

  -- Storage: kaydı silinmiş eklerin dosyalarını sıradan düşür.
  -- storage.objects satırını silmek dosyayı erişilemez yapar; fiziksel silme için Edge Function / Storage API kullanın.
  if to_regclass('storage.objects') is not null then
    execute $q$
      delete from storage.objects o using public.storage_cleanup c
      where o.bucket_id = 'attachments' and o.name = c.path
    $q$;
  end if;
  delete from public.storage_cleanup where queued_at < now() - interval '1 day';
  get diagnostics n = row_count; v_storage := n;

  return jsonb_build_object('notifications', v_notif, 'activities', v_act, 'archived', v_arch, 'storage_queue', v_storage);
end $$;

-- ---- Keepalive: ücretsiz Supabase projesi bir hafta hareketsiz kalırsa uykuya alınır ----------------------------
-- Projenin kendi API adresine 5 günde bir küçük bir istek (rpc/keepalive → 1) atar. Veri yazmaz, depolama / kullanım doldurmaz.
-- Kurulum (SQL Editor, bir kere):
--   insert into app.config (key, value) values
--     ('project_url', 'https://<proje-kodu>.supabase.co'),
--     ('anon_key',    '<anon (public) anahtarı>')
--   on conflict (key) do update set value = excluded.value;
create table if not exists app.config (
  key   text primary key,
  value text not null
);
revoke all on app.config from public, anon, authenticated;

create or replace function public.keepalive() returns int
language sql stable set search_path = '' as $$ select 1 $$;
revoke all on function public.keepalive() from public;
grant execute on function public.keepalive() to anon, authenticated;

create or replace function app.cron_keepalive() returns text
language plpgsql security definer set search_path = '' as $$
declare v_url text; v_key text; v_id bigint;
begin
  select value into v_url from app.config where key = 'project_url';
  select value into v_key from app.config where key = 'anon_key';
  if v_url is null or v_key is null then
    raise notice 'keepalive: app.config içinde project_url / anon_key tanımlı değil; istek atılmadı';
    return 'ayarlanmadı';
  end if;
  if to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is null then
    raise notice 'keepalive: pg_net uzantısı kapalı; Database > Extensions > pg_net''i açın';
    return 'pg_net yok';
  end if;
  execute format(
    'select net.http_post(url := %L, body := %L::jsonb, headers := %L::jsonb, timeout_milliseconds := 5000)',
    rtrim(v_url, '/') || '/rest/v1/rpc/keepalive',
    '{}',
    jsonb_build_object('apikey', v_key, 'Authorization', 'Bearer ' || v_key, 'Content-Type', 'application/json')::text
  ) into v_id;
  return 'gönderildi #' || v_id;
end $$;
revoke all on function app.cron_keepalive() from public, anon, authenticated;

-- ---- pg_cron zamanlaması (pg_cron kuruluysa) -------------------------------------------------------------------------
-- Saatler UTC'dir; Türkiye (UTC+3) karşılıkları yanlarında.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    begin
      create extension if not exists pg_cron;
    exception when others then
      raise notice 'pg_cron açılamadı (%). Dashboard > Database > Extensions bölümünden açıp dosyanın bu bölümünü yeniden çalıştırın.', sqlerrm;
    end;
  end if;

  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    begin
      create extension if not exists pg_net;
    exception when others then
      raise notice 'pg_net açılamadı (%). Keepalive için Database > Extensions > pg_net''i açın.', sqlerrm;
    end;
  end if;

  if to_regclass('cron.job') is not null then
    perform cron.unschedule(jobid) from cron.job
      where jobname in ('lexkasa-aylik-ucret', 'lexkasa-bildirimler', 'lexkasa-saklama', 'lexkasa-keepalive');
    -- Her Pazartesi 00:10 (TR) — içinde bulunulan ayın ücreti yoksa oluşturur
    perform cron.schedule('lexkasa-aylik-ucret', '10 21 * * 0', 'select app.cron_accrue_fees()');
    -- Her Pazartesi 08:00 (TR) — geciken / yaklaşan taksit, ajanda ve ödeme sözü uyarıları
    perform cron.schedule('lexkasa-bildirimler', '0 5 * * 1', 'select app.cron_notifications()');
    -- Her Pazartesi 03:30 (TR) — eski bildirim / aktivite temizliği ve (ayarlıysa) otomatik arşiv
    perform cron.schedule('lexkasa-saklama', '30 0 * * 1', 'select app.cron_retention()');
    -- 5 günde bir 09:00 (TR) — proje uykuya geçmesin (veri yazmaz)
    perform cron.schedule('lexkasa-keepalive', '0 6 */5 * *', 'select app.cron_keepalive()');
  else
    raise notice 'pg_cron yok: zamanlanmış işler kurulmadı. app.cron_accrue_fees(), app.cron_notifications(), app.cron_retention() ve app.cron_keepalive() elle ya da Edge Function ile çağrılabilir.';
  end if;
end $$;


-- =====================================================================================
-- 9. STORAGE (dosya ekleri)
-- =====================================================================================
-- Kova "attachments": özel (public değil). Dosya yolu: <org_id>/<uuid>

do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit)
      values ('attachments', 'attachments', false, 15 * 1024 * 1024)
      on conflict (id) do update set public = false, file_size_limit = 15 * 1024 * 1024;

    drop policy if exists "attachments_read" on storage.objects;
    drop policy if exists "attachments_write" on storage.objects;
    drop policy if exists "attachments_remove" on storage.objects;
    -- Okuma: yalnızca kendi bürosunun klasörü; dosya, künyesini RLS ile görebildiğin bir ek olmalı.
    -- Yükleyen kişi künye satırı henüz yokken de (yükleme sırasında RETURNING) kendi dosyasını görebilir.
    create policy "attachments_read" on storage.objects for select to authenticated
      using (bucket_id = 'attachments'
             and (storage.foldername(name))[1] = app.current_org_id()::text
             and (owner_id = auth.uid()::text
                  -- 'objects.name' açıkça yazılır: attachments tablosunda da 'name' sütunu var
                  or exists (select 1 from public.attachments a where a.storage_path = objects.name)));
    -- Yükleme: kendi büro klasörüne; belge / masraf ekleme izni olan ya da admin
    create policy "attachments_write" on storage.objects for insert to authenticated
      with check (bucket_id = 'attachments'
                  and (storage.foldername(name))[1] = app.current_org_id()::text
                  and (app.can('documents', 'create') or app.can('expenses', 'create') or app.is_admin()));
    -- Silme: yalnızca admin (ekin kendisi künyeyle birlikte tetikleyici + zamanlanmış işle temizlenir)
    create policy "attachments_remove" on storage.objects for delete to authenticated
      using (bucket_id = 'attachments'
             and (storage.foldername(name))[1] = app.current_org_id()::text
             and app.is_admin());
  end if;
end $$;

-- Gerçek zamanlı güncelleme (isteğe bağlı): veri tabloları yayına eklenir
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['clients','cases','expenses','fee_plans','installments','installment_payments',
                             'reminders','notifications','enforcements','payment_promises','collections'] loop
      begin
        execute format('alter publication supabase_realtime add table public.%I', t);
      exception when duplicate_object then null;
      end;
    end loop;
  end if;
end $$;
