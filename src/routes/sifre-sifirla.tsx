import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { passwordProblem } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { BrandImg } from "@/components/app/Brand";

export const Route = createFileRoute("/sifre-sifirla")({
  head: () => ({ meta: [{ title: "Yeni şifre — LexKasa" }] }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setError("");
    const problem = passwordProblem(password);
    if (problem) {
      setError(problem);
      return;
    }
    if (password !== again) {
      setError("Şifreler eşleşmiyor");
      return;
    }
    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    toast.success("Şifreniz güncellendi");
    void navigate({ to: "/" });
  };

  return (
    <div className="grid min-h-screen place-items-center bg-[#f4f6fb] px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200/80 bg-white p-8 shadow-soft">
        <BrandImg variant="horizontal" className="mb-6 h-9 w-auto max-w-[200px]" />
        <h1
          className="text-2xl font-bold tracking-tight text-[#0c1c3f]"
          style={{ fontFamily: '"Libre Baskerville", Georgia, serif' }}
        >
          Yeni şifre belirleyin
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          E-postadaki bağlantı ile geldiniz. En az 8 karakterlik yeni bir şifre girin.
        </p>
        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <label className="grid gap-2 text-[13px] font-semibold text-slate-700">
            Yeni şifre
            <div className="relative">
              <LockKeyhole className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                required
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                className="h-12 rounded-xl pl-10"
              />
            </div>
          </label>
          <label className="grid gap-2 text-[13px] font-semibold text-slate-700">
            Yeni şifre (tekrar)
            <div className="relative">
              <LockKeyhole className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                required
                type="password"
                value={again}
                onChange={(e) => setAgain(e.target.value)}
                autoComplete="new-password"
                className="h-12 rounded-xl pl-10"
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
            className="h-12 w-full rounded-xl bg-[#143064]"
          >
            {loading ? (
              "Kaydediliyor..."
            ) : (
              <>
                Şifreyi kaydet <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-500">
          <Link to="/giris" className="font-semibold text-[#1e3a8a]">
            Girişe dön
          </Link>
        </p>
      </div>
    </div>
  );
}
