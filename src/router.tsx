import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { PageSkeleton } from "./components/layout/navigation";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    // Link'in üzerine gelince sayfa kodunu önceden yükle
    defaultPreload: "intent",
    defaultPreloadDelay: 40,
    // Yükleme uzarsa eski sayfayı tutmak yerine iskelet göster
    defaultPendingMs: 150,
    defaultPendingMinMs: 200,
    defaultPendingComponent: PageSkeleton,
  });

  return router;
};
