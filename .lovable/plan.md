# Hukuk Büro Yönetim Sistemi — Dashboard Planı

Linear/Stripe/Vercel/Notion ilhamlı, sade ve premium bir SaaS dashboard'u. Next.js istenmiş ancak proje TanStack Start üzerine kurulu — router olarak TanStack Router kullanılacak, geri kalan tüm teknoloji (React, TS, Tailwind, shadcn/ui, Lucide, Recharts, Framer Motion, React Query) aynen uygulanacak.

## Tasarım Sistemi (src/styles.css)

- Ana renk: Lacivert `#1E3A8A` → `--primary`
- Aksan: Mavi `#2563EB` → `--accent` / `--ring`
- Success (yeşil), Warning (turuncu), Destructive (kırmızı) semantik token'ları eklenir
- Sidebar için ayrı token seti (zaten mevcut), lacivert temaya göre ayarlanır
- Border radius: `--radius: 0.75rem` (orta)
- Soft shadow: `--shadow-soft`, `--shadow-card` token'ları
- Font: Inter (Google Fonts, `__root.tsx` içinde `<link>` ile)
- Dark mode: `.dark` sınıfı üzerinden, tüm token'ların koyu versiyonu

Tüm renkler yalnızca token üzerinden kullanılır (`bg-primary`, `text-success` vb.) — hardcoded hex/`bg-blue-*` yasak.

## Rota ve Layout

- `src/routes/__root.tsx`: `<link>` ile Inter fontu ve tema meta güncellenir
- `src/routes/index.tsx`: Placeholder kaldırılır, dashboard sayfasına yönlendirir (veya doğrudan dashboard render eder — `/` = Dashboard)
- Diğer menü öğeleri için boş placeholder rotalar (ileride doldurulacak): `/muvekkiller`, `/dosyalar`, `/masraflar`, `/tahsilatlar`, `/evraklar`, `/hatirlatmalar`, `/raporlar`, `/bildirimler`, `/ayarlar` — her biri "Yakında" empty state ile
- Ortak layout `__root.tsx` içinde `SidebarProvider` + `AppSidebar` + `Topbar` + `<Outlet />`

## Bileşenler

### Layout
- `src/components/layout/AppSidebar.tsx` — shadcn `Sidebar` (collapsible="icon"), logo, 10 menü öğesi Lucide ikonlarla, aktif rota vurgusu, hover animasyonu, mobilde drawer (Sheet otomatik)
- `src/components/layout/Topbar.tsx` — SidebarTrigger, sayfa başlığı, global arama (Command/⌘K stili input), bildirim butonu (badge'li), profil DropdownMenu (avatar + çıkış)

### Dashboard (`src/components/dashboard/`)
- `WelcomeHeader.tsx` — "Hoş Geldiniz, Ahmet Yılmaz" + bugünün tarihi (tr-TR) + sağda Hızlı İşlem butonları (Yeni Müvekkil, Yeni Dosya, Masraf, Tahsilat, Evrak)
- `StatCards.tsx` — 4 kart grid: Toplam Müvekkil, Aktif Dosya, Bu Ay Tahsilat, Bu Ay Masraf. Her kart: ikon rozeti, büyük değer, trend delta (yeşil/kırmızı ok + %), hover'da hafif shadow + translate
- `RevenueChart.tsx` — Recharts `LineChart`, son 12 ay tahsilat, primary renk gradient area
- `ExpensePieChart.tsx` — Recharts `PieChart`, kategoriler: Harç, Bilirkişi, Tebligat, Yol, Diğer
- `RecentTransactionsTable.tsx` — shadcn Table, son 10 işlem, Durum kolonu için renkli Badge
- `UpcomingReminders.tsx` — Kart listesi, her satırda sol tarafta tarih rozeti (gün + ay), sağda başlık + tip ikonu
- `NotificationsPanel.tsx` — Renkli badge'li son bildirim akışı
- `MiniCalendar.tsx` — Basit ay görünümü + bugünkü etkinlik listesi
- `BottomSummary.tsx` — 4 kolon: Son Eklenen Müvekkiller, Son Açılan Dosyalar, Bekleyen Tahsilatlar, Aktif Hatırlatmalar — kart ızgarası

### Ortak UI
- `src/components/ui/stat-skeleton.tsx` ve genel Skeleton kullanımı (loading state)
- `src/components/ui/empty-state.tsx` — ikon + başlık + açıklama + CTA
- `src/components/theme-toggle.tsx` — light/dark toggle (Topbar'da)

### Veri
- `src/lib/mock-data.ts` — mock müvekkil/dosya/işlem/hatırlatma verisi (frontend-only)
- React Query mock için basit `useQuery` + `Promise.resolve` (backend yok, sadece UI)

### Animasyon
- Framer Motion ile kart girişlerinde stagger fade-in, sayaç kartlarında hover scale, sayfa geçişi fade

## Dashboard Grid Yerleşimi

```text
┌───────────────────────────────────────────────────────────┐
│ WelcomeHeader + QuickActions                              │
├───────────┬───────────┬───────────┬───────────────────────┤
│ Stat 1    │ Stat 2    │ Stat 3    │ Stat 4                │
├───────────┴───────────┴───────┬───┴───────────────────────┤
│ RevenueChart (12 ay)     2/3  │ ExpensePieChart      1/3  │
├───────────────────────────────┼───────────────────────────┤
│ RecentTransactionsTable  2/3  │ UpcomingReminders    1/3  │
│                               │ NotificationsPanel        │
│                               │ MiniCalendar              │
├───────────────────────────────┴───────────────────────────┤
│ BottomSummary — 4 kart                                    │
└───────────────────────────────────────────────────────────┘
```

Mobilde tek kolona düşer, sidebar drawer (Sheet) olur.

## SEO ve Head
`__root.tsx` başlığı "Hukuk Büro Yönetim Sistemi", uygun description ve og/twitter meta.

## Kapsam Dışı (bu iterasyon)
- Gerçek backend/DB (Lovable Cloud) — istenmedi
- Diğer sayfaların (Müvekkiller, Dosyalar vb.) tam CRUD içeriği — sadece placeholder
- Auth — istenmedi
