# LexKasa / Avukat Yönetim Paneli: Proje nasıl çalışır?

> Geliştirici gözüyle, kodun **16.10.2026 (commit `6ba482f`)** itibarıyla son hali.
> Kullanıcı kılavuzu için `KURGU.md`, avukata giden değişiklik notları için `YENILIKLER.md` / `SON-EKLENENLER.md` var.
> Bu belge "kod içeride ne yapıyor, hangi iş ne zaman çalışıyor" sorusunun cevabı.

---

## İçindekiler

1. [Tek cümlede proje](#1-tek-cümlede-proje)
2. [Teknoloji ve mimari](#2-teknoloji-ve-mimari)
3. [Klasör haritası](#3-klasör-haritası)
4. [Bir isteğin yolculuğu (açılıştan ekrana)](#4-bir-isteğin-yolculuğu)
5. [Giriş, oturum, kullanıcılar](#5-giriş-oturum-kullanıcılar)
6. [Veri katmanı: ekran ↔ Supabase](#6-veri-katmanı)
7. [Yetki sistemi (RLS + İzinler ekranı)](#7-yetki-sistemi)
8. [Veritabanı tabloları](#8-veritabanı-tabloları)
9. [Zamanlanmış işler (pg_cron): ne zaman ne kontrol ediliyor?](#9-zamanlanmış-işler-pg_cron)
10. [Bildirim ve uyarıların 3 kaynağı](#10-bildirim-ve-uyarıların-3-kaynağı)
11. [Modüllerin iş mantığı](#11-modüllerin-iş-mantığı)
12. [İcra süre motoru (89/1-89/2-89/3, kesinleştirme, haciz...)](#12-icra-süre-motoru)
13. [Dosyalar, Excel, yedek](#13-dosyalar-excel-yedek)
14. [Güvenlik, hata izleme, test](#14-güvenlik-hata-izleme-test)
15. [Kurulum ve deploy](#15-kurulum-ve-deploy)
16. [Git geçmişi: proje nasıl bu hale geldi](#16-git-geçmişi)
17. [Dikkat: bilinen tuhaflıklar, eskimiş belgeler, riskler](#17-dikkat-bilinen-tuhaflıklar)

---

## 1. Tek cümlede proje

Hukuk büroları için **çok kiracılı (multi-tenant)** bir yönetim paneli: müvekkil, dava dosyası, masraf, vekalet ücreti/taksit, cari hesap, banka/kasa ve **icra takibi** (alacaklı ve borçlu olduğumuz dosyalar, borçlular, 89/1-2-3 haciz ihbarnameleri, süre hatırlatmaları) tek yerde. Her büro (organization) kendi verisini görür; veriler **Supabase** (Postgres + Auth + Storage) üzerinde, yetkiler **veritabanında (RLS)** zorunlu, hatırlatmalar **pg_cron** ile sunucuda üretiliyor.

---

## 2. Teknoloji ve mimari

| Katman | Ne kullanılıyor |
|---|---|
| Framework | **TanStack Start** (React 19 + SSR), dosya tabanlı yönlendirme: **TanStack Router** |
| UI | Tailwind CSS v4, shadcn/ui (Radix), lucide ikonlar, Recharts (grafikler), sonner (toast) |
| Form | react-hook-form + zod (bazı formlarda) |
| Veri | `@supabase/supabase-js` ile doğrudan tarayıcıdan Supabase'e (ayrı bir API sunucusu **yok**) |
| Sunucu | Supabase: Postgres + RLS + RPC fonksiyonları + pg_cron + pg_net + Storage + 1 Edge Function |
| Excel | Kendi yazılmış xlsx okuyucu/yazıcı (`fflate` ile zip) |
| Hata izleme | Sentry (opsiyonel, DSN verilirse) |
| Build / host | Vite 8 + Nitro, `@lovable.dev/vite-tanstack-config` (varsayılan hedef Cloudflare) |
| Proje bağlantısı | **Lovable**'a bağlı: `main`'e push edilen her commit Lovable editöründe görünür |

```
 Tarayıcı (React)                                   Supabase
┌──────────────────────────────┐   HTTPS/REST    ┌──────────────────────────────────┐
│ routes/*  (sayfalar)         │ ──────────────▶ │ Postgres                         │
│   │                          │   supabase-js   │  ├─ tablolar (her satır org_id)  │
│   ▼                          │                 │  ├─ RLS politikaları (app.can)   │
│ useErp()  ← erp-store.tsx    │ ◀────────────── │  ├─ view'lar (bakiye, süreler)   │
│   (tüm büro verisi bellekte) │                 │  ├─ RPC (close_case, tahsilat..) │
│ finance.ts (hesaplar/uyarı)  │                 │  └─ pg_cron işleri ─┐            │
└──────────────────────────────┘                 │ Auth (e-posta+şifre)│            │
        ▲                                        │ Storage "attachments"            │
        │ SSR HTML + güvenlik başlıkları         │ Edge Fn "invite-user"            │
 src/server.ts (Nitro / Cloudflare)              └──────────────────────────────────┘
```

**Önemli fikir:** Uygulamanın "backend"i aslında Postgres'in kendisi. İş kuralları ya **SQL fonksiyonlarında** (para dağıtma, dosya kapatma, cron) ya da **`src/lib/finance.ts`**'te (ekranda gösterilen hesaplar) duruyor. SSR sunucusu (`src/server.ts`) sadece HTML üretip güvenlik başlıklarını ekliyor; veri işlemiyor.

---

## 3. Klasör haritası

```
legal-suite/
├─ src/
│  ├─ server.ts            SSR giriş noktası: hata sayfası + güvenlik başlıkları (CSP, HSTS, noindex…)
│  ├─ start.ts             TanStack Start middleware'leri (hata yakalama + CSRF)
│  ├─ router.tsx           Router + React Query, Sentry başlatma, önyükleme ayarları
│  ├─ routeTree.gen.ts     OTOMATİK üretilir, elle düzenlenmez
│  ├─ routes/              Her dosya bir sayfa (aşağıda liste)
│  ├─ lib/
│  │  ├─ supabase.ts       Supabase client + "Beni hatırla" + sekmeler arası oturum paylaşımı
│  │  ├─ erp-store.tsx     ★ Uygulamanın kalbi: oturum, tüm state, CRUD, RPC çağrıları (useErp)
│  │  ├─ supabase-data.ts  Girişte büronun TÜM tablolarını çekme, kaydetme/silme yardımcıları
│  │  ├─ mappers.ts        DB satırı (snake_case) ↔ uygulama tipi (camelCase) dönüşümleri
│  │  ├─ erp-types.ts      Veri modeli, izin modülleri, kilitli liste değerleri, permissionsFor()
│  │  ├─ erp-data.ts       Varsayılan ayarlar / boş state (VITE_DEMO=1 ise demo veri)
│  │  ├─ finance.ts        ★ Taksit, cari, kasa, icra özetleri, icra süreleri, uyarılar (computeAlerts)
│  │  ├─ import-specs.ts   Excel toplu aktarım: sütunlar, doğrulama, kayıt üretimi
│  │  ├─ excel*.ts         xlsx okuma/yazma, şablon üretimi
│  │  ├─ attachments.ts    Storage'a dosya yükleme / indirme
│  │  ├─ backup.ts         Zip yedek indirme
│  │  ├─ cron-display.ts   Cron ifadelerini Türkçe'ye çevirme (Ayarlar → Zamanlama)
│  │  ├─ sentry.ts         Kişisel veriyi maskeleyerek Sentry'ye gönderme
│  │  ├─ migrations.ts     ESKİ localStorage dönemi state şema göçleri (artık normalize için)
│  │  └─ auth.ts           Sadece passwordProblem() kullanılıyor (PBKDF2 kısmı eski kalıntı)
│  └─ components/
│     ├─ layout/           Sidebar, Topbar, Ctrl+K komut paleti, nav.ts (menü + izin filtreleri)
│     ├─ forms/            Tüm kayıt formları; useQuick().open(...) ile her yerden açılır
│     ├─ app/              DataTable, FormDialog, StatTile, PrintSheet, FirstPasswordGate…
│     ├─ lists/            İcra listesi (EnforcementList), taksit planı vs. tabloları
│     ├─ settings/         İzinler, Kategoriler, Bankalar, İcra kuralları, Şirket listeleri, Zamanlama
│     ├─ import/           Excel aktarım diyaloğu (önizleme, satır düzeltme)
│     ├─ icra/             İcra işlem (event) verisi bileşenleri (sorgu, 89/x bankalar…)
│     └─ ui/               shadcn bileşenleri
├─ supabase/
│  ├─ migrations/          11 SQL dosyası, tarih sırasıyla uygulanır (bkz. §8, §16)
│  ├─ functions/invite-user/  Edge Function: kullanıcı ekleme + şifre sıfırlama (service_role)
│  ├─ tests/migration.test.mjs  PGlite üzerinde gerçek Postgres testi (npm run test:db)
│  ├─ keepalive-setup.sql, fix-views-cron.sql, bootstrap-admin.sql  (elle çalıştırılan yardımcılar)
├─ public/sablonlar/       İcra boş Excel şablonları (alacaklı + borçlu)
└─ *.md                    KURGU (kullanıcı kılavuzu), YENILIKLER, SON-EKLENENLER, AVUKAT-GERI-BILDIRIM
```

### Sayfalar (`src/routes`)

| URL | Sayfa |
|---|---|
| `/` | Gösterge paneli (role göre değişen widget'lar) |
| `/giris`, `/sifre-sifirla` | Giriş, büro kaydı, şifre sıfırlama |
| `/takvim` | Ajanda |
| `/muvekkiller`, `/muvekkiller/$id` | Müvekkil listesi / detay (cari ekstre, kapanan dosyalar) |
| `/dosyalar`, `/dosyalar/$id` | Dava dosyaları |
| `/belgeler`, `/masraflar`, `/tahsilatlar`, `/taksitler` | Belgeler, masraflar, ücret tahsilatı |
| `/cari-hesap`, `/banka-kasa` | Müvekkil carileri, hesap bakiyeleri/hareketleri |
| `/icra`, `/icra/borclu`, `/icra/$id` | Alacaklı / borçlu olduğumuz icra dosyaları, dosya detayı |
| `/icra/sureler` | Bütün icra süreleri tek listede |
| `/icra/liste/$listId` | Şirket listeleri (belirli müvekkil şirketlerin icra görünümü) |
| `/borclular`, `/borclular/$id` | Borçlu kartları |
| `/bildirimler`, `/uyarilar` | Bildirimler (DB'de) / Dikkat gerektirenler (anlık hesap) |
| `/raporlar`, `/aktivite`, `/ayarlar` | Raporlar, denetim kaydı, ayarlar |
| `/yazdir/dosya/$id`, `/yazdir/ekstre/$id` | Sidebar'sız yazdırma sayfaları |

---

## 4. Bir isteğin yolculuğu

1. **Tarayıcı istek atar** → `src/server.ts` TanStack Start'ın SSR handler'ını çağırır, cevaba güvenlik başlıklarını ekler (CSP sadece canlıda, `noindex`, `no-store`, HSTS…). SSR çökerse markalı hata sayfası döner.
2. **`__root.tsx`** sayfayı sarar: `QueryClientProvider → ErpProvider → ConfirmProvider → QuickActionsProvider → AuthGate`.
3. **`ErpProvider`** açılışta `supabase.auth.getSession()` ile oturuma bakar. Oturum varsa `loadFullState()` çağrılır: **büronun ~26 tablosu paralel olarak tamamen çekilir** ve bellekte tek bir `state` objesine konur.
4. **`AuthGate`** yolu üç bölgeye ayırır:
   - `auth` (`/giris`, `/sifre-sifirla`): oturum yoksa burada kalır, varsa `?yonlendir=` adresine ya da `/`'a gider.
   - `print` (`/yazdir/*`): sidebar'sız.
   - `staff` (geri kalan her şey): oturum yoksa `/giris?yonlendir=...`'e atar; varsa Sidebar + Topbar ile çizer.
   - Yönetici geçici şifre verdiyse (`user_metadata.must_change_password`) önce **FirstPasswordGate** açılır, yeni şifre belirlenmeden panel açılmaz.
5. **Sayfa** `useErp()` ile `state`'ten okur, hesapları `finance.ts` fonksiyonlarıyla yapar (bakiye, gecikme, süre…). Ayrı ayrı API çağrısı yapılmaz; veri zaten bellektedir.

---

## 5. Giriş, oturum, kullanıcılar

| Akış | Nasıl çalışıyor |
|---|---|
| **Giriş** | Kullanıcı adı ya da e-posta yazılır → `resolve_login` RPC'si (anon çağırabilir) e-postayı bulur → `signInWithPassword`. |
| **Brute-force koruması** | Tarayıcıda (`localStorage: lexkasa-login-guard-v1`): 5. hatalı denemeden sonra 30 sn, sonra katlanarak en fazla 15 dk bekleme. (Asıl koruma Supabase Auth'un kendi rate limit'i.) |
| **Beni hatırla** | Seçiliyse oturum `localStorage`'da, değilse `sessionStorage`'da. Yeni sekme (ör. "Ekstre yazdır") oturumu açık sekmeden **BroadcastChannel** ile ister. Bir sekmede çıkış yapılınca diğerleri de çıkar. |
| **Hareketsizlik** | 8 saat işlem yoksa otomatik çıkış. |
| **Büro kaydı** | `signUp` → `create_organization` RPC: büro + ayarlar + admin profili + **Büro Kasası** ve **Barokart** hesapları oluşur. |
| **Kullanıcı ekleme / şifre verme** | Edge Function `invite-user` (service_role sadece orada). Çağıranın admin olduğunu ya da `settings_users` izni olduğunu kontrol eder. Verilen şifre geçici: kullanıcı ilk girişte değiştirir. |
| **Şifremi unuttum** | `resetPasswordForEmail` → `/sifre-sifirla`. |
| **Kullanıcı adı** | Bütün bürolarda tekil (`profiles.username` global unique). |

Roller: **Admin** ve **Avukat**. (Eski "Sekreter" rolü yükleme sırasında Avukat'a çevriliyor; müvekkil portalı `1a95dd9` commit'inde kaldırıldı.)

---

## 6. Veri katmanı

Bütün yazma işlemleri `src/lib/erp-store.tsx` üzerinden geçer. Model **"iyimser güncelleme" (optimistic update)**:

```
save("expenses", taslak)
  1. ID üretilir (uuid), state ANINDA güncellenir → ekran hemen değişir
  2. Arka planda persistSave() → mappers ile DB satırına çevrilip upsert edilir
  3. Hata olursa: toast ile hata + reloadFromServer() (state sunucudan baştan çekilir, ekran düzelir)
  4. opts.notify verilmişse ilgili kullanıcılara notifications satırı eklenir
```

- `patch` = mevcut kaydı alıp değişikliği birleştirip `save`.
- `remove/removeMany` = önce ekrandan siler, sonra DB'den; cascade varsa tüm state yeniden yüklenir.
- **Para ile ilgili kritik işlemler iyimser değil**, RPC çağrılıp ardından tüm state yeniden yüklenir:
  `record_installment_payment`, `close_case`, `accrue_monthly_fees`, `archive_years`, virman, borçlu taksit planı.
- `TOKEN_REFRESHED` olayında da (Supabase token'ı ~1 saatte bir yeniler) **tüm veri yeniden çekilir**. Başka kullanıcıların yaptığı değişiklikler pratikte bu şekilde ya da sayfa yenilenince görünür; istemci **Realtime aboneliği kullanmıyor** (DB tarafında yayın açık olsa da).
- Veritabanında her tabloda 3 tetikleyici var:
  - `trg_touch` → `updated_at`'i günceller,
  - `trg_force_org` → `org_id`'yi kullanıcının bürosuna zorlar (başka büroya kayıt yazılamaz),
  - `trg_audit` → `activities` tablosuna alan bazında önce/sonra denetim kaydı yazar (Aktivite geçmişi sayfası bunu gösterir).

---

## 7. Yetki sistemi

İki katman var, **asıl olan veritabanı**:

1. **Veritabanı (RLS):** Her tabloda `org_id = app.current_org_id() and app.can('<modül>', '<eylem>')`. `app.can_user()` mantığı:
   - Admin → her şey serbest.
   - Avukat → önce **kişisel istisna** (`profiles.permissions`), yoksa **rol varsayılanı** (`org_settings.role_permissions`), yoksa kapalı.
   - Ekle/Düzenle/Sil izni ancak **Görüntüle** de açıksa geçerli. İstisna: `expenses` ve `reminders`'ta "Görüntüle" = başkalarınınkini görme. Kendi girdiği masrafı / kendine atanan ajandayı herkes görür.
2. **Arayüz:** `permissionsFor()` aynı hesabı tarayıcıda yapar. Menü (`nav.ts`), düğmeler, Ctrl+K araması buna göre gizlenir. Bu sadece kolaylık; adresi elle yazan kullanıcıyı DB zaten durdurur.

İzin modülleri: `clients, cases, documents, expenses, reminders, enforcements, fees, ledger, accounts, reports, activity, statements` + ayar bölümleri `settings_firm, settings_categories, settings_companies, settings_users, settings_backup`.
**İzinlerin kendisi, arşiv ve zamanlama ekranı yalnızca Admin'de.** Ayar değişikliklerini `app.guard_settings_update()` tetikleyicisi alan alan denetler. Son admin silinemez/düşürülemez (`protect_last_admin`).

---

## 8. Veritabanı tabloları

| Grup | Tablolar |
|---|---|
| Büro | `organizations` (timezone, saklama ayarları), `org_settings` (tüm açılır listeler, rol izinleri, icra süre ayarları, şirket listeleri), `profiles` |
| Müvekkil / dava | `clients` (aylık ücret, kapanan dosya toplamları), `cases`, `documents`, `reminders` (ajanda) |
| Para | `accounts`, `account_transactions` (virman, müvekkile aktarım, diğer gelir/gider), `expenses`, `fee_plans` → `installments` → `installment_payments` |
| İcra | `enforcements` (`side`: Alacaklı/Borçlu, `procedure` = takip şekli/Örnek No, `last_seizure_date`, durdurma/kapanış sebebi), `enforcement_debtors`, `debtors`, `enforcement_events` (işlem geçmişi, `data` jsonb: bankalar/cevaplar/sorgu sonuçları), `payment_promises` (ödeme sözü + borçlu taksitleri), `collections` (icra tahsilatları), `contact_logs`, `banks` |
| Sistem | `notifications` (`dedupe_key` ile tekrarsız), `activities` (denetim), `attachments` (dosya künyesi), `yearly_stats`, `org_archive`, `storage_cleanup`, `seizure_notices` ve `icra_deadline_notices` (cron'un "bunu zaten gönderdim" defteri), `app.config` (keepalive ayarı) |

**View'lar** (`security_invoker`, yani çağıranın RLS'i geçerli): `v_account_balances`, `v_installments`, `v_client_balances`, `v_icra_deadlines`.

**RPC'ler:** `resolve_login`, `create_organization`, `record_installment_payment`, `accrue_monthly_fees`, `close_case`, `archive_years`, `my_permissions`, `account_options`, `list_cron_jobs`, `keepalive`.

### Migration sırası

| Dosya | Ne getirdi |
|---|---|
| `20261012000000_lexkasa_init` | Bütün şema, RLS, iş fonksiyonları, 4 cron işi, Storage |
| `20261012110000_cron_ui` / `…120000_views_invoker_cron_list` | Zamanlama ekranı için `list_cron_jobs`, view'ları `security_invoker` yapma |
| `20261016000000_icra_geri_bildirim` | Alacaklı/borçlu tarafı, işlem geçmişi, son haciz tarihi, **haciz cron'u** (`lexkasa-haciz`) |
| `20261016120000_kapali_dosya_saklama` | Kapalı dosya hemen silinmez + aylık silme işi (`lexkasa-kapali-dosya`) |
| `20261016130000_ayarlar_izinleri` | Ayar bölümlerini avukata verebilme |
| `20261016140000_kullanici_yonetimi_devri` | Kullanıcı yönetimini avukata (sınırlı) verebilme |
| `20261016150000_icra_sureler` | Takip şekilleri, `v_icra_deadlines`, günlük icra süre bildirimi |
| `20261016160000_borclu_sureler_kapali_saklama` | Borçlu olduğumuz dosyada itiraz/ödeme süresi, kapalı dosya varsayılan "hiç silme" (0) |
| `20261016170000_banks` | Bankalar tablosu |
| `20261016180000_bank_89_chain` | 89/1 → 89/2 → 89/3 → banka haczi kesinleşme zinciri, banka süresi 15 gün |

Hepsi **tekrar çalıştırılabilir** (idempotent) yazılmış.

---

## 9. Zamanlanmış işler (pg_cron)

Hepsi Supabase'in içinde, Postgres'te çalışır. Uygulama açık olmasa da çalışırlar. Cron saatleri **UTC**; TR = UTC+3. **Ayarlar → Zamanlama** ekranı bunları sadece gösterir, değiştirmez.

| İş | Ne zaman (TR) | Cron (UTC) | Fonksiyon | Ne yapar |
|---|---|---|---|---|
| `lexkasa-haciz` | **Her gün 08:00** | `0 5 * * *` | `app.cron_icra_daily()` | Haciz yenileme hatırlatması + bütün icra süreleri (bkz. §12) |
| `lexkasa-bildirimler` | **Her Pazartesi 08:00** | `0 5 * * 1` | `app.cron_notifications()` | Geciken taksit, 3 gün içinde vadesi gelen taksit, bugün/yarın ajanda, tutulmayan ödeme sözü |
| `lexkasa-aylik-ucret` | **Her Pazartesi 00:10** | `10 21 * * 0` | `app.cron_accrue_fees()` | Aylık ücretli aktif müvekkillere o ayın ücret planını oluşturur (vade: ayın 5'i). Aynı ay için tekrar oluşturmaz. |
| `lexkasa-saklama` | **Her Pazartesi 03:30** | `30 0 * * 1` | `app.cron_retention()` | Temizlik ve otomatik arşiv (aşağıda) |
| `lexkasa-kapali-dosya` | **Her ayın 1'i 03:45** | `45 0 1 * *` | `app.cron_purge_closed_cases()` | Saklama süresi dolan kapalı dava dosyalarını siler (ayar 0 ise hiçbir şey yapmaz, varsayılan 0) |
| `lexkasa-keepalive` | **5 günde bir 09:00** | `0 6 */5 * *` | `app.cron_keepalive()` | Ücretsiz Supabase projesi uyumasın diye `pg_net` ile kendi API'sine ping atar. Veri yazmaz. `app.config`'e `project_url` + `anon_key` girilmezse çalışmaz. |

### `lexkasa-saklama` içinde neler oluyor?

- Okunmuş bildirimler **30 gün**, okunmamışlar **120 gün** sonra silinir.
- `activities` (denetim kaydı) büronun `retention_months` ayarından eskiyse silinir.
- Büroda "N yıl tut" (`auto_archive_keep_years`) ayarlıysa yılda bir kez eski yıllar **arşivlenir** (`app.archive_org`).
- Hiçbir kayda bağlanmamış (formu iptal edilmiş) ekler 2 gün sonra silinir.
- `cron.job_run_details` 14 günden eskisi silinir.
- Silinmiş eklerin Storage dosyaları kuyruktan (`storage_cleanup`) düşürülür.

### Bildirim tekrarını engelleme

Her cron bildirimi bir `dedupe_key` taşır (ör. `inst-overdue:<id>`, `haciz:<id>:<tarih>`, `sure:b89:<event_id>`) ve `(user_id, dedupe_key)` unique olduğu için **aynı şey aynı kişiye iki kez gitmez**. İcra işleri ayrıca `seizure_notices` / `icra_deadline_notices` tablolarına "gönderildi" kaydı düşer. Kaçırılan gün olursa süre gününden sonra **3 gün daha** gönderme şansı var.

---

## 10. Bildirim ve uyarıların 3 kaynağı

Karıştırmamak için önemli:

| Kaynak | Nerede görünür | Ne zaman oluşur |
|---|---|---|
| **1. Cron bildirimleri** (`notifications` tablosu) | Sağ üst zil, `/bildirimler` | Yukarıdaki işler çalıştığında (her gün 08:00 icra, Pazartesi 08:00 taksit/ajanda/söz) |
| **2. Anlık işlem bildirimleri** (`notifications` tablosu) | Zil | Biri bir şey yaptığı anda, istemciden: avukat masraf girince yöneticiye, ajandaya iş atanınca sorumluya vb. (`save(..., { notify })`) |
| **3. "Dikkat gerektirenler"** (DB'de **yok**, anlık hesap) | `/uyarilar`, gösterge paneli | Sayfa her açıldığında `finance.ts → computeAlerts()` tarayıcıda hesaplar: geciken/3 gün içindeki taksitler, haciz düşme uyarısı, ödeme sözleri, icra süreleri, bugün/yarın ajanda |

Yani zil "geçmiş ve kalıcı", Dikkat gerektirenler ise "şu anki durum".

---

## 11. Modüllerin iş mantığı

### Masraf
- `charge_to`: **Müvekkil** ya da **Büro** gideri. `paid_by`: **Büro** ya da **Müvekkil**.
- Büro ödediyse ve hesap seçildiyse kasadan düşer. Müvekkile aitse müvekkilin carisine borç yazılır.
- Hesap boş bırakılırsa masraf "Bekliyor" görünür, kasa düşmez.
- Masraflar sadece **Büro Kasası / Barokart**'tan ödenebilir.
- Avukat varsayılan olarak sadece kendi girdiği masrafı görür/düzenler. Girince yöneticiye bildirim gider.

### Vekalet ücreti / taksit
- `fee_plans` → `installments` → `installment_payments`.
- Tahsilat **`record_installment_payment`** RPC'siyle girilir: tutar seçilen taksitten başlayarak sırayla dağıtılır, plan tamamen ödendikten sonra kalan fazla son taksite yazılır.
- Taksit durumu (Bekliyor/Kısmi/Ödendi/Gecikmiş) saklanmaz, ödemelerden **hesaplanır** (`installmentStatus`, `v_installments`).
- Aylık ücret: cron Pazartesileri oluşturur. Ayrıca Tahsilatlar sayfasında ve müvekkil detayında **"Aylık ücretleri oluştur"** düğmesi var (elle tetikleme).

### Cari hesap ve kasa
- Müvekkil carisi = büronun ödediği müvekkil masrafları + ücret planları − ücret ödemeleri ± icra aktarımları + kapanan dosyalardan devreden toplamlar. Hesaplar `finance.ts → clientLedger/clientFinance` ve `v_client_balances` içinde.
- Hesap bakiyesi = açılış bakiyesi + hareketler + tahsilatlar − masraflar (`accountLedger`, `v_account_balances`).
- Virman iki satırlık `account_transactions` ile yapılır (aynı `transfer_id`).

### Dava dosyası kapatma (son hali)
1. Durum **"Kapalı"** yapılınca dosya **silinmez**. Tetikleyici `closing_date`'i bugüne ayarlar. Yeniden açılınca tarih temizlenir.
2. Ayarlar'da otomatik silme süresi (1–120 ay) verilmişse, süre dolduktan sonraki **ayın 1'inde** `lexkasa-kapali-dosya` işi siler. **Varsayılan 0, yani hiç silinmez.**
3. Kapalı dosyada **"Şimdi kalıcı sil"** → `close_case` RPC'si.
4. Silme (`app.close_case_core`): dosyanın cari etkisi müvekkilde `closed_receivable / closed_payable / closed_fee_*` toplamlarına yazılır, yıllık özet (`yearly_stats`) güncellenir, kasa bakiyesi bozulmasın diye tek bir "Kapanan dosya" düzeltme hareketi atılır, sonra belge/masraf/plan/ajanda/dosya silinir. İcra dosyalarının bağı (`case_id`) koparılır, icra silinmez.

### Yıl arşivi
`archive_years(yıl)`: o yıl ve öncesindeki ayrıntılar silinir; **yıllık toplamlar, hesap açılış bakiyeleri ve müvekkil cari bakiyeleri korunur**. Elle (Admin, Ayarlar) ya da `lexkasa-saklama` içinde otomatik çalışır.

### İcra
- `side`: **Alacaklı** (asıl iş) ya da **Borçlu** (bizim borçlu olduğumuz dosyalar, ayrı menü).
- Durum biçimi: `Açık`, `Açık (Durdurulmuş : sebep)`, `Kapalı (sebep)`, `Tahsil edildi`. **Otomatik kapanma yok**, borç bitse de büro elle kapatır.
- **Takip şekli (Örnek No):** `org_settings.procedures` jsonb'de her Örnek No için gün sayısı ve süre dolunca yapılacak işlem (Kesinleştirme/Tahliye). Ayarlar'dan değiştirilebilir.
- İşlem geçmişi (`enforcement_events`): Ödeme emri tebliği, Kesinleşme, Sorgu (araç/taşınmaz/banka/SGK…), 89/1–89/3 (seçilen bankalar ve cevapları `data.banks` içinde), Maaş haczi, Haciz, Tahliye talebi…
- Borçlu taksiti / ödeme sözü → `payment_promises`. "Ödendi" deyince `collections`'a tahsilat yazılır.
- Tahsil edilen para müvekkilin. **Banka & Kasa**'da "Müvekkile aktarılacak" listesi çıkar, aktarım `account_transactions` (`Müvekkile aktarım`) ile kaydedilir.
- **Şirket listeleri:** `org_settings.company_lists`. Belirli müvekkil şirketlerin icra dosyaları için ayrı görünüm, sidebar'da kendi linki var (`/icra/liste/$listId`).

---

## 12. İcra süre motoru

İcranın en kritik kısmı. **Aynı kurallar iki yerde yazılı** ve birbiriyle aynı kalmak zorunda:

- **Sunucu:** `v_icra_deadlines` view'ı (son hali `20261016180000_bank_89_chain.sql`'de) → cron bildirimleri bunu kullanır.
- **Tarayıcı:** `src/lib/finance.ts → icraDeadlines()` → `/icra/sureler`, dosya sayfasındaki "Bekleyen süreler" ve Dikkat gerektirenler bunu kullanır.

| Tetikleyen işlem | Süre / hatırlatma günü | "Çözüldü" sayılma şartı |
|---|---|---|
| Ödeme emri tebliği (**Alacaklı**) | tebliğ + takip şeklinin günü **+ 1** → **Kesinleştirme** (Örnek 14'te **Tahliye**) | Sonrasında "Kesinleşme" / "Tahliye talebi" işlemi girilmesi ya da "Tamamlandı" |
| Ödeme emri tebliği (**Borçlu**) | Son gün = tebliğ + gün. Hatırlatma **son günden 2 gün önce** başlar → **İtiraz / ödeme süresi** | Sadece "Tamamlandı" |
| 89/1 haciz ihbarnamesi | tarih + banka süresi (vars. **15**) + 1 = **16. gün** → **89/2 gönder** | Bütün bankaların cevabı girildi, ya da sonrasında 89/2 girildi, ya da Tamamlandı |
| 89/2 | aynı süre → **89/3 gönder** | Bütün cevaplar, ya da 89/3 girildi |
| 89/3 | aynı süre → **Menfi tespit yoksa banka haczi kesinleşme** | Bütün cevaplar, ya da "Kesinleşme" girildi |
| Maaş haczi tebliği | + maaş süresi (vars. **30**) + 1 → **İşveren borçlu eklensin** | "Borçlu ekleme talebi" girildi |
| Son haciz tarihi | + **12 ay** = düşme günü. **14 gün önce** ve düşme günü **haciz yenileme** | Yeni haciz tarihi girilince süre ileri kayar |
| Ödeme sözü / borçlu taksiti | vade günü | Tahsilat girildi |

Kurallar:
- Kapalı / Kapandı / Tahsil edildi durumundaki dosyalar hesaba girmez.
- Alacaklıya özgü süreler (kesinleştirme, 89/x, maaş, haciz, taksit) **borçlu olduğumuz** dosyalarda çıkmaz.
- Bildirim **dosyanın sorumlu avukatlarına** gider. Dosyanın aktif sorumlusu yoksa **adminlere** gider.
- "Tamamlandı" düğmesi işlemin `data.doneAt` alanını doldurur, "Yeniden aç" temizler.
- Hesapta kullanılan işlem türleri (Ödeme emri tebliği, Kesinleşme, 89/1-2-3, Maaş haczi tebliği, Borçlu ekleme talebi, Tahliye talebi, Sorgu, Haciz) Ayarlar'da **kilitli**, silinemez (`LOCKED_EVENT_TYPES`). Silinirse motor bozulurdu.

> ⚠️ Süre kuralını değiştireceksen **hem** yeni bir migration'da `v_icra_deadlines` + `app.cron_icra_deadlines` **hem de** `finance.ts → icraDeadlines()` + `DEADLINE_TITLES` güncellenmeli. Yoksa ekran ile bildirim farklı şey söyler. `npm run test:db`'deki icra süre testleri de güncellenmeli.

---

## 13. Dosyalar, Excel, yedek

- **Ekler:** Storage kovası `attachments` (özel, 15 MB sınır). Yol: `<org_id>/<uuid>`. Künye `attachments` tablosunda. Okuma sadece kendi büro klasöründen, silme sadece admin. Kayıt silinince tetikleyici dosyayı `storage_cleanup` kuyruğuna atar, haftalık iş temizler.
- **Excel toplu aktarım** (`import-specs.ts` + `ImportDialog`): müvekkil, dosya, masraf, borçlu, banka, icra (alacaklı) ve icra (borçlu). Şablon 3 sayfalı iner (Veri / Listeler / Açıklama). Yüklenince her satır **Hazır / Hatalı / Atlanacak** diye işaretlenir, hücreler ekranda düzeltilebilir. Tarih ve tutar farklı biçimlerde tanınır. Bir hücrede "1- Ali 2- Ayşe" gibi birden fazla borçlu varsa **tek icra dosyasına** iki borçlu bağlanır. `.xls` desteklenmez.
  Sıra önemli: Müvekkil → Dosya/İcra → Masraf.
- **Excel'e dışa aktarım:** Listelerdeki "Excel'e indir". Raporlar çok sayfalı Excel üretir.
- **Yedek:** Ayarlar → Yedekleme, tüm state + ekleri `.zip` olarak indirir. **Geri yükleme şu an çalışmıyor**, sadece "destek ile iletişime geçin" uyarısı veriyor (bkz. §17).

---

## 14. Güvenlik, hata izleme, test

- **HTTP başlıkları** (`server.ts`): CSP (sadece Supabase ve Sentry'ye bağlantı), `X-Robots-Tag: noindex`, `no-referrer`, `nosniff`, HSTS, COOP, kamera/mikrofon vs. kapalı, HTML `no-store`. Sayfa meta'larında da noindex var. Panel arama motorunda çıkmasın diye.
- **CSRF:** `start.ts` server function'lar için CSRF middleware'i açık tutuyor.
- **DB:** Bütün tablolarda RLS açık, `anon` sadece `resolve_login` ve `keepalive` çağırabilir. SECURITY DEFINER fonksiyonlar `search_path = ''` ile çalışıyor ve izni kendisi kontrol ediyor. `service_role` anahtarı **sadece** Edge Function'da.
- **Sentry** (`sentry.ts`): sadece `VITE_SENTRY_DSN` varsa açılır. E-posta, TC/vergi no, IBAN, telefon hata metinlerinde maskelenir. Kullanıcı olarak sadece büro/kullanıcı id'si ve rol gider.
- **Test:** `npm run test:db` → `supabase/tests/migration.test.mjs`. **PGlite** ile gerçek bir Postgres ayağa kaldırılıp Supabase parçaları (auth.uid, storage, cron) taklit ediliyor. Migration'lar **iki kez** uygulanıyor (idempotent mi diye). Ardından şunlar sınanıyor: büro izolasyonu, avukat izinleri, kişisel istisnalar, taksit dağıtımı, cari/kasa bakiyeleri, aylık ücret, dosya kapatma, arşiv, cron bildirimleri, saklama, denetim kaydı, son admin koruması, storage kuralları, icra süreleri (kesinleştirme, 89/x, işveren, borçlu tarafı), ayar ve kullanıcı yönetimi izinleri, cron zamanlaması. Sonunda `PASS/FAIL` sayısı basılıyor.

---

## 15. Kurulum ve deploy

```bash
npm install
cp .env.example .env     # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (+ opsiyonel Sentry)
npm run dev              # geliştirme
npm run build            # üretim (Nitro → Cloudflare hedefi)
npm run lint
npm run test:db          # veritabanı testleri
```

Supabase tarafı (ayrıntı `supabase/README.md`):
1. `pg_cron` ve `pg_net` eklentilerini aç.
2. `supabase db push` ile **bütün** migration'ları sırayla uygula.
3. Auth → e-posta açık, minimum şifre 8. İlk bürodan sonra sign-up kapatılabilir.
4. `keepalive-setup.sql` çalıştır, `app.config`'e `project_url` ve `anon_key` gir.
5. `supabase functions deploy invite-user`.
6. Kontrol: `select jobname, schedule from cron.job;` sonucunda **6 iş** görmelisin.

**Lovable notu (`AGENTS.md`):** Proje Lovable'a bağlı. `main`'e push edilen her şey Lovable'a gider. **Force push / pushlanmış commit'i rebase-amend etme yok**, yoksa Lovable tarafında geçmiş kaybolur. Branch her zaman çalışır halde tutulmalı.

---

## 16. Git geçmişi

| Tarih | Commit | Ne oldu |
|---|---|---|
| Tem. 2026 | `d5f2402` … `953e4f0` | Lovable TanStack şablonu, ilk "Changes" commit'leri: tasarım sistemi, placeholder sayfalar |
| | `5a6efa1`, `a0b6d99`, `d1e9c42` | Mock veriyle müvekkil/dosya/masraf/tahsilat, giriş sayfası, taksitler, hatırlatmalar |
| | `5563157` | **"Rebuild as full law-firm management system"**: tam ERP. Veri o zaman tarayıcıda (localStorage/IndexedDB) duruyordu |
| | `578481e`, `31990ed` | Sayfa geçişi düzeltmeleri (çift render sorunu) |
| 07.10 | `195bd77` | TanStack Start XSS güvenlik yaması |
| 13.10 | `1a95dd9` | Müvekkil portalı kaldırıldı |
| 13.10 | `e3ac213` | **Büyük geçiş:** Supabase şeması, RLS, cron, migration testleri, marka/logo (109 dosya) |
| 16.10 | `f17c53a`, `a39df9c` | Paket adı `lexkasa`, başlık ve dark mode tutarlılığı |
| 16.10 | `7c9e565` | Avukat geri bildirimi: alacaklı/borçlu ayrımı, şirket listeleri, işlem geçmişi, haciz hatırlatması, ayar izinleri, kullanıcı yönetimi devri, Excel iyileştirmeleri |
| 16.10 | `e9cf59a` | **İcra süreleri:** takip şekli (Örnek No), `/icra/sureler`, kesinleştirme/tahliye, borçlu tarafı süreleri, kapalı dosyaların saklanması |
| 16.10 | `dfbd1bb` | Kapanış sebepleri / durum açıklamaları düzeltmesi |
| 16.10 | `f8e6d0a` | **Bankalar** tablosu, 89/1 → 89/2 → 89/3 → banka haczi kesinleşme zinciri |
| 16.10 | `6ba482f` | Banka seçimi sadeleştirildi: her adımda bankalar elle seçiliyor, "bekleyen bankalar" otomatik doldurma kaldırıldı |

Kısaca proje üç evreden geçti: **mock UI → tarayıcıda çalışan tam ERP → Supabase'li çok kiracılı sistem + icra süre motoru.** Kodda ilk evrelerden kalıntılar var (bkz. aşağı).

---

## 17. Dikkat: bilinen tuhaflıklar

Kodu okurken fark ettiğim, bilmen gereken şeyler. Hiçbirini düzeltmedim, sadece not ediyorum.

### Davranışla ilgili

1. **Taksit/ajanda bildirimleri haftada bir (Pazartesi) çalışıyor.** `cron_notifications` "bugünden 3 gün sonrasına kadar vadesi gelen" taksitlere bakıyor. Pazartesi çalışınca bu Pzt–Per'i kapsıyor, **Cuma–Pazar vadeli taksitler için "yaklaşan" bildirimi hiç gitmiyor**. Ajanda "bugün/yarın" bildirimi de sadece Pzt/Sal işleri için gidiyor. (Fonksiyonun yorumunda "Her gün" yazıyor, zamanlama haftalık.) Ekrandaki "Dikkat gerektirenler" her an doğru, ama **zil bildirimi eksik**. Günlük yapmak için schedule `0 5 * * *` olmalı.
2. **Aylık ücret de haftada bir oluşuyor**, vadesi ise ayın 5'i. Ay Salı–Pazar arası bir günle başlarsa ilk Pazartesi 2–7 arasına düşer. Ayın 6'sı ya da 7'sinde oluşan ücret **doğduğu anda gecikmiş** görünür. Elle "Aylık ücretleri oluştur" düğmesi bunu telafi ediyor.
3. **Canlı senkron yok.** Başka kullanıcının değişikliği sayfa yenilenince ya da token yenilenince (~1 saat) görünür. Realtime yayını DB'de açık ama istemci dinlemiyor.
4. **Girişte bütün büro verisi tek seferde çekiliyor** (~26 tablo, filtresiz). Küçük büro için sorun değil, veri büyüdükçe açılış yavaşlar. Arşiv özelliği bunu kısmen hafifletiyor.
5. **İcra süre kuralları iki yerde** (SQL view + `finance.ts`). Biri değişip diğeri unutulursa ekran ile bildirim tutarsız olur.
6. **Storage temizliği** `storage.objects` satırını siliyor. Kodun kendi yorumunda da yazdığı gibi fiziksel dosyayı Storage API silmeden alan tam boşalmayabilir.
7. **Yedek geri yükleme yok.** `replaceState` sadece bilgi toast'ı gösteriyor. `backup.ts`'teki "IndexedDB'ye yazar" yorumu eski döneme ait.

### Eskimiş belgeler

8. **`README.md` eski:** Sekreter ve Müvekkil portalı rolleri, demo hesaplar (`admin/123456`), "veri erişimi Supabase'e geçişte değiştirilecek" cümlesi artık geçerli değil.
9. **`supabase/README.md`:** "Tek migration" ve "4 iş" diyor. Gerçekte **11 migration** ve **6 cron işi** var.
10. **`KURGU.md`:**
    - §7.3 "her ayın ilk girişinde aylık ücret oluşur" diyor. Artık Pazartesi cron'u + elle düğme.
    - §10 "dosya kapatınca silinir, geri alınamaz" diyor. Artık **kapatınca saklanıyor**, "Yeniden aç" var, silme opsiyonel.
    - §12'deki aynı ifadeler de eski.
11. **`SON-EKLENENLER.md`** "Sizden beklediklerimiz" kısmında "Banka (13 gün)" yazıyor, güncel varsayılan **15 gün** (16. gün hatırlatma).

### Kod kalıntıları

12. `src/lib/auth.ts`'teki PBKDF2 hash fonksiyonları ve `migrations.ts`'teki localStorage anahtarları/seed tuzu tarayıcıda veri tutulan dönemden kalma. Sadece `passwordProblem()` ve `normalizeState` gibi parçalar hâlâ kullanılıyor.
13. `.lovable/plan.md` ilk mock dashboard planı. Güncel mimariyi yansıtmıyor.
