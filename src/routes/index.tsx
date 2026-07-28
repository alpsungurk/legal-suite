import { createFileRoute } from "@tanstack/react-router";
import { WelcomeHeader } from "@/components/dashboard/WelcomeHeader";
import { StatCards } from "@/components/dashboard/StatCards";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { ExpensePieChart } from "@/components/dashboard/ExpensePieChart";
import { RecentTransactionsTable } from "@/components/dashboard/RecentTransactionsTable";
import { UpcomingReminders } from "@/components/dashboard/UpcomingReminders";
import { NotificationsPanel } from "@/components/dashboard/NotificationsPanel";
import { MiniCalendar } from "@/components/dashboard/MiniCalendar";
import { BottomSummary } from "@/components/dashboard/BottomSummary";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Lex Yönetim" },
      {
        name: "description",
        content:
          "Büro özet paneli: müvekkil, aktif dosya, tahsilat, masraf istatistikleri, yaklaşan duruşmalar ve son işlemler.",
      },
      { property: "og:title", content: "Dashboard — Lex Yönetim" },
      {
        property: "og:description",
        content:
          "Hukuk büronuza dair tüm önemli metrikler ve yaklaşan görevler tek ekranda.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <WelcomeHeader />
      <StatCards />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <RevenueChart />
        </div>
        <ExpensePieChart />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <RecentTransactionsTable />
        </div>
        <div className="space-y-4">
          <UpcomingReminders />
          <NotificationsPanel />
          <MiniCalendar />
        </div>
      </div>

      <BottomSummary />
    </div>
  );
}
