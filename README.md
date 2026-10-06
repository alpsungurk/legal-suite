# Lex Yönetim — Hukuk Bürosu Yönetim Sistemi

Hukuk büroları için masraf, masraf avansı, tahsilat/taksit, cari hesap, banka/kasa,
icra takibi ve müvekkil portalını tek yerde toplayan web uygulaması.

## Modüller

- **Gösterge paneli** — role göre değişir: finans ekibi için tahsilat, alacak, nakit ve uyarılar; avukat için ajanda ve dosyalar.
- **Müvekkiller / Dosyalar** — detay sayfaları, sorumlu avukat ataması, zaman çizelgesi, belgeler.
- **Masraflar** — makbuz/fotoğraf ekleme, dosya masrafı ya da büro gideri ayrımı, toplu işlemler.
- **Masraf avansları** — müvekkilden alınan avans, harcanan, kalan bakiye ve düşük bakiye uyarısı.
- **Tahsilatlar ve taksitler** — taksit planı sihirbazı (peşinat, sıklık, düzenlenebilir tablo), kısmi ödeme, fazla ödemenin sonraki taksite aktarılması, aylık ücret tahakkuku.
- **Cari hesap** — yürüyen bakiyeli müvekkil ekstresi, PDF çıktısı.
- **Banka & Kasa** — hesap bakiyeleri, tüm para hareketleri, virman, müvekkile aktarım.
- **İcra** — icra dosyaları, borçlu kartları, ödeme sözleri, tahsilatlar, görüşme notları.
- **Ajanda** — aylık takvim (sürükle-bırak), duruşma/süre/görev, taksit vadeleri ve ödeme sözleri.
- **Müvekkil portalı** — müvekkil kendi dosyalarını, duruşmalarını, ekstresini görür; belge yükler, mesajlaşır.
- **Raporlar** — gelir/gider, kâr marjı, tahsilat oranı, nakit yeterliliği, alacak yaşlandırma, ekip iş yükü; çok sayfalı Excel.
- **Aktivite geçmişi** — alan bazında önce/sonra değişiklik kaydı.
- **Ayarlar** — büro profili ve logo, kullanıcılar ve roller, kategoriler, şifre, yedekleme (zip).

Roller: **Admin**, **Avukat**, **Sekreter**, **Müvekkil** (portal).

## Demo hesaplar

Şifre hepsi için `123456`: `admin`, `avukat`, `avukat2`, `sekreter`, `muvekkil` (portal).

## Geliştirme

```bash
npm install
npm run dev     # geliştirme sunucusu
npm run build   # üretim derlemesi
npm run lint
```

TanStack Start + React 19, Tailwind CSS v4, shadcn/ui, Recharts.

## Veri

Veriler şu an tarayıcıda saklanır (kayıtlar `localStorage`, dosya ekleri IndexedDB).
Ayarlar › Yedekleme bölümünden tüm veri ve ekler tek bir .zip olarak indirilip geri yüklenebilir.
Her kayıt `firmId` taşır ve veri erişimi `src/lib/erp-store.tsx` üzerinden geçer; çok büroya ve
Supabase'e geçişte bu katman değiştirilecek.

| Dosya | İçerik |
| --- | --- |
| `src/lib/erp-types.ts` | Veri modeli ve rol yetkileri |
| `src/lib/erp-store.tsx` | Durum yönetimi, CRUD, aktivite/bildirim, oturum |
| `src/lib/finance.ts` | Avans, taksit, cari, banka, icra hesapları ve uyarılar |
| `src/lib/migrations.ts` | Eski kayıtların yeni şemaya taşınması |
| `src/components/forms/` | Tüm kayıt formları (`useQuick().open(...)` ile her yerden açılır) |
| `src/components/app/` | Ortak bileşenler: DataTable, FormDialog, StatTile, PrintSheet… |
