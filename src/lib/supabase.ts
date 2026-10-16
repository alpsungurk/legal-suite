import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anonKey) {
  console.warn(
    "VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY tanımlı değil. .env dosyasını kontrol edin.",
  );
}

const REMEMBER_KEY = "lex-remember";

/** "Beni hatırla" seçiliyse oturum kalıcı (localStorage), değilse yalnızca sekme boyunca (sessionStorage) tutulur */
export function setRemember(on: boolean) {
  try {
    localStorage.setItem(REMEMBER_KEY, on ? "1" : "0");
  } catch {
    /* yoksay */
  }
}

const authStorage =
  typeof window === "undefined"
    ? undefined
    : {
        getItem: (k: string) => localStorage.getItem(k) ?? sessionStorage.getItem(k),
        setItem: (k: string, v: string) => {
          const remember = localStorage.getItem(REMEMBER_KEY) === "1";
          (remember ? localStorage : sessionStorage).setItem(k, v);
          (remember ? sessionStorage : localStorage).removeItem(k);
        },
        removeItem: (k: string) => {
          localStorage.removeItem(k);
          sessionStorage.removeItem(k);
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
