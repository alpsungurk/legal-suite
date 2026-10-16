import { useState } from "react";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BrandImg } from "@/components/app/Brand";
import { ThemeMenu } from "@/components/layout/Topbar";
import { useErp } from "@/lib/erp-store";

/** Yönetici geçici şifre verdiyse: yeni şifre belirlenmeden panele girilemez */
export function FirstPasswordGate() {
  const { setFirstPassword, logout, currentUser } = useErp();
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (password !== again) {
      toast.error("Şifreler eşleşmiyor");
      return;
    }
    setLoading(true);
    const r = await setFirstPassword(password);
    setLoading(false);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success("Şifreniz belirlendi, hoş geldiniz");
  };

  return (
    <div className="relative grid min-h-screen place-items-center bg-[#f4f6fb] px-4 dark:bg-slate-950">
      <div className="absolute right-4 top-4">
        <ThemeMenu />
      </div>
      <div className="w-full max-w-md rounded-2xl border border-slate-200/80 bg-white p-8 shadow-soft dark:border-slate-800 dark:bg-slate-900">
        <BrandImg variant="horizontal" className="mb-6 h-9 w-auto max-w-[200px]" />
        <h1 className="text-2xl font-bold tracking-tight text-[#0c1c3f] dark:text-slate-100">
          Kendi şifrenizi belirleyin
        </h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          {currentUser.name ? `${currentUser.name}, ` : ""}yöneticinin verdiği geçici şifre ile
          giriş yaptınız. Devam etmek için en az 8 karakterlik yeni bir şifre belirleyin.
        </p>
        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          {(
            [
              ["Yeni şifre", password, setPassword],
              ["Yeni şifre (tekrar)", again, setAgain],
            ] as const
          ).map(([label, value, set]) => (
            <label
              key={label}
              className="grid gap-2 text-[14px] font-semibold text-slate-700 dark:text-slate-200"
            >
              {label}
              <div className="relative">
                <LockKeyhole className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  required
                  type="password"
                  value={value}
                  onChange={(e) => set(e.target.value)}
                  autoComplete="new-password"
                  className="h-12 rounded-xl pl-10"
                />
              </div>
            </label>
          ))}
          <Button
            type="submit"
            size="lg"
            loading={loading}
            disabled={loading}
            className="h-12 w-full rounded-xl bg-[#143064] text-white"
          >
            Şifreyi kaydet <ArrowRight className="h-4 w-4" />
          </Button>
        </form>
        <button
          type="button"
          onClick={logout}
          className="mt-4 w-full text-center text-sm font-semibold text-[#1e3a8a] dark:text-sky-300"
        >
          Çıkış yap
        </button>
      </div>
    </div>
  );
}
