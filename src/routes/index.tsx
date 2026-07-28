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
        content: "Hukuk büronuza dair tüm önemli metrikler ve yaklaşan görevler tek ekranda.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  return (
    <div className="dashboard-enter mx-auto min-w-0 max-w-[1600px] space-y-5 sm:space-y-6">
      <WelcomeHeader />
      <StatCards />

      <div className="grid min-w-0 grid-cols-1 items-stretch gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(360px,0.9fr)]">
        <div className="min-w-0">
          <RevenueChart />
        </div>
        <ExpensePieChart />
      </div>

      <div className="grid min-w-0 grid-cols-1 items-stretch gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(360px,0.9fr)]">
        <div className="min-w-0">
          <RecentTransactionsTable />
        </div>
        <NotificationsPanel />
      </div>

      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
        <UpcomingReminders />
        <MiniCalendar />
      </div>

      <BottomSummary />
    </div>
  );
}
