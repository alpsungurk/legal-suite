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
    // Yalnızca gerçekten yavaş yüklemelerde iskelet göster; kısa yüklemelerde
    // iskelet bir an görünüp kaybolursa sayfa iki kez açılıyormuş gibi görünür.
    defaultPendingMs: 400,
    defaultPendingMinMs: 300,
    defaultPendingComponent: PageSkeleton,
  });

  return router;
};
