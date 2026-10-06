import { useEffect, useState } from "react";
import { useRouter, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

/** Sayfa yüklenirken üstte görünen ince ilerleme çubuğu (kısa geçişlerde hiç görünmez). */
export function NavProgress() {
  const loading = useRouterState({ select: (s) => s.status === "pending" || s.isLoading });
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!loading) {
      setShow(false);
      return;
    }
    const t = setTimeout(() => setShow(true), 80);
    return () => clearTimeout(t);
  }, [loading]);
  return (
    <div
      aria-hidden
      className={cn(
        "no-print pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden transition-opacity duration-200",
        show ? "opacity-100" : "opacity-0",
      )}
    >
      <div className="nav-progress h-full w-1/3 rounded-full bg-primary" />
    </div>
  );
}

/** Yeni sayfanın kodu henüz yüklenmediyse eski sayfa yerine gösterilen iskelet. */
export function PageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6" aria-busy>
      <div className="flex items-center gap-3">
        <div className="skeleton h-10 w-10 rounded-xl" />
        <div className="space-y-2">
          <div className="skeleton h-5 w-48 rounded-md" />
          <div className="skeleton h-3.5 w-72 rounded-md" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="skeleton h-[118px] rounded-2xl" />
        ))}
      </div>
      <div className="skeleton h-[420px] rounded-2xl" />
    </div>
  );
}

/**
 * Oturum açıldıktan sonra tarayıcı boştayken tüm sayfa kodlarını önceden yükler;
 * böylece menüden geçişlerde kod indirme beklemesi olmaz.
 */
export function useWarmRoutes() {
  const router = useRouter();
  useEffect(() => {
    const run = () => {
      for (const route of Object.values(router.routesById)) {
        void router.loadRouteChunk(route as never)?.catch(() => {});
      }
    };
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(run, { timeout: 2500 });
      return () => window.cancelIdleCallback(id);
    }
    const t = setTimeout(run, 1200);
    return () => clearTimeout(t);
  }, [router]);
}
