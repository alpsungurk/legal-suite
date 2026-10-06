import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  Scale,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useErp } from "@/lib/erp-store";

export const Route = createFileRoute("/giris")({ component: Login });

const DEMO_ACCOUNTS = [
  { username: "admin", label: "Admin" },
  { username: "avukat", label: "Avukat" },
  { username: "avukat2", label: "Avukat 2" },
  { username: "sekreter", label: "Sekreter" },
] as const;

function Login() {
  const navigate = useNavigate();
  const { login } = useErp();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("123456");
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

  const signIn = () => {
    setLoading(true);
    setError("");
    const result = login(username, password);
    if (!result.ok) {
      setError(result.error);
      setLoading(false);
      toast.error(result.error);
      return;
    }
    toast.success("Giriş başarılı");
    window.setTimeout(() => navigate({ to: "/" }), 200);
  };

  return (
    <div className="relative grid min-h-screen overflow-hidden bg-[#f4f6fb] lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden overflow-hidden lg:flex lg:flex-col">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(1200px 700px at 10% 20%, #2a4a8c 0%, transparent 55%), radial-gradient(900px 600px at 90% 80%, #0b1b3d 0%, transparent 50%), linear-gradient(155deg, #0c1c3f 0%, #143064 42%, #0a162e 100%)",
          }}
        />
        <div className="absolute inset-0 opacity-[0.14] [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:48px_48px]" />
        <div className="absolute -left-24 top-24 h-80 w-80 animate-[pulse_8s_ease-in-out_infinite] rounded-full bg-[#c9a66b]/15 blur-3xl" />
        <div className="absolute -right-16 bottom-10 h-96 w-96 animate-[pulse_10s_ease-in-out_infinite] rounded-full bg-[#4c7ad9]/20 blur-3xl" />

        <div className="relative z-10 flex h-full flex-col p-12 xl:p-16">
          <div className="flex items-center gap-3 animate-in fade-in-0 slide-in-from-left-4 duration-700">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-[#d4b483] to-[#a67c42] text-[#0c1c3f] shadow-[0_12px_40px_-12px_rgba(201,166,107,0.55)]">
              <Scale className="h-6 w-6" strokeWidth={2.25} />
            </div>
            <div>
              <p
                className="text-[1.35rem] font-bold tracking-[-0.03em] text-white"
                style={{ fontFamily: '"Libre Baskerville", Georgia, serif' }}
              >
                Lex Yönetim
              </p>
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/50">
                Hukuk Büro Paneli
              </p>
            </div>
          </div>

          <div className="my-auto max-w-xl animate-in fade-in-0 slide-in-from-bottom-5 duration-1000">
            <p
              className="text-[clamp(2.6rem,4.2vw,3.75rem)] font-bold leading-[1.08] tracking-[-0.03em] text-white"
              style={{ fontFamily: '"Libre Baskerville", Georgia, serif' }}
            >
              Lex Yönetim
            </p>
            <p
              className="mt-5 max-w-md text-[1.05rem] leading-8 text-white/70"
              style={{ fontFamily: "Manrope, sans-serif" }}
            >
              Dosya, müvekkil ve tahsilatlarınız tek düzende. Büronuza sakin, net bir çalışma
              alanı.
            </p>

            <div className="mt-10 flex items-center gap-3 border-t border-white/10 pt-8 text-sm text-white/55">
              <ShieldCheck className="h-5 w-5 text-[#d4b483]" />
              <span style={{ fontFamily: "Manrope, sans-serif" }}>
                KVKK uyumlu · rol bazlı erişim · güvenli oturum
              </span>
            </div>
          </div>

          <p
            className="relative z-10 text-[11px] uppercase tracking-[0.16em] text-white/35"
            style={{ fontFamily: "Manrope, sans-serif" }}
          >
            © {new Date().getFullYear()} Lex Yönetim
          </p>
        </div>
      </section>

      <main
        className="relative flex w-full flex-col justify-center px-6 py-12 sm:px-10 lg:px-14 xl:px-20"
        style={{ fontFamily: "Manrope, sans-serif" }}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(30,58,138,0.06),transparent_55%)]" />

        <div className="relative mx-auto w-full max-w-[420px] animate-in fade-in-0 slide-in-from-bottom-4 duration-700">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#143064] text-[#d4b483]">
              <Scale className="h-5 w-5" />
            </div>
            <div>
              <p
                className="text-lg font-bold text-[#0c1c3f]"
                style={{ fontFamily: '"Libre Baskerville", Georgia, serif' }}
              >
                Lex Yönetim
              </p>
              <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Giriş</p>
            </div>
          </div>

          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#1e3a8a]/70">
            Hoş geldiniz
          </p>
          <h2
            className="mt-2 text-[1.85rem] font-bold tracking-[-0.03em] text-[#0c1c3f] sm:text-[2.1rem]"
            style={{ fontFamily: '"Libre Baskerville", Georgia, serif' }}
          >
            Hesabınıza giriş yapın
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Kullanıcı adınız ve şifrenizle panele geçin.
          </p>

          <form
            className="mt-8 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              signIn();
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
                  placeholder="admin"
                  className="h-12 rounded-xl border-slate-200/90 bg-white pl-10 shadow-soft transition-all focus-visible:border-[#1e3a8a]/40 focus-visible:ring-[#1e3a8a]/15"
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
                  className="h-12 rounded-xl border-slate-200/90 bg-white pl-10 pr-11 shadow-soft transition-all focus-visible:border-[#1e3a8a]/40 focus-visible:ring-[#1e3a8a]/15"
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
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 animate-in fade-in-0 zoom-in-95">
                {error}
              </p>
            )}

            <div className="flex items-center justify-between pt-1 text-sm">
              <label className="flex items-center gap-2 text-slate-500">
                <Checkbox /> Beni hatırla
              </label>
              <button
                type="button"
                className="font-semibold text-[#1e3a8a] transition-opacity hover:opacity-70"
              >
                Şifremi unuttum
              </button>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="h-12 w-full rounded-xl bg-[#143064] text-[15px] font-semibold shadow-[0_14px_28px_-12px_rgba(20,48,100,0.55)] transition-all hover:bg-[#0f2550] hover:shadow-[0_18px_36px_-12px_rgba(20,48,100,0.65)]"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Giriş yapılıyor...
                </span>
              ) : (
                <>
                  Giriş yap <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          <div className="mt-8">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Hızlı giriş · şifre 123456
            </p>
            <div className="flex flex-wrap gap-2">
              {DEMO_ACCOUNTS.map((account) => (
                <button
                  key={account.username}
                  type="button"
                  onClick={() => {
                    setUsername(account.username);
                    setPassword("123456");
                    setError("");
                  }}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
                    username === account.username
                      ? "border-[#143064] bg-[#143064] text-white shadow-soft"
                      : "border-slate-200 bg-white text-slate-600 hover:border-[#143064]/35 hover:text-[#143064]"
                  }`}
                >
                  {account.label}
                </button>
              ))}
            </div>
          </div>

          <p className="mt-10 text-center text-[11px] leading-5 text-slate-400">
            Giriş yaparak kullanım koşulları ve gizlilik politikasını kabul etmiş olursunuz.
          </p>
        </div>
      </main>
    </div>
  );
}
