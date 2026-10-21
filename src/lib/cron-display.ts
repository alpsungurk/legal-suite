/** Sabit cron işlerinin TR dilinde okunabilir özeti */

export const CRON_META: Record<string, { label: string; hint: string }> = {
  "lexkasa-aylik-ucret": {
    label: "Aylık ücret",
    hint: "Aylık ücretli müvekkiller için tahsilat planı kontrol edilir",
  },
  "lexkasa-bildirimler": {
    label: "Bildirimler",
    hint: "Geciken taksit, ajanda ve ödeme sözü kontrol edilir",
  },
  "lexkasa-saklama": {
    label: "Saklama / arşiv",
    hint: "Eski bildirimler temizlenir; ayarlıysa otomatik arşiv çalışır",
  },
  "lexkasa-haciz": {
    label: "İcra süreleri ve haciz",
    hint: "Kesinleştirme / tahliye, 89/2–89/3, banka haczi kesinleşme, işveren borçlu ekleme günleri ve haczin düşmesine yaklaşan dosyalar sorumlularına bildirilir",
  },
  "lexkasa-kapali-dosya": {
    label: "Kapalı dosya silme",
    hint: "Ayın başında saklama süresi dolan kapalı dava dosyaları silinir; müvekkilde toplamlar kalır",
  },
  "lexkasa-keepalive": {
    label: "Uyanık tut",
    hint: "Proje uykuya girmesin diye küçük bir ping atılır (veri yazılmaz)",
  },
};

const DOW_TR = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** UTC cron → Türkçe açıklama (Europe/Istanbul ≈ UTC+3) */
export function describeCronTr(schedule: string): string {
  const parts = schedule.trim().split(/\s+/);
  if (parts.length !== 5) return schedule;
  const [minS, hourS, dom, , dow] = parts;
  const m = Number(minS);
  const uh = Number(hourS);
  if (!Number.isFinite(m) || !Number.isFinite(uh)) return schedule;

  let h = uh + 3;
  let dayShift = 0;
  if (h >= 24) {
    h -= 24;
    dayShift = 1;
  }
  const time = `${pad(h)}:${pad(m)}`;

  if (dom === "*/5" && dow === "*") return `Yaklaşık 5 günde bir, saat ${time}`;
  if (/^\d+$/.test(dom) && dow === "*") {
    let day = Number(dom);
    if (dayShift === 1) day += 1; // UTC → TR gün kayması
    return `Her ayın ${day}. günü saat ${time}`;
  }
  if (dom === "*" && dow === "*") return `Her gün saat ${time}`;

  let d = Number(dow);
  if (!Number.isFinite(d)) return `Saat ${time} (${schedule})`;
  if (dayShift === 1) d = (d + 1) % 7;
  return `Her ${DOW_TR[d] ?? "hafta"} saat ${time}`;
}
