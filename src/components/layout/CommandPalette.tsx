import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CalendarPlus,
  FilePlus2,
  FolderKanban,
  Gavel,
  PiggyBank,
  Receipt,
  UserPlus,
  Users,
  UserX,
  Wallet,
  CornerDownLeft,
  type LucideIcon,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useErp } from "@/lib/erp-store";
import { useQuick, type QuickKind } from "@/components/forms/quick";
import { NAV_PAGES } from "@/components/layout/nav";

const OPEN_EVENT = "lex:command-palette";

export function openCommandPalette() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { state, permissions } = useErp();
  const quick = useQuick();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, []);

  const go = (to: string) => {
    setOpen(false);
    navigate({ to });
  };
  const create = (kind: QuickKind) => {
    setOpen(false);
    setTimeout(() => quick.open(kind), 120);
  };

  const actions: Array<{ kind: QuickKind; label: string; icon: LucideIcon; show: boolean }> = [
    { kind: "expense", label: "Yeni masraf", icon: Receipt, show: permissions.addExpense },
    { kind: "plan", label: "Yeni tahsilat planı", icon: Wallet, show: permissions.manageFinance },
    {
      kind: "advance",
      label: "Masraf avansı al",
      icon: PiggyBank,
      show: permissions.manageFinance,
    },
    { kind: "reminder", label: "Ajandaya ekle", icon: CalendarPlus, show: true },
    { kind: "client", label: "Yeni müvekkil", icon: UserPlus, show: permissions.manageRecords },
    { kind: "case", label: "Yeni dosya", icon: FilePlus2, show: permissions.manageRecords },
    {
      kind: "enforcement",
      label: "Yeni icra dosyası",
      icon: Gavel,
      show: permissions.manageRecords,
    },
  ];

  const pages = NAV_PAGES.filter((p) => !p.allow || p.allow(permissions));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="top-[18%] translate-y-0 overflow-hidden p-0 sm:max-w-xl [&>button:last-child]:hidden">
        <DialogTitle className="sr-only">Hızlı arama</DialogTitle>
        <Command className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-item]]:gap-3 [&_[cmdk-item]]:rounded-lg [&_[cmdk-item]]:px-3 [&_[cmdk-item]]:py-2.5 [&_[cmdk-item][data-selected=true]]:bg-secondary">
          <CommandInput
            placeholder="Müvekkil, dosya, borçlu ara ya da bir işlem seç..."
            className="h-14 text-[15px]"
          />
          <CommandList className="max-h-[60vh] p-1.5">
            <CommandEmpty>Sonuç bulunamadı.</CommandEmpty>
            <CommandGroup heading="Hızlı işlemler">
              {actions
                .filter((a) => a.show)
                .map((a) => (
                  <CommandItem
                    key={a.kind}
                    value={`işlem ${a.label}`}
                    onSelect={() => create(a.kind)}
                  >
                    <span className="grid h-7 w-7 place-items-center rounded-md bg-primary/10 text-primary">
                      <a.icon className="h-4 w-4" />
                    </span>
                    {a.label}
                  </CommandItem>
                ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Müvekkiller">
              {state.clients.map((c) => (
                <CommandItem
                  key={c.id}
                  value={`müvekkil ${c.name} ${c.phone} ${c.identity ?? ""}`}
                  onSelect={() => go(`/muvekkiller/${c.id}`)}
                >
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="text-xs text-muted-foreground">{c.kind}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandGroup heading="Dosyalar">
              {state.cases.map((c) => (
                <CommandItem
                  key={c.id}
                  value={`dosya ${c.no} ${c.title} ${c.esasNo ?? ""} ${c.court ?? ""}`}
                  onSelect={() => go(`/dosyalar/${c.id}`)}
                >
                  <FolderKanban className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{c.no}</span>
                  <span className="flex-1 truncate text-muted-foreground">{c.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandGroup heading="İcra">
              {state.enforcements.map((e) => (
                <CommandItem
                  key={e.id}
                  value={`icra ${e.no} ${e.office}`}
                  onSelect={() => go(`/icra/${e.id}`)}
                >
                  <Gavel className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{e.no}</span>
                  <span className="flex-1 truncate text-muted-foreground">{e.office}</span>
                </CommandItem>
              ))}
              {state.debtors.map((d) => (
                <CommandItem
                  key={d.id}
                  value={`borçlu ${d.name} ${d.identity ?? ""}`}
                  onSelect={() => go(`/borclular/${d.id}`)}
                >
                  <UserX className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 truncate">{d.name}</span>
                  <span className="text-xs text-muted-foreground">Borçlu</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandGroup heading="Sayfalar">
              {pages.map((p) => (
                <CommandItem key={p.url} value={`sayfa ${p.title}`} onSelect={() => go(p.url)}>
                  <p.icon className="h-4 w-4 text-muted-foreground" />
                  {p.title}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
          <div className="flex items-center gap-4 border-t border-border/60 bg-muted/30 px-4 py-2 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <CornerDownLeft className="h-3 w-3" /> seç
            </span>
            <span>↑↓ gezin</span>
            <span>esc kapat</span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
