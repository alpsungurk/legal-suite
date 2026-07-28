import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Scale, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/giris")({ component: Login });

function Login() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const signIn = () => {
    setLoading(true);
    window.setTimeout(() => navigate({ to: "/" }), 500);
  };
  return (
    <div className="relative grid min-h-screen overflow-hidden bg-[#f7f9ff] lg:grid-cols-2">
      <div className="absolute -left-28 top-20 h-72 w-72 rounded-full bg-blue-200/40 blur-3xl" />
      <section className="relative hidden overflow-hidden bg-[#10265c] p-12 text-white lg:flex lg:flex-col">
        <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:28px_28px]" />
        <div className="relative flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-white/15 backdrop-blur">
            <Scale className="h-6 w-6" />
          </div>
          <div>
            <p className="font-bold">Lex Yönetim</p>
            <p className="text-xs text-blue-100/70">Hukuk Büro Yönetim Sistemi</p>
          </div>
        </div>
        <div className="relative my-auto max-w-lg">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs text-blue-100">
            <Sparkles className="h-3.5 w-3.5" /> Daha düzenli bir büro
          </div>
          <h1 className="text-4xl font-bold leading-tight">
            Hukuk pratiğinize
            <br />
            <span className="text-blue-300">netlik katın.</span>
          </h1>
          <p className="mt-5 max-w-md text-base leading-7 text-blue-100/75">
            Dosya, müvekkil, tahsilat ve hatırlatmalarınız; güvenli, sade ve her yerden erişilebilir
            tek bir çalışma alanında.
          </p>
        </div>
        <div className="relative flex items-center gap-3 text-sm text-blue-100/70">
          <ShieldCheck className="h-5 w-5 text-blue-300" /> KVKK uyumlu güvenli çalışma alanı
        </div>
      </section>
      <main className="relative mx-auto flex w-full max-w-md flex-col justify-center px-6 py-12 sm:px-8">
        <div className="mb-10 flex items-center gap-3 lg:hidden">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Scale />
          </div>
          <span className="font-bold">Lex Yönetim</span>
        </div>
        <div className="animate-in fade-in-0 slide-in-from-bottom-3 duration-700">
          <p className="text-sm font-medium text-primary">Hoş geldiniz</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight">Hesabınıza giriş yapın</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Büronuzun yönetim paneline erişmek için bilgilerinizi girin.
          </p>
        </div>
        <form
          className="mt-8 space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            signIn();
          }}
        >
          <label className="grid gap-2 text-sm font-medium">
            E-posta adresi
            <Input type="email" defaultValue="ahmet@lexyonetim.com" className="h-11" />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Şifre
            <div className="relative">
              <LockKeyhole className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                required
                type={showPassword ? "text" : "password"}
                defaultValue="123456"
                className="h-11 pl-9 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </label>
          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center gap-2 text-muted-foreground">
              <Checkbox /> Beni hatırla
            </label>
            <button type="button" className="font-medium text-primary hover:underline">
              Şifremi unuttum
            </button>
          </div>
          <Button type="submit" className="h-11 w-full" disabled={loading}>
            {loading ? (
              "Giriş yapılıyor..."
            ) : (
              <>
                Giriş yap <ArrowRight />
              </>
            )}
          </Button>
        </form>
        <p className="mt-8 text-center text-xs text-muted-foreground">
          Giriş yaparak kullanım koşulları ve gizlilik politikasını kabul etmiş olursunuz.
        </p>
      </main>
    </div>
  );
}
