/**
 * Hata izleme (Sentry). Yalnızca VITE_SENTRY_DSN tanımlıysa ve tarayıcıdaysa açılır.
 *
 * Bu uygulama özel hukuk verisi taşır; bu yüzden Sentry'ye giden her şey önce temizlenir:
 *   - kişisel veri gönderilmez (IP, çerez, istek gövdesi, tarayıcı adresindeki sorgu),
 *   - tıklanan öğelerin metni ve konsol çıktıları izlenmez,
 *   - hata mesajlarındaki e-posta, TC/vergi no ve IBAN benzeri değerler maskelenir,
 *   - kullanıcı olarak yalnızca büro ve kullanıcı kimliği ile rol gönderilir (ad / e-posta yok).
 */
import * as Sentry from "@sentry/react";

const DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;
let started = false;

export function sentryEnabled() {
  return started;
}

/** Hata metinlerinden kişisel veriye benzeyen kısımları maskeler */
export function scrubText(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, "[e-posta]")
    .replace(/\bTR\d{2}(?:\s?\d{4}){5}\s?\d{2}\b/gi, "[iban]")
    .replace(/\b\d{10,11}\b/g, "[no]")
    .replace(/(?:\+?90|0)?\s?5\d{2}[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}/g, "[telefon]");
}

/** Adresten sorgu ve parça kısmını atar (yönlendirme adresleri vb. sızmasın) */
function cleanUrl(url?: string) {
  if (!url) return url;
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`;
  } catch {
    return url.split(/[?#]/)[0];
  }
}

export function initSentry() {
  if (started || typeof window === "undefined" || !DSN) return;
  Sentry.init({
    dsn: DSN,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_SENTRY_RELEASE as string | undefined,
    // Sentry 11: ne toplanacağı dataCollection ile belirlenir; hepsi kapalı
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      stackFrameVariables: false,
    },
    // Performans izleme ve oturum kaydı kapalı: yalnızca hatalar
    tracesSampleRate: 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    maxBreadcrumbs: 20,
    integrations: (defaults) =>
      defaults
        .filter((i) => i.name !== "Breadcrumbs" && i.name !== "Console")
        .concat(Sentry.breadcrumbsIntegration({ dom: false })),
    ignoreErrors: [
      "ResizeObserver loop",
      "Non-Error promise rejection captured",
      /^Script error\.?$/,
      "Load failed",
      "Failed to fetch dynamically imported module",
    ],
    denyUrls: [/extensions\//i, /^chrome:\/\//i, /^moz-extension:\/\//i, /^safari-extension:\/\//i],
    beforeBreadcrumb(b) {
      if (b.message) b.message = scrubText(b.message);
      if (b.data?.url) b.data.url = cleanUrl(String(b.data.url));
      if (b.data?.to) b.data.to = cleanUrl(String(b.data.to));
      if (b.data?.from) b.data.from = cleanUrl(String(b.data.from));
      return b;
    },
    beforeSend(event) {
      // İstek ayrıntıları (çerez, başlık, gövde) hiç gitmez
      if (event.request) {
        event.request = { url: cleanUrl(event.request.url) };
      }
      if (event.user) event.user = { id: event.user.id, segment: event.user.segment };
      if (event.message) event.message = scrubText(event.message);
      for (const ex of event.exception?.values ?? []) {
        if (ex.value) ex.value = scrubText(ex.value);
      }
      delete event.extra;
      delete event.contexts?.culture;
      if (event.tags?.url) event.tags.url = cleanUrl(String(event.tags.url));
      return event;
    },
  });
  started = true;
}

/** Oturum açan kişiyi yalnızca kimlikle tanımlar */
export function setSentryContext(ctx: { orgId: string; userId: string; role: string } | null) {
  if (!started) return;
  if (!ctx) {
    Sentry.setUser(null);
    Sentry.setTag("org", undefined);
    Sentry.setTag("role", undefined);
    return;
  }
  Sentry.setUser({ id: ctx.userId, segment: ctx.role });
  Sentry.setTag("org", ctx.orgId);
  Sentry.setTag("role", ctx.role);
}

export function captureError(error: unknown, tags?: Record<string, string>) {
  if (!started) return;
  Sentry.withScope((scope) => {
    for (const [k, v] of Object.entries(tags ?? {})) scope.setTag(k, v);
    Sentry.captureException(error);
  });
}

/** Ayarlar'daki "test hatası gönder" düğmesi için */
export async function sendSentryTest() {
  if (!started) return false;
  Sentry.captureException(new Error("LexKasa test hatası (Ayarlar'dan gönderildi)"));
  return Sentry.flush(5000);
}
