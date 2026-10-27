/**
 * İcra dosyaları listesi: alacaklı olduğumuz / borçlu olduğumuz dosyalar ve şirket listeleri
 * aynı bileşeni kullanır. Sütun sırası büronun Excel listesiyle aynıdır; Excel'e aktarımda da
 * büronun sütunları (Dosya Durumu, Alacaklı, Borçlu, Birim, Dosya No…) aynı sırayla yazılır.
 */
import { useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  CalendarCheck,
  CirclePause,
  FileSpreadsheet,
  FolderOpen,
  HandCoins,
  Hourglass,
  ListPlus,
  Lock,
  Pencil,
  Plus,
  Trash2,
  Target,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useErp } from "@/lib/erp-store";
import {
  enforcementSummary,
  promiseStatus,
  seizureDueDate,
  seizureWarning,
} from "@/lib/finance";
import { fileNoKey, formatDate, formatMoney, relativeDue, sumBy } from "@/lib/format";
import {
  CLOSED_ENFORCEMENT_STATUS,
  NO_ACTION_ENFORCEMENT_STATUS,
  STOPPED_ENFORCEMENT_STATUS,
  enforcementStatusLabel,
  isEnforcementClosed,
  isEnforcementInactive,
  type EnforcementFile,
  type EnforcementSide,
} from "@/lib/erp-types";
import { AvatarStack, Money, ProgressBar } from "@/components/app/bits";
import { StatGrid, StatTile } from "@/components/app/StatTile";
import { DataTable, type Column, type ExportColumn } from "@/components/app/DataTable";
import { StatusBadge } from "@/components/app/StatusBadge";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useQuick } from "@/components/forms/quick";
import { useDeleteEnforcement } from "@/components/forms/delete-actions";
import { cn } from "@/lib/utils";

export function EnforcementList({
  side,
  clientIds,
  exportName,
  showStats = true,
}: {
  side: EnforcementSide;
  /** Şirket listesi: yalnızca bu müvekkillerin dosyaları */
  clientIds?: string[];
  exportName: string;
  showStats?: boolean;
}) {
  const { state, permissions } = useErp();
  const quick = useQuick();
  const navigate = useNavigate();
  const owed = side === "Borçlu";
  const settings = state.settings;

  const files = state.enforcements.filter(
    (e) => e.side === side && (!clientIds || clientIds.includes(e.clientId)),
  );
  const rows = files.map((e) => ({
    e,
    s: enforcementSummary(state, e.id),
    hz: seizureWarning(e, settings),
    due: owed ? undefined : seizureDueDate(e, settings.seizureValidMonths),
  }));
  type R = (typeof rows)[number];
  // "İşlem Yapılmayacak" dosyalar açık sayılmaz (takipteki alacağa girmez), kapalı da sayılmaz
  const open = rows.filter((r) => !isEnforcementInactive(r.e.status));
  const closedCount = rows.filter((r) => isEnforcementClosed(r.e.status)).length;
  const fileIds = new Set(files.map((e) => e.id));
  const broken = owed
    ? []
    : state.promises.filter((p) => fileIds.has(p.enforcementId) && promiseStatus(p) === "Gecikmiş");
  const seizureSoon = rows.filter((r) => r.hz);

  const clientName = (id: string) => state.clients.find((c) => c.id === id)?.name ?? "—";
  const partyNames = (e: EnforcementFile) =>
    e.debtorIds.map((id) => state.debtors.find((d) => d.id === id)?.name ?? "?");
  // Büronun sütun sırası: alacaklı listesinde "Alacaklı" solda, borçlu listesinde "Borçlu" solda
  const creditor = (e: EnforcementFile) =>
    owed ? partyNames(e).join(", ") : clientName(e.clientId);
  const debtor = (e: EnforcementFile) => (owed ? clientName(e.clientId) : partyNames(e).join(", "));
  const canEdit = permissions.can("enforcements", "create") || permissions.can("enforcements", "edit");
  const canDelete = permissions.can("enforcements", "delete");
  const deleteEnforcement = useDeleteEnforcement();

  const columns: Column<R>[] = [
    {
      id: "status",
      header: "Durum",
      sort: (r) => r.e.status,
      cell: (r) => (
        <div className="min-w-0">
          <StatusBadge status={r.e.status} />
          {r.e.status === STOPPED_ENFORCEMENT_STATUS && r.e.stopReason && (
            <p className="mt-1 max-w-[140px] truncate text-xs text-muted-foreground">
              {r.e.stopReason}
            </p>
          )}
          {r.e.status === CLOSED_ENFORCEMENT_STATUS && r.e.closeReason && (
            <p className="mt-1 max-w-[140px] truncate text-xs text-muted-foreground">
              {r.e.closeReason}
            </p>
          )}
        </div>
      ),
    },
    {
      id: "parties",
      header: owed ? "Borçlu (müvekkil) → Alacaklı" : "Alacaklı (müvekkil) → Borçlu",
      sort: (r) => clientName(r.e.clientId),
      cell: (r) => (
        <div className="min-w-0 text-sm">
          <p className="truncate font-medium">{clientName(r.e.clientId)}</p>
          <p className="truncate text-xs text-muted-foreground">→ {partyNames(r.e).join(", ")}</p>
        </div>
      ),
    },
    {
      id: "no",
      header: "Birim / Dosya no",
      sort: (r) => r.e.no,
      cell: (r) => (
        <div className="min-w-0">
          <p className="font-semibold">{r.e.no}</p>
          <p className="truncate text-xs text-muted-foreground">{r.e.office}</p>
        </div>
      ),
    },
    {
      id: "opening",
      header: "Takip tarihi",
      hideBelow: "md",
      sort: (r) => r.e.openingDate || "0000",
      cell: (r) => (
        <span className="whitespace-nowrap text-sm">
          {r.e.openingDate ? formatDate(r.e.openingDate) : "—"}
        </span>
      ),
    },
    {
      id: "type",
      header: "Takip türü",
      hideBelow: "lg",
      sort: (r) => r.e.type,
      cell: (r) => (
        <div className="min-w-0 text-sm">
          <p>{r.e.type}</p>
          {r.e.procedure && (
            <p className="truncate text-xs text-muted-foreground">{r.e.procedure}</p>
          )}
        </div>
      ),
    },
    {
      id: "claim",
      header: "Takip çıkış rakamı",
      align: "right",
      money: true,
      sort: (r) => r.s.claim,
      cell: (r) => <Money value={r.s.claim} className="font-medium" />,
    },
    ...(owed
      ? []
      : ([
          {
            id: "seizure",
            header: "Haczin düşeceği",
            hideBelow: "md",
            sort: (r) => r.due ?? "9999",
            cell: (r) =>
              r.due ? (
                <div className="text-sm">
                  <p className={cn(r.hz && "font-semibold text-rose-600 dark:text-rose-400")}>
                    {formatDate(r.due)}
                  </p>
                  <p
                    className={cn(
                      "text-[12.5px]",
                      r.hz ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground",
                    )}
                  >
                    {r.hz ? relativeDue(r.due) : `Son haciz ${formatDate(r.e.lastSeizureDate)}`}
                  </p>
                </div>
              ) : (
                <span className="text-muted-foreground">—</span>
              ),
          },
          {
            id: "progress",
            header: "Tahsilat",
            hideBelow: "xl",
            sort: (r) => r.s.progress,
            cell: (r) => (
              <div className="w-36">
                <div className="mb-1 flex justify-between text-[12.5px] text-muted-foreground">
                  <span>{formatMoney(r.s.collected)}</span>
                  <span>%{Math.round(r.s.progress * 100)}</span>
                </div>
                <ProgressBar value={r.s.progress} tone={r.s.progress >= 1 ? "green" : "primary"} />
              </div>
            ),
          },
          {
            id: "next",
            header: "Sıradaki söz",
            hideBelow: "xl",
            sort: (r) => r.s.nextPromise?.dueDate ?? "9999",
            cell: (r) =>
              r.s.nextPromise ? (
                <div className="text-sm">
                  <Money value={r.s.nextPromise.amount} className="font-medium" />
                  <p
                    className={cn(
                      "text-[12.5px]",
                      r.s.overduePromises
                        ? "text-rose-600 dark:text-rose-400"
                        : "text-muted-foreground",
                    )}
                  >
                    {relativeDue(r.s.nextPromise.dueDate)}
                  </p>
                </div>
              ) : (
                <span className="text-muted-foreground">—</span>
              ),
          },
        ] as Column<R>[])),
    {
      id: "resp",
      header: "Sorumlu",
      hideBelow: "xl",
      cell: (r) => (
        <AvatarStack
          names={r.e.responsibleIds.map((id) => state.users.find((u) => u.id === id)?.name ?? "?")}
        />
      ),
    },
  ];

  // Büronun Excel düzeni (AVUKAT-GERI-BILDIRIM.md §3.2), ardından uygulamanın ek bilgileri
  const exportColumns: ExportColumn<R>[] = [
    { header: "Dosya Durumu", get: (r) => enforcementStatusLabel(r.e), width: 26 },
    ...(owed
      ? [
          { header: "Borçlu", get: (r: R) => debtor(r.e), width: 28 },
          { header: "Alacaklı", get: (r: R) => creditor(r.e), width: 28 },
        ]
      : [
          { header: "Alacaklı", get: (r: R) => creditor(r.e), width: 28 },
          { header: "Borçlu", get: (r: R) => debtor(r.e), width: 28 },
        ]),
    { header: "Birim", get: (r) => r.e.office, width: 30 },
    { header: "Dosya No", get: (r) => r.e.no, width: 16 },
    { header: "Takip Türü", get: (r) => r.e.type },
    { header: "Takip Şekli", get: (r) => r.e.procedure ?? "", width: 16 },
    { header: "Takip Bilgileri", get: (r) => r.e.details ?? "", width: 36 },
    { header: "Takip Çıkış Rakamı", get: (r) => r.s.claim, money: true },
    { header: "Açıklamalar", get: (r) => r.e.note ?? "", width: 60 },
    { header: "Son Haciz Tarihi", get: (r) => formatDate(r.e.lastSeizureDate) },
    ...(owed
      ? []
      : [
          { header: "Haczin Düşeceği Tarih", get: (r: R) => formatDate(r.due) },
          { header: "Tahsil Edilen", get: (r: R) => r.s.collected, money: true },
          { header: "Kalan", get: (r: R) => r.s.remaining, money: true },
        ]),
    { header: "Takip Tarihi", get: (r) => formatDate(r.e.openingDate) },
    {
      header: "Sorumlu",
      get: (r) =>
        r.e.responsibleIds
          .map((id) => state.users.find((u) => u.id === id)?.name)
          .filter(Boolean)
          .join(", "),
    },
  ];

  return (
    <>
      {showStats && (
        <StatGrid>
          {owed ? (
            <>
              <StatTile
                label="Açık dosya"
                value={open.length}
                icon={FolderOpen}
                tone="blue"
                hint={`${rows.length} dosyadan`}
              />
              <StatTile
                label="Takip tutarı (aleyhe)"
                value={formatMoney(sumBy(open, (r) => r.s.claim))}
                icon={Target}
                tone="amber"
                hint="Açık dosyalar"
              />
              <StatTile
                label="Durdurulmuş"
                value={rows.filter((r) => r.e.status === STOPPED_ENFORCEMENT_STATUS).length}
                icon={CirclePause}
                tone="violet"
              />
              <StatTile
                label="Kapalı"
                value={closedCount}
                icon={Lock}
                tone="green"
              />
            </>
          ) : (
            <>
              <StatTile
                label="Takipteki alacak"
                value={formatMoney(sumBy(open, (r) => r.s.claim))}
                icon={Target}
                tone="blue"
                hint={`${open.length} açık dosya`}
              />
              <StatTile
                label="Tahsil edilen"
                value={formatMoney(sumBy(rows, (r) => r.s.collected))}
                icon={TrendingUp}
                tone="green"
                hint={`Kalan ${formatMoney(sumBy(open, (r) => r.s.remaining))}`}
              />
              <StatTile
                label="Haczi düşecek"
                value={seizureSoon.length}
                icon={Hourglass}
                tone={seizureSoon.length ? "red" : "green"}
                hint={
                  seizureSoon.length
                    ? `${settings.seizureReminderDays} gün içinde ya da süresi dolmuş`
                    : "Yaklaşan yok"
                }
                hintTone={seizureSoon.length ? "red" : "green"}
              />
              <StatTile
                label="Tutulmayan söz"
                value={broken.length}
                icon={AlertTriangle}
                tone={broken.length ? "red" : "green"}
                hint={broken.length ? formatMoney(sumBy(broken, (p) => p.amount)) : "Gecikme yok"}
                hintTone={broken.length ? "red" : "green"}
              />
            </>
          )}
        </StatGrid>
      )}
      <DataTable
        rows={rows}
        columns={columns}
        getId={(r) => r.e.id}
        searchText={(r) => [
          r.e.no,
          fileNoKey(r.e.no),
          r.e.office,
          clientName(r.e.clientId),
          ...partyNames(r.e),
          r.e.details,
          r.e.stopReason,
          r.e.closeReason,
          r.e.procedure,
        ]}
        searchPlaceholder="Dosya no, birim, alacaklı, borçlu veya takip bilgisi ara..."
        filters={[
          {
            id: "status",
            label: "Durum",
            options: [...new Set([...settings.enforcementStatuses, ...rows.map((r) => r.e.status)])],
            get: (r) => r.e.status,
          },
          {
            id: "type",
            label: "Takip türü",
            options: [...new Set(rows.map((r) => r.e.type))],
            get: (r) => r.e.type,
          },
          {
            id: "stop",
            label: "Durdurulma sebebi",
            options: [...new Set(rows.map((r) => r.e.stopReason).filter(Boolean) as string[])],
            get: (r) => r.e.stopReason,
          },
          {
            id: "close",
            label: "Kapanış sebebi",
            options: [...new Set(rows.map((r) => r.e.closeReason).filter(Boolean) as string[])],
            get: (r) => r.e.closeReason,
          },
          {
            id: "procedure",
            label: "Takip şekli",
            options: [...new Set(rows.map((r) => r.e.procedure).filter(Boolean) as string[])],
            get: (r) => r.e.procedure,
          },
        ]}
        dateRange={{ label: "Takip tarihi", get: (r) => r.e.openingDate }}
        initialSort={owed ? { id: "status" } : { id: "seizure" }}
        exportName={exportName}
        exportColumns={exportColumns}
        onRowClick={(r) => navigate({ to: "/icra/$id", params: { id: r.e.id } })}
        // Büronun Excel'deki işaretleri: kapalı dosyalar sarı, işlem yapılmayacaklar koyu lacivert
        rowClassName={(r) =>
          r.e.status === NO_ACTION_ENFORCEMENT_STATUS
            ? "bg-indigo-950/[0.07] hover:bg-indigo-950/[0.11] dark:bg-indigo-500/10 dark:hover:bg-indigo-500/15"
            : isEnforcementClosed(r.e.status)
              ? "bg-amber-100/60 hover:bg-amber-100 dark:bg-amber-500/10 dark:hover:bg-amber-500/15"
              : undefined
        }
        rowActions={
          canEdit || canDelete
            ? (r) => (
                <>
                  {!owed && (
                    <>
                      <DropdownMenuItem
                        onClick={() =>
                          quick.open("collection", {
                            preset: { enforcementId: r.e.id, debtorId: r.e.debtorIds[0] },
                          })
                        }
                      >
                        <HandCoins /> Tahsilat gir
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() =>
                          quick.open("promise", {
                            preset: { enforcementId: r.e.id, debtorId: r.e.debtorIds[0] },
                          })
                        }
                      >
                        <CalendarCheck /> Ödeme sözü
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuItem
                    onClick={() =>
                      quick.open("enforcementEvent", { preset: { enforcementId: r.e.id } })
                    }
                  >
                    <ListPlus /> İşlem ekle
                  </DropdownMenuItem>
                  {canEdit && (
                    <DropdownMenuItem onClick={() => quick.open("enforcement", { record: r.e })}>
                      <Pencil /> Düzenle
                    </DropdownMenuItem>
                  )}
                  {canDelete && (
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => void deleteEnforcement(r.e)}
                    >
                      <Trash2 /> Sil
                    </DropdownMenuItem>
                  )}
                </>
              )
            : undefined
        }
        mobileCard={(r) => (
          <div>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold">{r.e.no}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {clientName(r.e.clientId)} → {partyNames(r.e).join(", ")}
                </p>
              </div>
              <StatusBadge status={r.e.status} />
            </div>
            {!owed && <ProgressBar value={r.s.progress} className="mt-2" />}
            <p className="mt-1 text-xs text-muted-foreground">
              {formatMoney(r.s.claim)} · {r.e.office}
              {r.e.openingDate && ` · Takip ${formatDate(r.e.openingDate)}`}
              {r.hz && r.due && (
                <span className="text-rose-600 dark:text-rose-400">
                  {" "}
                  · Haciz {relativeDue(r.due)}
                </span>
              )}
            </p>
          </div>
        )}
      />
    </>
  );
}

/**
 * Liste sayfalarının üst düğmeleri: Excel ile aktar, ödeme sözü (alacaklı), yeni takip.
 * clientId verilirse (şirket listesinde tek şirket varsa) yeni takip o müvekkille açılır.
 */
export function EnforcementPageActions({
  side,
  clientId,
}: {
  side: EnforcementSide;
  clientId?: string;
}) {
  const { permissions } = useErp();
  const quick = useQuick();
  const navigate = useNavigate();
  if (!permissions.can("enforcements", "create")) return null;
  const owed = side === "Borçlu";
  return (
    <>
      <Button
        variant="outline"
        onClick={() => quick.open("import", { kind: owed ? "enforcementsOwed" : "enforcements" })}
      >
        <FileSpreadsheet /> Excel ile aktar
      </Button>
      {!owed && (
        <Button variant="outline" onClick={() => quick.open("promise")}>
          <CalendarCheck /> Ödeme sözü
        </Button>
      )}
      <Button
        onClick={() =>
          quick.open("enforcement", {
            preset: clientId ? { side, clientId } : { side },
            onSaved: (e) => navigate({ to: "/icra/$id", params: { id: e.id } }),
          })
        }
      >
        <Plus /> Yeni takip
      </Button>
    </>
  );
}
