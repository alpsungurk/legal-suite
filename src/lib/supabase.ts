import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anonKey) {
  console.warn(
    "VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY tanımlı değil. .env dosyasını kontrol edin.",
  );
}

export const supabase = createClient(url ?? "", anonKey ?? "", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: "pkce",
  },
});

export function supabaseConfigured() {
  return Boolean(url && anonKey);
}
