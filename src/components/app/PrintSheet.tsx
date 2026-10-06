import { useEffect, useState, type ReactNode } from "react";
import { Printer, Scale, X } from "lucide-react";
import { useErp } from "@/lib/erp-store";
import { getAttachment } from "@/lib/attachments";
import { formatDateLong, formatIban, today } from "@/lib/format";
import { Button } from "@/components/ui/button";

function useLogoUrl() {
  const { state } = useErp();
  const logo = state.settings.firm.logo;
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!logo) return setUrl(undefined);
    let u: string | undefined;
    void getAttachment(logo.id).then((b) => {
      if (b) {
        u = URL.createObjectURL(b);
        setUrl(u);
      }
    });
    return () => {
      if (u) URL.revokeObjectURL(u);
    };
  }, [logo]);
  return url;
}

/** A4 yazdırma şablonu: büro başlığı, içerik ve alt bilgi. */
export function PrintSheet({
  title,
  subtitle,
  children,
  footerNote,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footerNote?: string;
}) {
  const { state } = useErp();
  const firm = state.settings.firm;
  const logo = useLogoUrl();
  useEffect(() => {
    document.title = `${title} — ${firm.name}`;
  }, [title, firm.name]);
  return (
    <div className="min-h-screen bg-muted/40 py-8 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-4 flex max-w-[210mm] items-center justify-between gap-2 px-4">
        <p className="text-sm text-muted-foreground">
          Yazdır penceresinde “PDF olarak kaydet” seçerek PDF alabilirsiniz.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.close()}>
            <X /> Kapat
          </Button>
          <Button onClick={() => window.print()}>
            <Printer /> Yazdır / PDF
          </Button>
        </div>
      </div>
      <article className="print-sheet mx-auto min-h-[297mm] max-w-[210mm] bg-white p-[14mm] text-[12px] leading-relaxed text-slate-900 shadow-elevated animate-fade-up">
        <header className="flex items-start justify-between gap-6 border-b-2 border-[#143064] pb-5">
          <div className="flex items-center gap-3">
            {logo ? (
              <img src={logo} alt="" className="h-14 max-w-[160px] object-contain" />
            ) : (
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-[#143064] text-[#d4b483]">
                <Scale className="h-6 w-6" />
              </span>
            )}
            <div>
              <p className="text-base font-bold text-[#143064]">{firm.legalName || firm.name}</p>
              <p className="text-[11px] text-slate-500">{firm.address}</p>
              <p className="text-[11px] text-slate-500">
                {[firm.phone, firm.email].filter(Boolean).join(" · ")}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold uppercase tracking-wide text-[#143064]">{title}</p>
            <p className="text-[11px] text-slate-500">Düzenleme: {formatDateLong(today())}</p>
            {firm.taxNo && (
              <p className="text-[11px] text-slate-500">
                {firm.taxOffice} V.D. · {firm.taxNo}
              </p>
            )}
          </div>
        </header>
        {subtitle && <div className="mt-5">{subtitle}</div>}
        <div className="mt-5">{children}</div>
        <footer className="avoid-break mt-10 grid grid-cols-2 gap-8 border-t border-slate-200 pt-5 text-[11px] text-slate-600">
          <div>
            {firm.iban && (
              <>
                <p className="font-semibold text-slate-800">Ödeme bilgileri</p>
                <p>{firm.bankName}</p>
                <p className="font-mono">{formatIban(firm.iban)}</p>
                <p>Alıcı: {firm.legalName || firm.name}</p>
              </>
            )}
            {footerNote && <p className="mt-3 italic">{footerNote}</p>}
          </div>
          <div className="text-right">
            <p className="font-semibold text-slate-800">{firm.legalName || firm.name}</p>
            <div className="ml-auto mt-10 w-48 border-t border-slate-400 pt-1 text-center">
              Kaşe / İmza
            </div>
          </div>
        </footer>
      </article>
    </div>
  );
}

export function PrintTable({
  head,
  rows,
  foot,
  align,
}: {
  head: string[];
  rows: ReactNode[][];
  foot?: ReactNode[];
  align?: Array<"left" | "right">;
}) {
  const a = (i: number) =>
    (align?.[i] ?? (i === 0 ? "left" : "left")) === "right" ? "text-right" : "text-left";
  return (
    <table className="w-full border-collapse text-[11.5px]">
      <thead>
        <tr className="bg-[#143064] text-white">
          {head.map((h, i) => (
            <th key={h} className={`px-2.5 py-2 font-semibold ${a(i)}`}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b border-slate-200 even:bg-slate-50">
            {r.map((c, j) => (
              <td key={j} className={`px-2.5 py-1.5 align-top ${a(j)}`}>
                {c}
              </td>
            ))}
          </tr>
        ))}
        {rows.length === 0 && (
          <tr>
            <td colSpan={head.length} className="px-2.5 py-6 text-center text-slate-500">
              Kayıt yok
            </td>
          </tr>
        )}
      </tbody>
      {foot && (
        <tfoot>
          <tr className="border-t-2 border-[#143064] font-bold">
            {foot.map((c, j) => (
              <td key={j} className={`px-2.5 py-2 ${a(j)}`}>
                {c}
              </td>
            ))}
          </tr>
        </tfoot>
      )}
    </table>
  );
}
