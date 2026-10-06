import { useEffect, useRef, useState } from "react";
import { Download, Eye, FileImage, FileText, Paperclip, Trash2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatBytes } from "@/lib/format";
import type { AttachmentRef } from "@/lib/erp-types";
import {
  downloadAttachment,
  getAttachment,
  openAttachment,
  saveAttachment,
} from "@/lib/attachments";
import { Button } from "@/components/ui/button";

export function FileDrop({
  onFiles,
  accept = "image/*,application/pdf,.doc,.docx,.xls,.xlsx,.udf",
  multiple = true,
  label = "Dosyaları sürükleyin veya seçin",
  hint = "PDF, görsel, Word · en fazla 15 MB",
  compact,
}: {
  onFiles: (refs: AttachmentRef[]) => void;
  accept?: string;
  multiple?: boolean;
  label?: string;
  hint?: string;
  compact?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);

  const handle = async (list: FileList | null) => {
    if (!list?.length) return;
    setBusy(true);
    const refs: AttachmentRef[] = [];
    for (const file of Array.from(list)) {
      try {
        refs.push(await saveAttachment(file));
      } catch (err) {
        toast.error(`${file.name}: ${(err as Error).message}`);
      }
    }
    setBusy(false);
    if (refs.length) onFiles(refs);
    if (input.current) input.current.value = "";
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => input.current?.click()}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        void handle(e.dataTransfer.files);
      }}
      className={cn(
        "group flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed text-center transition-all duration-200 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25",
        compact ? "px-4 py-4" : "px-6 py-7",
        drag
          ? "scale-[1.01] border-primary bg-primary/5"
          : "border-border bg-secondary/20 hover:border-primary/40 hover:bg-primary/[0.03]",
      )}
    >
      <input
        ref={input}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => void handle(e.target.files)}
      />
      <span
        className={cn(
          "grid h-10 w-10 place-items-center rounded-full bg-card text-muted-foreground shadow-soft ring-1 ring-border transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:text-primary",
          busy && "animate-pulse",
        )}
      >
        <UploadCloud className="h-5 w-5" />
      </span>
      <p className="text-sm font-medium">{busy ? "Yükleniyor..." : label}</p>
      {!compact && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function useThumb(ref: AttachmentRef) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!ref.mime.startsWith("image/")) return;
    let u: string | undefined;
    let alive = true;
    void getAttachment(ref.id).then((blob) => {
      if (!alive || !blob) return;
      u = URL.createObjectURL(blob);
      setUrl(u);
    });
    return () => {
      alive = false;
      if (u) URL.revokeObjectURL(u);
    };
  }, [ref.id, ref.mime]);
  return url;
}

export function AttachmentChip({ file, onRemove }: { file: AttachmentRef; onRemove?: () => void }) {
  const thumb = useThumb(file);
  const Icon = file.mime.startsWith("image/")
    ? FileImage
    : file.mime === "application/pdf"
      ? FileText
      : Paperclip;
  const run = (fn: () => Promise<void>) => fn().catch((e: Error) => toast.error(e.message));
  return (
    <div className="group flex items-center gap-3 rounded-xl border border-border/80 bg-card p-2 pr-1.5 shadow-xs transition-colors hover:border-primary/30 animate-pop">
      <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-secondary text-muted-foreground">
        {thumb ? (
          <img src={thumb} alt="" className="h-full w-full object-cover" />
        ) : (
          <Icon className="h-5 w-5" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{file.name}</p>
        <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
      </div>
      <div className="flex items-center">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => run(() => openAttachment(file))}
          title="Görüntüle"
        >
          <Eye />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => run(() => downloadAttachment(file))}
          title="İndir"
        >
          <Download />
        </Button>
        {onRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-destructive"
            onClick={onRemove}
            title="Kaldır"
          >
            <Trash2 />
          </Button>
        )}
      </div>
    </div>
  );
}

export function AttachmentList({
  files,
  onChange,
  readOnly,
}: {
  files: AttachmentRef[];
  onChange?: (files: AttachmentRef[]) => void;
  readOnly?: boolean;
}) {
  return (
    <div className="space-y-2">
      {files.map((f) => (
        <AttachmentChip
          key={f.id}
          file={f}
          onRemove={
            readOnly || !onChange ? undefined : () => onChange(files.filter((x) => x.id !== f.id))
          }
        />
      ))}
      {!readOnly && onChange && (
        <FileDrop
          compact={files.length > 0}
          onFiles={(refs) => onChange([...files, ...refs])}
          label={files.length ? "Dosya ekle" : undefined}
        />
      )}
    </div>
  );
}
