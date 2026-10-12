import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  Eye,
  EyeOff,
  FileStack,
  LockKeyhole,
  Mail,
  Scale,
  ShieldCheck,
  UserRound,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useErp } from "@/lib/erp-store";
import { Spinner } from "@/components/app/Loader";
import { BrandImg } from "@/components/app/Brand";
import { BRAND } from "@/lib/brand";

type Search = { yonlendir?: string };
type Mode = "login" | "forgot";

/** Giriş sonrası dönülecek adres; yalnızca uygulama içi yollara izin verilir. */
const safeTarget = (v?: string) =>
  v && /^\/(?![/\\])/.test(v) && !v.startsWith("/giris") ? v : "/";

export const Route = createFileRoute("/giris")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    yonlendir: typeof s.yonlendir === "string" ? s.yonlendir : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Giriş — LexKasa" },
      { name: "robots", content: "noindex, nofollow, noarchive, nosnippet" },
    ],
  }),
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const { yonlendir } = Route.useSearch();
  const { login, requestPasswordReset } = useErp();
  const [mode, setMode] = useState<Mode>("login");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [forgotId, setForgotId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const id = "lex-login-fonts";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Libre+Baskerville:wght@400;700&family=Manrope:wght@400;500;600;700;800&display=swap";
    document.head.appendChild(link);
  }, []);

  const signIn = async () => {
    setLoading(true);
    setError("");
    const result = await login(username, password);
    if (!result.ok) {
      setError(result.error);
      setLoading(false);
      return;
    }
    toast.success("Hoş geldiniz");
    void navigate({ href: safeTarget(yonlendir) });
  };

  const sendReset = async () => {
    setLoading(true);
    setError("");
    const result = await requestPasswordReset(forgotId);
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast.success("Şifre sıfırlama bağlantısı e-posta adresinize gönderildi");
    setMode("login");
  };

  const inputClass =
    "h-12 rounded-xl border-slate-200/90 bg-white pl-10 text-slate-900 shadow-soft transition-all focus-visible:border-[#1e3a8a]/40 focus-visible:ring-[#1e3a8a]/15";

  return (
    <div className="relative grid min-h-screen overflow-hidden bg-[#f4f6fb] lg:grid-cols-[1.05fr_0.95fr]">
      <section
        className="relative hidden overflow-hidden lg:flex lg:flex-col"
        style={{
          fontFamily: "Manrope, sans-serif",
          background: "linear-gradient(165deg, #b9dcf0 0%, #cfe8f6 38%, #e3f3fb 68%, #eef8fc 100%)",
        }}
      >
        <div className="pointer-events-none absolute -left-24 -top-16 h-80 w-80 rounded-full bg-[#8ec8e4]/45 blur-3xl" />
        <div className="pointer-events-none absolute -right-16 bottom-8 h-96 w-96 rounded-full bg-[#7eb8d4]/35 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.45),transparent_50%)]" />

        <div className="relative z-10 flex h-full flex-col p-12 xl:p-16">
          <div className="w-fit animate-in fade-in-0 slide-in-from-bottom-2 overflow-hidden rounded-2xl bg-white/55 px-3 py-2 shadow-[0_8px_28px_-12px_rgba(20,60,100,0.28)] ring-1 ring-[#6aa8c8]/35 backdrop-blur-sm duration-500">
            <BrandImg variant="horizontal" className="h-11 w-auto max-w-[260px]" />
          </div>

          <div className="my-auto max-w-lg">
            <p className="animate-in fade-in-0 slide-in-from-bottom-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#1a4a6a]/70 duration-500 [animation-delay:60ms]">
              LexKasa
            </p>
            <h2
              className="mt-2 animate-in fade-in-0 slide-in-from-bottom-4 text-[clamp(1.85rem,3.2vw,2.35rem)] font-bold leading-[1.15] tracking-[-0.03em] text-[#0c1c3f] duration-700 [animation-delay:90ms]"
              style={{ fontFamily: '"Libre Baskerville", Georgia, serif' }}
            >
              Büronuzun ön muhasebesi tek yerde
            </h2>
            <p className="mt-4 max-w-md animate-in fade-in-0 slide-in-from-bottom-4 text-[15px] leading-7 text-[#0f2a45]/80 duration-700 [animation-delay:130ms]">
              {BRAND.tagline}. Dosya, müvekkil, tahsilat ve masraflarınızı düzenli tutun; yetkili
              ekibiniz güvenle çalışsın.
            </p>

            <ul className="mt-9 space-y-3">
              {(
                [
                  [
                    FileStack,
                    "Dosya ve müvekkil takibi",
                    "Açık dosyalar, belgeler ve sorumlular tek panelde.",
                    "40ms",
                  ],
                  [
                    Wallet,
                    "Tahsilat ve masraf",
                    "Taksit planları, cari ekstre ve büro giderleri.",
                    "80ms",
                  ],
                  [
                    Scale,
                    "İcra ve ajanda",
                    "İcra dosyaları, vadeler ve duruşma hatırlatmaları.",
                    "120ms",
                  ],
                  [
                    ShieldCheck,
                    "Özel erişim",
                    "Rol bazlı yetki; bu panel herkese açık değildir.",
                    "160ms",
                  ],
                ] as const
              ).map(([Icon, title, desc, delay]) => (
                <li
                  key={title}
                  className="group flex animate-in fade-in-0 slide-in-from-bottom-2 gap-3.5 rounded-2xl border border-white/60 bg-white/55 px-3.5 py-3 shadow-[0_6px_20px_-12px_rgba(20,60,100,0.22)] backdrop-blur-sm duration-500 transition-all hover:-translate-y-0.5 hover:bg-white/80 hover:shadow-[0_12px_28px_-14px_rgba(20,60,100,0.3)]"
                  style={{ animationDelay: delay }}
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-white to-[#d6eef8] text-[#143064] shadow-sm ring-1 ring-[#7eb8d4]/35 transition-transform duration-300 group-hover:scale-105">
                    <Icon className="h-[18px] w-[18px]" strokeWidth={2.1} />
                  </span>
                  <span className="min-w-0 pt-0.5">
                    <span className="block text-[14px] font-semibold tracking-[-0.01em] text-[#0c1c3f]">
                      {title}
                    </span>
                    <span className="mt-0.5 block text-[12.5px] leading-5 text-[#0f2a45]/72">
                      {desc}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <p className="animate-in fade-in-0 text-[11px] font-medium uppercase tracking-[0.16em] text-[#1a4a6a]/50 duration-500 [animation-delay:220ms]">
            © {new Date().getFullYear()} {BRAND.name}
          </p>
        </div>
      </section>

      <main
        className="relative flex w-full flex-col justify-center px-6 py-12 sm:px-10 lg:px-14 xl:px-20"
        style={{ fontFamily: "Manrope, sans-serif" }}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(30,58,138,0.06),transparent_55%)]" />

        <div className="relative mx-auto w-full max-w-[420px]">
          <div className="mb-8 w-fit overflow-hidden rounded-2xl bg-[#e3f3fb] px-2.5 py-1.5 ring-1 ring-[#9fd0ea]/40 lg:hidden">
            <BrandImg variant="horizontal" className="h-9 w-auto max-w-[220px]" />
          </div>

          <h2
            className="text-[1.85rem] font-bold tracking-[-0.03em] text-[#0c1c3f] sm:text-[2.1rem]"
            style={{ fontFamily: '"Libre Baskerville", Georgia, serif' }}
          >
            {mode === "login" ? "Giriş yapın" : "Şifrenizi sıfırlayın"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {mode === "login"
              ? "Size verilen kullanıcı adı ve şifre ile panele giriş yapın."
              : "Kullanıcı adı veya e-posta adresinize sıfırlama bağlantısı gönderilir."}
          </p>

          {mode === "forgot" ? (
            <form
              className="mt-8 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void sendReset();
              }}
            >
              <label className="grid gap-2 text-[13px] font-semibold text-slate-700">
                Kullanıcı adı veya e-posta
                <div className="group relative">
                  <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-[#1e3a8a]" />
                  <Input
                    required
                    value={forgotId}
                    onChange={(e) => setForgotId(e.target.value)}
                    autoComplete="username"
                    className={inputClass}
                  />
                </div>
              </label>
              {error && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                  {error}
                </p>
              )}
              <Button
                type="submit"
                size="lg"
                disabled={loading}
                loading={loading}
                className="h-12 w-full rounded-xl bg-[#143064] text-[15px] font-semibold hover:bg-[#0f2550]"
              >
                Sıfırlama bağlantısı gönder
              </Button>
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setError("");
                }}
                className="w-full text-center text-sm font-semibold text-[#1e3a8a]"
              >
                Girişe dön
              </button>
            </form>
          ) : (
            <form
              className="mt-8 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void signIn();
              }}
            >
              <label className="grid gap-2 text-[13px] font-semibold text-slate-700">
                Kullanıcı adı
                <div className="group relative">
                  <UserRound className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-[#1e3a8a]" />
                  <Input
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    className={inputClass}
                  />
                </div>
              </label>

              <label className="grid gap-2 text-[13px] font-semibold text-slate-700">
                Şifre
                <div className="group relative">
                  <LockKeyhole className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-[#1e3a8a]" />
                  <Input
                    required
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    className="h-12 rounded-xl border-slate-200/90 bg-white pl-10 pr-11 text-slate-900 shadow-soft transition-all focus-visible:border-[#1e3a8a]/40 focus-visible:ring-[#1e3a8a]/15"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-700"
                    aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </label>

              {error && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                  {error}
                </p>
              )}

              <div className="flex items-center justify-end pt-1 text-sm">
                <button
                  type="button"
                  onClick={() => {
                    setForgotId(username);
                    setMode("forgot");
                    setError("");
                  }}
                  className="font-semibold text-[#1e3a8a] transition-opacity hover:opacity-70"
                >
                  Şifremi unuttum
                </button>
              </div>

              <Button
                type="submit"
                size="lg"
                disabled={loading}
                className="h-12 w-full rounded-xl bg-[#143064] text-[15px] font-semibold shadow-[0_14px_28px_-12px_rgba(20,48,100,0.55)] transition-all hover:bg-[#0f2550]"
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <Spinner className="text-white" size="sm" />
                    Giriş yapılıyor…
                  </span>
                ) : (
                  <>
                    Giriş yap <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
