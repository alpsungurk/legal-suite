import { createFileRoute, redirect } from "@tanstack/react-router";

/** Taksitler artık Tahsilatlar sayfasının "Bekleyen" sekmesinde. Eski bağlantılar oraya gider. */
export const Route = createFileRoute("/taksitler")({
  beforeLoad: () => {
    throw redirect({ to: "/tahsilatlar", search: { sekme: "bekleyen" } });
  },
});
