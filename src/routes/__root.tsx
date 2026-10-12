import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
  useNavigate,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { PageLoader } from "@/components/app/Loader";
import { BRAND } from "@/lib/brand";

import appCss from "../styles.css?url";
import { reportRuntimeError } from "../lib/runtime-error";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { QuickAddMenu, THEME_INIT_SCRIPT, Topbar } from "@/components/layout/Topbar";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { NavProgress, useWarmRoutes } from "@/components/layout/navigation";
import { Toaster } from "@/components/ui/sonner";
import { ErpProvider, useErp } from "@/lib/erp-store";
import { ConfirmProvider } from "@/components/app/confirm";
import { QuickActionsProvider } from "@/components/forms/quick";
import { Button } from "@/components/ui/button";

function NotFoundComponent() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="max-w-md text-center animate-fade-up">
        <p className="text-7xl font-extrabold tracking-tighter text-primary/20">404</p>
        <h2 className="mt-2 text-xl font-semibold">Sayfa bulunamadı</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Aradığınız sayfa mevcut değil veya taşınmış olabilir.
        </p>
        <Button asChild className="mt-6">
          <Link to="/">Gösterge paneline dön</Link>
        </Button>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: unknown; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportRuntimeError(error instanceof Error ? error : new Error(String(error)), {
      boundary: "tanstack_root_error_component",
    });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Bu sayfa yüklenemedi
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Bir şeyler yanlış gitti. Yeniden deneyebilir veya ana sayfaya dönebilirsiniz.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button
            onClick={() => {
              router.invalidate();
              reset();
            }}
          >
            Tekrar dene
          </Button>
          <Button variant="outline" asChild>
            <a href="/">Ana sayfa</a>
          </Button>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "LexKasa" },
      { name: "application-name", content: "LexKasa" },
      { name: "apple-mobile-web-app-title", content: "LexKasa" },
      // Özel panel: arama / önizleme / AI tarayıcıları dizinlemesin
      {
        name: "robots",
        content: "noindex, nofollow, noarchive, nosnippet, noimageindex, notranslate, none",
      },
      { name: "googlebot", content: "noindex, nofollow, noarchive, nosnippet" },
      { name: "bingbot", content: "noindex, nofollow, noarchive, nosnippet" },
      { name: "referrer", content: "no-referrer" },
      { name: "theme-color", content: "#143064" },
      { name: "description", content: "LexKasa — özel büro paneli" },
      { property: "og:site_name", content: BRAND.name },
      { property: "og:title", content: BRAND.name },
      { property: "og:description", content: BRAND.tagline },
      { property: "og:type", content: "website" },
      { property: "og:image", content: BRAND.logo },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: BRAND.name },
      { name: "twitter:description", content: BRAND.tagline },
      { name: "twitter:image", content: BRAND.logo },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: BRAND.favicon.ico, type: "image/x-icon" },
      { rel: "icon", href: BRAND.favicon.png32, type: "image/png", sizes: "32x32" },
      { rel: "icon", href: BRAND.favicon.png16, type: "image/png", sizes: "16x16" },
      { rel: "apple-touch-icon", href: BRAND.favicon.apple },
      { rel: "manifest", href: BRAND.favicon.manifest },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

type Area = "auth" | "print" | "staff";

function areaOf(pathname: string): Area {
  if (pathname === "/giris" || pathname === "/sifre-sifirla") return "auth";
  if (pathname.startsWith("/yazdir")) return "print";
  return "staff";
}

function Splash() {
  return <PageLoader label="Veriler yükleniyor…" />;
}

function AuthGate({ children }: { children: (area: Area) => ReactNode }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { isAuthenticated, hydrated } = useErp();
  const area = areaOf(pathname);

  const here = useRouterState({ select: (s) => s.location.href });
  const wanted = useRouterState({
    select: (s) => (s.location.search as Record<string, unknown>).yonlendir as string | undefined,
  });
  // Giriş sonrası, gitmek istenen sayfaya dönülür (yalnızca uygulama içi yollar)
  const back =
    typeof wanted === "string" && /^\/(?![/\\])/.test(wanted) && !wanted.startsWith("/giris")
      ? wanted
      : "/";

  // /sifre-sifirla: recovery oturumu açıkken de kalınmalı
  const isReset = pathname === "/sifre-sifirla";
  const target: string | null = !hydrated
    ? null
    : isReset
      ? null
      : !isAuthenticated
        ? area === "auth"
          ? null
          : `/giris?yonlendir=${encodeURIComponent(here)}`
        : area === "auth"
          ? back
          : null;

  useEffect(() => {
    if (target) void navigate({ href: target, replace: true });
  }, [target, navigate]);

  // Auth alanında loader gösterme (giriş formu kendi spinner'ını kullanır)
  if (!hydrated || target) return area === "auth" && !target ? <>{children(area)}</> : <Splash />;
  return <>{children(area)}</>;
}

function StaffShell({ children }: { children: ReactNode }) {
  useWarmRoutes();
  return (
    <SidebarProvider>
      <div className="flex min-h-svh w-full bg-background">
        <AppSidebar />
        <SidebarInset className="flex min-w-0 flex-1 flex-col bg-background">
          <Topbar />
          <div className="min-w-0 flex-1 overflow-x-hidden px-4 pb-24 pt-5 sm:px-6 sm:pt-6 md:pb-10 lg:px-8">
            {children}
          </div>
        </SidebarInset>
      </div>
      <CommandPalette />
      <div className="no-print fixed bottom-5 right-5 z-40 md:hidden">
        <QuickAddMenu
          trigger={
            <Button
              size="icon"
              className="h-14 w-14 rounded-full shadow-[0_10px_30px_-8px_var(--primary)]"
              aria-label="Yeni kayıt"
            >
              <Plus className="!size-6" />
            </Button>
          }
        />
      </div>
    </SidebarProvider>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  // Sayfa giriş animasyonları her sayfanın kendi bileşenlerinde (PageHeader, StatGrid,
  // DataTable…). Burada key ile sarmalayıp yeniden mount etmek sayfayı iki kez çizdiriyordu.
  return (
    <QueryClientProvider client={queryClient}>
      <ErpProvider>
        <ConfirmProvider>
          <QuickActionsProvider>
            <AuthGate>
              {(area) =>
                area === "auth" || area === "print" ? (
                  <Outlet />
                ) : (
                  <StaffShell>
                    <Outlet />
                  </StaffShell>
                )
              }
            </AuthGate>
            <NavProgress />
            <Toaster richColors closeButton position="bottom-right" />
          </QuickActionsProvider>
        </ConfirmProvider>
      </ErpProvider>
    </QueryClientProvider>
  );
}
