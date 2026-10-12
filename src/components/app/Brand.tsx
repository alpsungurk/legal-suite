import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { BRAND } from "@/lib/brand";
import { useErp } from "@/lib/erp-store";
import { getAttachment } from "@/lib/attachments";
import { initials } from "@/lib/format";

type Variant = "mark" | "logo" | "logoLight" | "horizontal" | "horizontalLight";

const srcOf: Record<Variant, string> = {
  mark: BRAND.mark,
  logo: BRAND.logo,
  logoLight: BRAND.logoLight,
  horizontal: BRAND.horizontal,
  horizontalLight: BRAND.horizontalLight,
};

/** LexKasa ürün markası (logo1 / horizontal / mark) — şirket logosu değil */
export function BrandImg({
  variant = "logo",
  className,
  alt = BRAND.name,
}: {
  variant?: Variant;
  className?: string;
  alt?: string;
}) {
  return (
    <img
      src={srcOf[variant]}
      alt={alt}
      className={cn("object-contain", className)}
      draggable={false}
    />
  );
}

/** Ayarlar’daki büro logosu (yoksa undefined) */
export function useFirmLogoUrl() {
  const { state } = useErp();
  const logo = state.settings.firm.logo;
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!logo) {
      setUrl(undefined);
      return;
    }
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

/** Sidebar üstü: büro logosu veya baş harfler */
export function FirmMark({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md";
}) {
  const { state } = useErp();
  const name = state.settings.firm.name || "Büro";
  const url = useFirmLogoUrl();
  const box = size === "sm" ? "h-8 w-8" : "h-9 w-9";
  if (url) {
    return (
      <img
        src={url}
        alt={name}
        className={cn(box, "shrink-0 rounded-xl object-contain bg-white/10", className)}
        draggable={false}
      />
    );
  }
  return (
    <span
      className={cn(
        box,
        "grid shrink-0 place-items-center rounded-xl bg-sidebar-primary/25 text-[11px] font-bold tracking-wide text-sidebar-primary-foreground",
        className,
      )}
      aria-hidden
    >
      {initials(name) || "B"}
    </span>
  );
}
