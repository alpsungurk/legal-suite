export const lawyers = [
  { id: "usr-ahmet", name: "Av. Ahmet Yılmaz", role: "Admin", email: "ahmet@lexyonetim.com" },
  { id: "usr-selin", name: "Av. Selin Aras", role: "Avukat", email: "selin@lexyonetim.com" },
  { id: "usr-buse", name: "Av. Buse Eren", role: "Avukat", email: "buse@lexyonetim.com" },
  { id: "usr-cem", name: "Cem Akın", role: "Stajyer", email: "cem@lexyonetim.com" },
];

export const clients = [
  {
    id: "cli-ayse",
    name: "Ayşe Demir",
    kind: "Bireysel",
    email: "ayse.demir@email.com",
    phone: "0532 448 21 65",
    activeCases: 2,
  },
  {
    id: "cli-kaya",
    name: "Kaya Holding A.Ş.",
    kind: "Kurumsal",
    email: "finans@kayaholding.com",
    phone: "0212 444 07 21",
    activeCases: 7,
  },
  {
    id: "cli-mehmet",
    name: "Mehmet Kaya",
    kind: "Bireysel",
    email: "mehmet.kaya@email.com",
    phone: "0535 217 09 40",
    activeCases: 1,
  },
  {
    id: "cli-selma",
    name: "Selma Arı",
    kind: "Bireysel",
    email: "selma.ari@email.com",
    phone: "0532 782 16 00",
    activeCases: 1,
  },
  {
    id: "cli-fatma",
    name: "Fatma Öz",
    kind: "Bireysel",
    email: "fatma.oz@email.com",
    phone: "0536 104 38 18",
    activeCases: 1,
  },
];

export const cases = [
  {
    id: "case-128",
    no: "2026/128",
    title: "Alacak davası",
    clientId: "cli-ayse",
    court: "İstanbul 3. Asliye Hukuk",
    type: "Dava",
    responsibleId: "usr-ahmet",
    stage: "Tebligat",
    openingDate: "2026-07-08",
  },
  {
    id: "case-127",
    no: "2026/127",
    title: "İş sözleşmesi feshi",
    clientId: "cli-mehmet",
    court: "İstanbul 12. İş Mahkemesi",
    type: "Dava",
    responsibleId: "usr-selin",
    stage: "Ön inceleme",
    openingDate: "2026-07-04",
  },
  {
    id: "case-126",
    no: "2026/126",
    title: "Tazminat",
    clientId: "cli-kaya",
    court: "İstanbul BAM",
    type: "Dava",
    responsibleId: "usr-ahmet",
    stage: "Delil toplama",
    openingDate: "2026-06-28",
  },
  {
    id: "case-125",
    no: "2026/125",
    title: "Kira uyuşmazlığı",
    clientId: "cli-selma",
    court: "İstanbul Sulh Hukuk",
    type: "Arabuluculuk",
    responsibleId: "usr-buse",
    stage: "Duruşma",
    openingDate: "2026-06-20",
  },
  {
    id: "case-117",
    no: "2026/117",
    title: "İşçilik alacağı",
    clientId: "cli-mehmet",
    court: "İstanbul 5. İş Mahkemesi",
    type: "Dava",
    responsibleId: "usr-selin",
    stage: "Tebligat",
    openingDate: "2026-05-18",
  },
  {
    id: "case-109",
    no: "2026/109",
    title: "Ticari uyuşmazlık",
    clientId: "cli-kaya",
    court: "İstanbul 2. Asliye Ticaret",
    type: "Dava",
    responsibleId: "usr-ahmet",
    stage: "Duruşma",
    openingDate: "2026-04-09",
  },
  {
    id: "case-098",
    no: "2026/098",
    title: "Kira uyuşmazlığı",
    clientId: "cli-fatma",
    court: "İstanbul Sulh Hukuk",
    type: "Arabuluculuk",
    responsibleId: "usr-buse",
    stage: "Tebligat",
    openingDate: "2026-03-21",
  },
];

export const expenses = [
  {
    id: "exp-117-harc",
    title: "Harç ödemesi",
    caseId: "case-117",
    amount: 1850,
    date: "28 Temmuz 2026",
    payer: "Büro",
    type: "Harç",
    status: "Belgelendi",
  },
  {
    id: "exp-126-bilirkisi",
    title: "Bilirkişi ücreti",
    caseId: "case-126",
    amount: 6200,
    date: "27 Temmuz 2026",
    payer: "Müvekkil",
    type: "Bilirkişi",
    status: "Onay bekliyor",
  },
  {
    id: "exp-128-tebligat",
    title: "Tebligat gideri",
    caseId: "case-128",
    amount: 380,
    date: "26 Temmuz 2026",
    payer: "Büro",
    type: "Tebligat",
    status: "Belgelendi",
  },
];

export const payments = [
  {
    id: "pay-109",
    caseId: "case-109",
    amount: 62000,
    date: "28 Temmuz 2026",
    type: "Havale",
    description: "Vekalet ücreti",
    status: "Tamamlandı",
  },
  {
    id: "pay-128",
    caseId: "case-128",
    amount: 24500,
    date: "28 Temmuz 2026",
    type: "Kredi Kartı",
    description: "Avans",
    status: "Tamamlandı",
  },
  {
    id: "pay-125",
    caseId: "case-125",
    amount: 6500,
    date: "27 Temmuz 2026",
    type: "EFT",
    description: "Dava masrafı",
    status: "Beklemede",
  },
];

export const documents = [
  {
    id: "doc-128",
    name: "Dava_Dilekçesi_v3.pdf",
    caseId: "case-128",
    type: "PDF",
    size: "2,4 MB",
    date: "28 Temmuz 2026",
    status: "İmzalandı",
  },
  {
    id: "doc-126",
    name: "Bilirkişi_Raporu.pdf",
    caseId: "case-126",
    type: "PDF",
    size: "5,8 MB",
    date: "27 Temmuz 2026",
    status: "İnceleniyor",
  },
  {
    id: "doc-117",
    name: "Vekaletname.docx",
    caseId: "case-117",
    type: "DOCX",
    size: "184 KB",
    date: "25 Temmuz 2026",
    status: "Taslak",
  },
];

export const findClient = (id: string) => clients.find((client) => client.id === id)!;
export const findCase = (id: string) => cases.find((item) => item.id === id)!;
export const findLawyer = (id: string) => lawyers.find((lawyer) => lawyer.id === id)!;
export const caseOption = (item: (typeof cases)[number]) => `${item.no} • ${item.title}`;
export const clientOptions = clients.map((client) => client.name);
export const caseOptions = cases.map(caseOption);
export const lawyerOptions = lawyers.map((lawyer) => lawyer.name);
