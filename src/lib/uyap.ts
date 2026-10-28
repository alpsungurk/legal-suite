/**
 * UYAP "Duruşma Sorgulama" çıktısındaki "Taraf Bilgisi" hücresi:
 *   "BİRGÜL AKTAY - DAVACI HATİCE ATAYSİN - TANIK "
 * Ad ve rol " - " ile ayrılır; rolün hemen arkasından sonraki tarafın adı gelir.
 * Rol çok kelimeli olabilir (İHBAR OLUNAN, DAHİLİ DAVALI); bilinenler en uzun eşleşmeyle ayrılır,
 * bilinmeyen rolde ilk kelime rol sayılır.
 */

export type UyapParty = { name: string; role: string };

const ROLES = [
  "DAHİLİ DAVALI",
  "DAHİLİ DAVACI",
  "KARŞI DAVALI",
  "KARŞI DAVACI",
  "İHBAR OLUNAN",
  "FER'İ MÜDAHİL",
  "FERİ MÜDAHİL",
  "SUÇTAN ZARAR GÖREN",
  "KARŞI TARAF",
  "TALEP EDEN",
  "İTİRAZ EDEN",
  "İSTİNAF EDEN",
  "TEMYİZ EDEN",
  "DAVACI",
  "DAVALI",
  "KATILAN",
  "SANIK",
  "ŞÜPHELİ",
  "MÜŞTEKİ",
  "MAĞDUR",
  "TANIK",
  "MİRASÇI",
  "MÜTEVEFFA",
  "MÜDAHİL",
  "BİLİRKİŞİ",
  "ALACAKLI",
  "BORÇLU",
  "KAYYUM",
  "VASİ",
  "HASIM",
];

const squash = (s: string) => s.replace(/\s+/g, " ").trim();

/** "DAVACI HATİCE ATAYSİN" → { role: "DAVACI", rest: "HATİCE ATAYSİN" } */
function splitRole(segment: string): { role: string; rest: string } {
  const s = squash(segment);
  const up = s.toLocaleUpperCase("tr");
  const known = ROLES.find((r) => up === r || up.startsWith(r + " "));
  if (known) return { role: known, rest: s.slice(known.length).trim() };
  const i = s.indexOf(" ");
  return i < 0 ? { role: s, rest: "" } : { role: s.slice(0, i), rest: s.slice(i + 1).trim() };
}

export function parseUyapParties(cell: string): UyapParty[] {
  const parts = cell.split(/\s+-\s+/).map(squash);
  if (parts.length < 2) return [];
  const out: UyapParty[] = [];
  let name = parts[0];
  for (let i = 1; i < parts.length; i++) {
    const { role, rest } = splitRole(parts[i]);
    if (name && role) out.push({ name, role });
    name = rest;
  }
  return out;
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
 */
export function matchClients<C extends { id: string; name: string; kind?: string }>(
  parties: UyapParty[],
  clients: C[],
): Array<{ client: C; role: string }> {
  const keyed = clients.map((c) => ({ c, k: partyKey(c.name) })).filter((x) => x.k.length >= 3);
  const out: Array<{ client: C; role: string }> = [];
  for (const p of parties) {
    const pk = partyKey(p.name);
    if (!pk) continue;
    const hit =
      keyed.find((x) => x.k === pk) ??
      keyed.find(
        (x) =>
          x.c.kind === "Kurumsal" &&
          x.k.length >= 8 &&
          (pk.startsWith(x.k) || x.k.startsWith(pk)),
      );
    if (hit && !out.some((o) => o.client.id === hit.c.id)) out.push({ client: hit.c, role: p.role });
  }
  return out;
}
