import { useEffect, useState } from "react";
import { Building, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useErp } from "@/lib/erp-store";
import { newId } from "@/lib/mappers";
import { DEFAULT_LIST_ICON, LIST_ICONS, listIcon } from "@/lib/list-icons";
import { matches } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Client, CompanyList } from "@/lib/erp-types";
import { Section } from "@/components/app/bits";
import { EmptyState } from "@/components/EmptyState";
import { useConfirm } from "@/components/app/confirm";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

/**
 * Ayarlar → Şirket listeleri: belirli müvekkillerin (çoğunlukla şirketlerin) icra dosyaları
 * menüde ayrı bir liste olarak görünür. Liste silmek yalnızca görünümü kaldırır; dosyalara dokunmaz.
 */
type Access = { view: boolean; create: boolean; edit: boolean; delete: boolean };

export function CompanyListsTab({ access }: { access: Access }) {
  const { state, updateSettings } = useErp();
  const confirm = useConfirm();
  const lists = state.settings.companyLists;
  const [name, setName] = useState("");

  const saveLists = (next: CompanyList[]) => updateSettings({ companyLists: next });

  const add = () => {
    const n = name.trim();
    if (!n) return;
    if (lists.some((l) => l.name.toLocaleLowerCase("tr") === n.toLocaleLowerCase("tr"))) {
      toast.error("Bu adla bir liste zaten var");
      return;
    }
    saveLists([...lists, { id: newId(), name: n, clientIds: [], icon: DEFAULT_LIST_ICON }]);
    setName("");
    toast.success("Liste eklendi; şimdi müvekkilleri seçin");
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Önemli müvekkil şirketlerin icra dosyalarını ayrı listelerde görmek için kullanılır. Her
        liste menüde <b>İcra</b> altında çıkar ve içinde alacaklı / borçlu olduğumuz dosyalar ayrı
        sekmelerde durur. İstediğiniz kadar liste ekleyebilirsiniz.
      </p>
      {access.create && (
        <Section title="Yeni liste">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              add();
            }}
          >
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Örn. Kaya Holding dosyaları"
            />
            <Button type="submit">
              <Plus /> Liste ekle
            </Button>
          </form>
        </Section>
      )}
      {lists.length === 0 ? (
        <EmptyState
          icon={Building}
          title="Henüz şirket listesi yok"
          description="Yukarıdan bir liste ekleyip içine müvekkil seçin."
          compact
        />
      ) : (
        lists.map((l) => (
          <CompanyListEditor
            key={l.id}
            list={l}
            access={access}
            onChange={(next) => saveLists(lists.map((x) => (x.id === l.id ? next : x)))}
            onRemove={async () => {
              if (
                await confirm({
                  title: `"${l.name}" listesi silinsin mi?`,
                  description: "Yalnızca liste görünümü kaldırılır; icra dosyaları silinmez.",
                })
              ) {
                saveLists(lists.filter((x) => x.id !== l.id));
                toast.success("Liste silindi");
              }
            }}
          />
        ))
      )}
    </div>
  );
}

function CompanyListEditor({
  list,
  access,
  onChange,
  onRemove,
}: {
  list: CompanyList;
  access: Access;
  onChange: (l: CompanyList) => void;
  onRemove: () => void;
}) {
  const { state } = useErp();
  const [name, setName] = useState(list.name);
  const [renaming, setRenaming] = useState(false);
  const [companiesOnly, setCompaniesOnly] = useState(true);
  useEffect(() => setName(list.name), [list.name]);

  const clients = state.clients.filter(
    (c) => !companiesOnly || c.kind === "Kurumsal" || list.clientIds.includes(c.id),
  );
  const fileCount = state.enforcements.filter((e) => list.clientIds.includes(e.clientId)).length;
  const Icon = listIcon(list.icon);

  return (
    <Section
      title={
        renaming ? (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const n = name.trim();
              if (!n) return;
              onChange({ ...list, name: n });
              setRenaming(false);
            }}
          >
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-8"
              autoFocus
            />
            <Button type="submit" size="sm">
              Kaydet
            </Button>
          </form>
        ) : (
          <span className="inline-flex items-center gap-2">
            <Icon className="h-4 w-4 text-primary" /> {list.name}
          </span>
        )
      }
      description={`${list.clientIds.length} müvekkil · ${fileCount} icra dosyası`}
      actions={
        <div className="flex gap-1">
          {access.edit && (
            <Button variant="ghost" size="sm" onClick={() => setRenaming((r) => !r)}>
              <Pencil /> Adı
            </Button>
          )}
          {access.delete && (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={onRemove}
            >
              <Trash2 /> Sil
            </Button>
          )}
        </div>
      }
    >
      <div className={cn("space-y-3", !access.edit && "opacity-70")} inert={!access.edit}>
        <div>
          <p className="mb-1.5 text-[14px] font-medium">Menü ikonu</p>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(LIST_ICONS).map(([key, I]) => (
              <button
                key={key}
                type="button"
                onClick={() => onChange({ ...list, icon: key })}
                aria-label={key}
                aria-pressed={(list.icon ?? DEFAULT_LIST_ICON) === key}
                className={cn(
                  "grid h-9 w-9 place-items-center rounded-lg border transition-colors",
                  (list.icon ?? DEFAULT_LIST_ICON) === key
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-secondary",
                )}
              >
                <I className="h-4 w-4" />
              </button>
            ))}
          </div>
        </div>
        <ClientChecklist
          clients={clients}
          value={list.clientIds}
          onChange={(clientIds) => onChange({ ...list, clientIds })}
        />
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <Switch checked={companiesOnly} onCheckedChange={setCompaniesOnly} />
          Yalnızca kurumsal müvekkilleri listele
        </label>
      </div>
    </Section>
  );
}

function ClientChecklist({
  clients,
  value,
  onChange,
}: {
  clients: Client[];
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const shown = clients.filter((c) => matches(query, c.name));
  const toggle = (id: string, on: boolean) =>
    onChange(on ? [...value, id] : value.filter((v) => v !== id));

  return (
    <div className="rounded-lg border">
      <div className="flex items-center gap-2 border-b px-3">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Müvekkil ara…"
          className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <span className="shrink-0 text-xs text-muted-foreground">{value.length} seçili</span>
      </div>
      <ul className="max-h-64 divide-y overflow-y-auto">
        {shown.map((c) => (
          <li key={c.id}>
            <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-secondary/60">
              <Checkbox
                checked={value.includes(c.id)}
                onCheckedChange={(on) => toggle(c.id, on === true)}
              />
              <span className="min-w-0 flex-1 truncate">{c.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{c.kind}</span>
            </label>
          </li>
        ))}
        {!shown.length && (
          <li className="px-3 py-4 text-center text-sm text-muted-foreground">
            Müvekkil bulunamadı
          </li>
        )}
      </ul>
    </div>
  );
}
