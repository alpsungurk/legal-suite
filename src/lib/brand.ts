/**
 * LexKasa ürün markası (public/brand/) — büro/şirket logosundan ayrıdır.
 *
 * - logo1.png      → kare: giriş hero, splash
 * - horizontal.png → yatay: giriş üstü, topbar sağ
 * - favicon/       → sekme ikonları
 *
 * Sidebar üstü = Ayarlar’daki büro logosu (FirmMark).
 */
export const BRAND = {
  name: "LexKasa",
  tagline: "Hukuk ön muhasebe ve masraf yönetimi",
  logo: "/brand/logo1.png",
  /** Beyaz zeminli kullanım (loading, açık arka plan) */
  logoLight: "/brand/logo1-light.png",
  horizontal: "/brand/horizontal.png",
  horizontalLight: "/brand/horizontal-light.png",
  mark: "/brand/favicon/android-chrome-192x192.png",
  favicon: {
    ico: "/brand/favicon/favicon.ico",
    png16: "/brand/favicon/favicon-16x16.png",
    png32: "/brand/favicon/favicon-32x32.png",
    apple: "/brand/favicon/apple-touch-icon.png",
    chrome192: "/brand/favicon/android-chrome-192x192.png",
    chrome512: "/brand/favicon/android-chrome-512x512.png",
    manifest: "/brand/favicon/site.webmanifest",
  },
} as const;
