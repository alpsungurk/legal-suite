/**
 * UYAP "Duruşma Sorgulama" çıktısındaki "Taraf Bilgisi" hücresi:
 *   "BİRGÜL AKTAY - DAVACI HATİCE ATAYSİN - TANIK "
 * Ad ve rol " - " ile ayrılır; rolün hemen arkasından sonraki tarafın adı gelir.
 * Rol çok kelimeli olabilir (MÜŞTEKİ SANIK, MÜDAHİL DAVACI); bilinenler en uzun eşleşmeyle ayrılır.
 * Listede olmayan rolde ilk kelime rol sayılır ve "known: false" döner: aktarım ekranında uyarı
 * çıkar, büro hücreyi düzeltir (yoksa sonraki tarafın adı kayabilir).
 */

export type UyapParty = { name: string; role: string; known: boolean };

/** Büronun verdiği liste + UYAP'ta görülen diğer sıfatlar (kesme işareti farkı yok sayılır) */
const ROLES = [
  "DAVACI",
  "DAVALI",
  "TANIK",
  "MÜŞTEKİ",
  "SANIK",
  "MÜŞTEKİ SANIK",
  "KATILAN",
  "MÜŞTEKİ KATILAN",
  "MÜDAHİL DAVACI",
  "MÜDAHİL",
  "ŞÜPHELİ",
  "MAĞDUR",
  "MALEN SORUMLU",
  "VASİ",
  "VELİ",
  "DAHİLİ DAVALI",
  "DAHİLİ DAVACI",
  "FER'İ MÜDAHİL",
  "FERİ'İ MÜDAHİL",
  "KARŞI DAVALI",
  "KARŞI DAVACI",
  "KARŞI TARAF",
  "İHBAR OLUNAN",
  "SUÇTAN ZARAR GÖREN",
  "TALEP EDEN",
  "İTİRAZ EDEN",
  "İSTİNAF EDEN",
  "TEMYİZ EDEN",
  "MİRASÇI",
  "MÜTEVEFFA",
  "BİLİRKİŞİ",
  "ALACAKLI",
  "BORÇLU",
  "KAYYUM",
  "HASIM",
];

const squash = (s: string) => s.replace(/\s+/g, " ").trim();
/** Karşılaştırma için: büyük harf, kesme işaretleri yok ("FER'İ" = "FERİ") */
const roleWord = (w: string) => w.toLocaleUpperCase("tr").replace(/['’`´]/g, "");
const ROLE_KEYS = new Map(ROLES.map((r) => [r.split(" ").map(roleWord).join(" "), r]));
const MAX_ROLE_WORDS = Math.max(...ROLES.map((r) => r.split(" ").length));

/** "MÜŞTEKİ SANIK HATİCE ATAYSİN" → { role: "MÜŞTEKİ SANIK", rest: "HATİCE ATAYSİN", known } */
function splitRole(segment: string): { role: string; rest: string; known: boolean } {
  const words = squash(segment).split(" ").filter(Boolean);
  for (let n = Math.min(MAX_ROLE_WORDS, words.length); n >= 1; n--) {
    const role = ROLE_KEYS.get(words.slice(0, n).map(roleWord).join(" "));
    if (role) return { role, rest: words.slice(n).join(" "), known: true };
  }
  return { role: words[0] ?? "", rest: words.slice(1).join(" "), known: false };
}

export function parseUyapParties(cell: string): UyapParty[] {
  const parts = cell.split(/\s+-\s+/).map(squash);
  if (parts.length < 2) return [];
  const out: UyapParty[] = [];
  let name = parts[0];
  for (let i = 1; i < parts.length; i++) {
    const { role, rest, known } = splitRole(parts[i]);
    if (name && role) out.push({ name, role, known });
    name = rest;
  }
  return out;
}

/** UYAP "Dosya Türü" talimat dosyası mı ("Talimat Dosyası") */
export const isTalimatFile = (fileType?: string) => /talimat/i.test(fileType ?? "");

/** Talimat dosyasında işlem adı: "Duruşma" → "Talimat duruşması", "Keşif" → "Keşif (talimat)" */
export function talimatActivity(activity: string) {
  const a = activity.trim() || "Duruşma";
  if (/talimat/i.test(a)) return a;
  return a.toLocaleLowerCase("tr") === "duruşma" ? "Talimat duruşması" : `${a} (talimat)`;
}

/** "DAHİLİ DAVALI" → "Dahili davalı" */
export function roleLabel(role: string) {
  const low = role.toLocaleLowerCase("tr");
  return low.charAt(0).toLocaleUpperCase("tr") + low.slice(1);
}

/**
 * Ad karşılaştırma anahtarı: büyük/küçük harf, noktalama ve şirket eki yazımı farkı yok sayılır
 * ("ANONİM ŞİRKETİ" = "A.Ş.", "SANAYİ VE TİCARET" = "San. ve Tic.").
 */
export function partyKey(name: string) {
  return name
    .toLocaleLowerCase("tr")
    .replace(/anonim\s+şirketi/g, "aş")
    .replace(/limited\s+şirketi/g, "ltdşti")
    .replace(/\bsanayi(i)?\b/g, "san")
    .replace(/\bticaret\b/g, "tic")
    .replace(/\blimited\b/g, "ltd")
    .replace(/[^0-9a-zçğıöşü]/g, "");
}

/**
 * Taraflardan büronun müvekkili olanlar. Kişilerde ad tam eşleşmeli; şirketlerde kısa yazılmış
 * ünvan da tutar (müvekkil "Metaloks Metal" ↔ UYAP "METALOKS METAL SANAYİ VE TİCARET A.Ş.").
 * Müvekkil dosyada birden çok sıfatla geçiyorsa hepsi yazılır ("Davacı / Tanık").
 */
export function matchClients<C extends { id: string; name: string; kind?: string }>(
  parties: UyapParty[],
  clients: C[],
): Array<{ client: C; role: string }> {
  const keyed = clients.map((c) => ({ c, k: partyKey(c.name) })).filter((x) => x.k.length >= 3);
  const out: Array<{ client: C; roles: string[] }> = [];
  for (const p of parties) {
    const pk = partyKey(p.name);
    if (!pk) continue;
    const hit =
      keyed.find((x) => x.k === pk) ??
      keyed.find(
        (x) =>
          x.c.kind === "Kurumsal" && x.k.length >= 8 && (pk.startsWith(x.k) || x.k.startsWith(pk)),
      );
    if (!hit) continue;
    const seen = out.find((o) => o.client.id === hit.c.id);
    if (!seen) out.push({ client: hit.c, roles: [p.role] });
    else if (!seen.roles.includes(p.role)) seen.roles.push(p.role);
  }
  return out.map((o) => ({ client: o.client, role: o.roles.join(" / ") }));
}

/** Eşleşen müvekkiller sıfatlarıyla: "Birgül Aktay (Davacı), Metaloks A.Ş. (Davalı)" */
export function clientPartiesText(matches: Array<{ client: { name: string }; role: string }>) {
  return matches.map((m) => `${m.client.name} (${roleLabel(m.role)})`).join(", ");
}
