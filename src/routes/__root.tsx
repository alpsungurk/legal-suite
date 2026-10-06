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
import { Plus, Scale } from "lucide-react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { QuickAddMenu, THEME_INIT_SCRIPT, Topbar } from "@/components/layout/Topbar";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { NavProgress, useWarmRoutes } from "@/components/layout/navigation";
import { PortalShell } from "@/components/layout/PortalShell";
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

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
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
      { title: "Lex Yönetim — Hukuk Bürosu Yönetim Sistemi" },
      {
        name: "description",
        content:
          "Hukuk büroları için masraf, masraf avansı, tahsilat, taksit, cari hesap, banka/kasa, icra takibi ve müvekkil portalı.",
      },
      { name: "theme-color", content: "#143064" },
      { property: "og:title", content: "Lex Yönetim — Hukuk Bürosu Yönetim Sistemi" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
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

type Area = "auth" | "print" | "portal" | "staff";

function areaOf(pathname: string): Area {
  if (pathname === "/giris") return "auth";
  if (pathname.startsWith("/yazdir")) return "print";
  if (pathname === "/portal" || pathname.startsWith("/portal/")) return "portal";
  return "staff";
}

function Splash() {
  return (
    <div className="grid min-h-screen place-items-center bg-background">
      <div className="flex flex-col items-center gap-3 animate-fade-up">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-[#d4b483] to-[#a67c42] text-[#0c1c3f] shadow-lg">
          <Scale className="h-6 w-6 animate-pulse" />
        </div>
        <div className="h-1 w-24 overflow-hidden rounded-full bg-secondary">
          <div className="skeleton h-full w-full" />
        </div>
      </div>
    </div>
  );
}

function AuthGate({ children }: { children: (area: Area) => ReactNode }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { isAuthenticated, hydrated, permissions } = useErp();
  const area = areaOf(pathname);

  const target: string | null = !hydrated
    ? null
    : !isAuthenticated
      ? area === "auth"
        ? null
        : "/giris"
      : area === "auth"
        ? permissions.isPortal
          ? "/portal"
          : "/"
        : permissions.isPortal && area === "staff"
          ? "/portal"
          : !permissions.isPortal && area === "portal"
            ? "/"
            : null;

  useEffect(() => {
    if (target) navigate({ to: target, replace: true });
  }, [target, navigate]);

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
          <main className="min-w-0 flex-1 overflow-x-hidden px-4 pb-24 pt-5 sm:px-6 sm:pt-6 md:pb-10 lg:px-8">
            {children}
          </main>
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
  // Giriş animasyonu yeni sayfa gerçekten render olduğunda oynasın (URL değiştiği anda değil)
  const routeKey = useRouterState({
    select: (s) => (s.resolvedLocation ?? s.location).pathname,
  });

  return (
    <QueryClientProvider client={queryClient}>
      <ErpProvider>
        <ConfirmProvider>
          <QuickActionsProvider>
            <AuthGate>
              {(area) =>
                area === "auth" || area === "print" ? (
                  <Outlet />
                ) : area === "portal" ? (
                  <PortalShell>
                    <div key={routeKey} className="route-content-enter">
                      <Outlet />
                    </div>
                  </PortalShell>
                ) : (
                  <StaffShell>
                    <div key={routeKey} className="route-content-enter">
                      <Outlet />
                    </div>
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
