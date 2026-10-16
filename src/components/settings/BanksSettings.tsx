import { useState } from "react";
import { FileSpreadsheet, Landmark, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useErp } from "@/lib/erp-store";
import type { Bank } from "@/lib/erp-types";
import { Section } from "@/components/app/bits";
import { DataTable, type Column } from "@/components/app/DataTable";
import { StatusBadge } from "@/components/app/StatusBadge";
import { FormDialog } from "@/components/app/FormDialog";
import { useConfirm } from "@/components/app/confirm";
import { useQuick } from "@/components/forms/quick";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/EmptyState";

type Access = { view: boolean; create: boolean; edit: boolean; delete: boolean };

/**
 * Ayarlar → Kategoriler → Bankalar: 89/1 haciz ihbarnamesinde seçilecek bankalar.
 * Tek tablo; aktif/pasif; Excel ile toplu yükleme.
 */
export function BanksSettings({ access }: { access: Access }) {
  const { state, save, patch, remove } = useErp();
  const confirm = useConfirm();
  const quick = useQuick();
  const [form, setForm] = useState<{ open: boolean; record?: Bank }>({ open: false });
  const banks = [...state.banks].sort((a, b) => a.name.localeCompare(b.name, "tr"));

  const columns: Column<Bank>[] = [
    {
      id: "name",
      header: "Banka adı",
      sort: (b) => b.name,
      export: (b) => b.name,
      cell: (b) => <span className="font-medium">{b.name}</span>,
    },
    {
      id: "status",
      header: "Durum",
      sort: (b) => (b.active ? 0 : 1),
      export: (b) => (b.active ? "Aktif" : "Pasif"),
      cell: (b) => (
        <StatusBadge tone={b.active ? "green" : "slate"} dot={false}>
          {b.active ? "Aktif" : "Pasif"}
        </StatusBadge>
      ),
    },
  ];

  return (
    <Section
      title="Bankalar"
      description="89/1–89/3 ve sorgu formunda listeden seçilir. Pasif bankalar formda çıkmaz; eski kayıtlardaki adlar silinmez."
      actions={
        <>
          {access.create && (
            <Button variant="outline" size="sm" onClick={() => quick.open("import", { kind: "banks" })}>
              <FileSpreadsheet /> Excel ile aktar
            </Button>
          )}
          {access.create && (
            <Button size="sm" onClick={() => setForm({ open: true })}>
              <Plus /> Banka ekle
            </Button>
          )}
        </>
      }
      bodyClassName={banks.length ? "p-0" : undefined}
    >
      {banks.length === 0 ? (
        <EmptyState
          icon={Landmark}
          title="Henüz banka yok"
          description="Tek tek ekleyin veya Excel şablonuyla toplu yükleyin."
          compact
          action={
            access.create ? (
              <Button onClick={() => setForm({ open: true })}>
                <Plus /> Banka ekle
              </Button>
            ) : undefined
          }
        />
      ) : (
        <DataTable
          className="rounded-none border-0 shadow-none"
          rows={banks}
          columns={columns}
          getId={(b) => b.id}
          searchText={(b) => [b.name, b.active ? "Aktif" : "Pasif"]}
          filters={[
            {
              id: "status",
              label: "Durum",
              options: ["Aktif", "Pasif"],
              get: (b) => (b.active ? "Aktif" : "Pasif"),
            },
          ]}
          initialSort={{ id: "name", desc: false }}
          exportName="Bankalar"
          rowActions={(b) => (
            <>
              {access.edit && (
                <DropdownMenuItem onClick={() => setForm({ open: true, record: b })}>
                  <Pencil /> Düzenle
                </DropdownMenuItem>
              )}
              {access.edit && (
                <DropdownMenuItem
                  onClick={() => {
                    patch("banks", b.id, { active: !b.active });
                    toast.success(b.active ? "Pasife alındı" : "Aktifleştirildi");
                  }}
                >
                  {b.active ? "Pasife al" : "Aktifleştir"}
                </DropdownMenuItem>
              )}
              {access.delete && (
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={async () => {
                    if (
                      await confirm({
                        title: `"${b.name}" silinsin mi?`,
                        description: "89/1 formundaki listeden kalkar; eski işlem kayıtlarındaki ad kalır.",
                      })
                    ) {
                      remove("banks", b.id);
                      toast.success("Banka silindi");
                    }
                  }}
                >
                  <Trash2 /> Sil
                </DropdownMenuItem>
              )}
            </>
          )}
          mobileCard={(b) => (
            <div className="flex items-center justify-between gap-3">
              <p className="truncate font-medium">{b.name}</p>
              <StatusBadge tone={b.active ? "green" : "slate"} dot={false}>
                {b.active ? "Aktif" : "Pasif"}
              </StatusBadge>
            </div>
          )}
        />
      )}

      <FormDialog
        key={form.record?.id ?? "new"}
        open={form.open}
        onOpenChange={(o) => !o && setForm({ open: false })}
        title={form.record ? "Bankayı düzenle" : "Banka ekle"}
        fields={[
          { name: "name", label: "Banka adı", required: true },
          {
            name: "active",
            label: "Aktif",
            type: "switch",
          },
        ]}
        initial={{
          name: form.record?.name ?? "",
          active: form.record?.active ?? true,
        }}
        validate={(v) => {
          const name = String(v.name ?? "").trim();
          if (!name) return { name: "Zorunlu alan" };
          const dup = state.banks.find(
            (b) =>
              b.id !== form.record?.id &&
              b.name.toLocaleLowerCase("tr") === name.toLocaleLowerCase("tr"),
          );
          if (dup) return { name: "Bu adla bir banka zaten var" };
          return undefined;
        }}
        onSubmit={(v) => {
          save("banks", {
            id: form.record?.id,
            name: String(v.name).trim(),
            active: !!v.active,
          });
          toast.success(form.record ? "Banka güncellendi" : "Banka eklendi");
          setForm({ open: false });
        }}
      />
    </Section>
  );
}
