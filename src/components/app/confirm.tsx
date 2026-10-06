import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

type ConfirmOptions = {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
};

const ConfirmContext = createContext<(o: ConfirmOptions) => Promise<boolean>>(async () => false);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<(v: boolean) => void>(undefined);

  const confirm = useCallback((o: ConfirmOptions) => {
    setOpts(o);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = (v: boolean) => {
    resolver.current?.(v);
    resolver.current = undefined;
    setOpts(null);
  };

  const destructive = opts?.destructive ?? true;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog open={!!opts} onOpenChange={(o) => !o && close(false)}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader className="sm:flex-row sm:items-start sm:gap-4 sm:text-left">
            {destructive && (
              <span className="mx-auto grid h-10 w-10 shrink-0 place-items-center rounded-full bg-destructive/10 text-destructive sm:mx-0">
                <AlertTriangle className="h-5 w-5" />
              </span>
            )}
            <div className="space-y-1.5">
              <AlertDialogTitle>{opts?.title}</AlertDialogTitle>
              {opts?.description && (
                <AlertDialogDescription>{opts.description}</AlertDialogDescription>
              )}
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <Button
              variant={destructive ? "destructive" : "default"}
              onClick={() => close(true)}
              autoFocus
            >
              {opts?.confirmLabel ?? (destructive ? "Sil" : "Onayla")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  return useContext(ConfirmContext);
}
