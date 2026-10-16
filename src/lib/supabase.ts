import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anonKey) {
  console.warn(
    "VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY tanımlı değil. .env dosyasını kontrol edin.",
  );
}

const REMEMBER_KEY = "lex-remember";

/** "Beni hatırla" seçiliyse oturum kalıcı (localStorage), değilse yalnızca tarayıcı açıkken (sessionStorage) tutulur */
export function setRemember(on: boolean) {
  try {
    localStorage.setItem(REMEMBER_KEY, on ? "1" : "0");
  } catch {
    /* yoksay */
  }
}

/**
 * Sekmeler arası oturum paylaşımı.
 * sessionStorage her sekmeye özeldir ve yeni sekmeye (ör. "Ekstre yazdır" target=_blank) kopyalanmaz;
 * bu yüzden yeni sekme oturumu açık olan sekmeden BroadcastChannel ile ister. Tarayıcı kapanınca bütün
 * sekmeler kapandığı için oturum yine biter ("Beni hatırla" kapalıyken beklenen davranış).
 */
const channel =
  typeof window !== "undefined" && "BroadcastChannel" in window
    ? new BroadcastChannel("lex-auth")
    : null;
const isSessionKey = (k: string) => !k.endsWith("-code-verifier");
const asked = new Set<string>();

channel?.addEventListener("message", (e: MessageEvent) => {
  const m = e.data as { type?: string; id?: string; key?: string } | null;
  if (!m?.key) return;
  if (m.type === "need") {
    const value = sessionStorage.getItem(m.key);
    if (value) channel.postMessage({ type: "have", id: m.id, key: m.key, value });
  } else if (m.type === "removed" && sessionStorage.getItem(m.key)) {
    // Başka sekmede çıkış yapıldı: bu sekme de çıkar
    sessionStorage.removeItem(m.key);
    window.location.reload();
  }
});

function askOtherTabs(key: string): Promise<string | null> {
  if (!channel || asked.has(key)) return Promise.resolve(null);
  asked.add(key);
  const id = crypto.randomUUID();
  return new Promise((resolve) => {
    const done = (v: string | null) => {
      clearTimeout(timer);
      channel.removeEventListener("message", onMessage);
      resolve(v);
    };
    const onMessage = (e: MessageEvent) => {
      const m = e.data as { type?: string; id?: string; value?: string } | null;
      if (m?.type === "have" && m.id === id && m.value) done(m.value);
    };
    const timer = setTimeout(() => done(null), 300);
    channel.addEventListener("message", onMessage);
    channel.postMessage({ type: "need", id, key });
  });
}

const authStorage =
  typeof window === "undefined"
    ? undefined
    : {
        getItem: async (k: string) => {
          const v = localStorage.getItem(k) ?? sessionStorage.getItem(k);
          if (v != null || localStorage.getItem(REMEMBER_KEY) === "1" || !isSessionKey(k)) return v;
          const shared = await askOtherTabs(k);
          if (shared) sessionStorage.setItem(k, shared);
          return shared;
        },
        setItem: (k: string, v: string) => {
          const remember = localStorage.getItem(REMEMBER_KEY) === "1";
          (remember ? localStorage : sessionStorage).setItem(k, v);
          (remember ? sessionStorage : localStorage).removeItem(k);
        },
        removeItem: (k: string) => {
          localStorage.removeItem(k);
          sessionStorage.removeItem(k);
          if (isSessionKey(k)) channel?.postMessage({ type: "removed", key: k });
        },
      };

export const supabase = createClient(url ?? "", anonKey ?? "", {
  auth: {
    persistSession: true,
    storage: authStorage,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: "pkce",
  },
});

export function supabaseConfigured() {
  return Boolean(url && anonKey);
}
