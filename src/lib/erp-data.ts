import type { CaseFile, Client, Expense, Payment, Reminder, User } from "@/lib/erp-types";
import {
  DEFAULT_CASE_TYPES,
  DEFAULT_EXPENSE_TYPES,
  DEFAULT_REMINDER_TYPES,
  type ErpState,
} from "@/lib/erp-types";

export const lawyers: User[] = [
  {
    id: "usr-ahmet",
    name: "Av. Ahmet Yılmaz",
    role: "Admin",
    email: "admin@lexyonetim.com",
    username: "admin",
  },
  {
    id: "usr-selin",
    name: "Av. Selin Aras",
    role: "Avukat",
    email: "avukat@lexyonetim.com",
    username: "avukat",
  },
  {
    id: "usr-buse",
    name: "Av. Buse Eren",
    role: "Avukat",
    email: "avukat2@lexyonetim.com",
    username: "avukat2",
  },
  {
    id: "usr-cem",
    name: "Cem Akın",
    role: "Stajyer",
    email: "stajyer@lexyonetim.com",
    username: "stajyer",
  },
  {
    id: "usr-deniz",
    name: "Deniz Yılmaz",
    role: "Stajyer",
    email: "stajyer2@lexyonetim.com",
    username: "stajyer2",
  },
];

/** Demo giriş şifresi — tüm hesaplar için aynı */
export const DEMO_PASSWORD = "123456";

export const clients: Client[] = [
  {
    id: "cli-ayse",
    name: "Ayşe Demir",
    kind: "Bireysel",
    email: "ayse.demir@email.com",
    phone: "0532 448 21 65",
    status: "Aktif",
  },
  {
    id: "cli-kaya",
    name: "Kaya Holding A.Ş.",
    kind: "Kurumsal",
    email: "finans@kayaholding.com",
    phone: "0212 444 07 21",
    status: "Aktif",
  },
  {
    id: "cli-mehmet",
    name: "Mehmet Kaya",
    kind: "Bireysel",
    email: "mehmet.kaya@email.com",
    phone: "0535 217 09 40",
    status: "Aktif",
  },
  {
    id: "cli-selma",
    name: "Selma Arı",
    kind: "Bireysel",
    email: "selma.ari@email.com",
    phone: "0532 782 16 00",
    status: "Pasif",
  },
  {
    id: "cli-fatma",
    name: "Fatma Öz",
    kind: "Bireysel",
    email: "fatma.oz@email.com",
    phone: "0536 104 38 18",
    status: "Aktif",
  },
];

export const cases: CaseFile[] = [
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
    stage: "Karar",
    openingDate: "2026-03-21",
  },
];

export const expenses: Expense[] = [
  {
    id: "exp-117-harc",
    title: "Harç ödemesi",
    caseId: "case-117",
    amount: 1850,
    date: "2026-07-28",
    payer: "Büro",
    type: "Harç",
    status: "Belgelendi",
  },
  {
    id: "exp-126-bilirkisi",
    title: "Bilirkişi ücreti",
    caseId: "case-126",
    amount: 6200,
    date: "2026-07-27",
    payer: "Müvekkil",
    type: "Bilirkişi",
    status: "Onay bekliyor",
  },
  {
    id: "exp-128-tebligat",
    title: "Tebligat gideri",
    caseId: "case-128",
    amount: 380,
    date: "2026-07-26",
    payer: "Büro",
    type: "Tebligat",
    status: "Belgelendi",
  },
];

export const payments: Payment[] = [
  {
    id: "pay-109",
    caseId: "case-109",
    amount: 62000,
    date: "2026-07-28",
    type: "Havale",
    description: "Vekalet ücreti",
    status: "Tamamlandı",
  },
  {
    id: "pay-128",
    caseId: "case-128",
    amount: 24500,
    date: "2026-07-28",
    type: "Kredi Kartı",
    description: "Avans",
    status: "Tamamlandı",
  },
  {
    id: "pay-125",
    caseId: "case-125",
    amount: 6500,
    date: "2026-07-27",
    type: "EFT",
    description: "Dava masrafı",
    status: "Beklemede",
  },
];

export const reminders: Reminder[] = [
  {
    id: "rem-1",
    title: "İstanbul 3. Asliye Hukuk – Duruşma",
    caseId: "case-128",
    clientId: "cli-ayse",
    assigneeId: "usr-ahmet",
    date: "2026-07-29",
    type: "Duruşma",
    status: "Beklemede",
  },
  {
    id: "rem-2",
    title: "Sözleşme toplantısı",
    caseId: "case-109",
    clientId: "cli-kaya",
    assigneeId: "usr-selin",
    date: "2026-07-30",
    type: "Toplantı",
    status: "Beklemede",
  },
  {
    id: "rem-3",
    title: "Tahsilat hatırlatması",
    caseId: "case-128",
    clientId: "cli-ayse",
    assigneeId: "usr-ahmet",
    date: "2026-07-31",
    type: "Tahsilat",
    status: "Beklemede",
  },
  {
    id: "rem-4",
    title: "Bilirkişi raporu teslimi",
    caseId: "case-126",
    clientId: "cli-kaya",
    assigneeId: "usr-buse",
    date: "2026-08-04",
    type: "Evrak teslimi",
    status: "Beklemede",
  },
];

export function createSeedState(): ErpState {
  return {
    users: lawyers,
    clients,
    cases,
    expenses,
    payments,
    reminders,
    notifications: [
      {
        id: "ntf-1",
        userId: "usr-ahmet",
        title: "Yeni tahsilat alındı",
        detail: "Kaya Holding A.Ş. • 2026/109 • ₺62.000",
        type: "Tahsilat",
        createdAt: new Date().toISOString(),
        read: false,
      },
      {
        id: "ntf-2",
        userId: "usr-ahmet",
        title: "Duruşma yaklaşıyor",
        detail: "İstanbul 3. Asliye Hukuk • 2026/128",
        type: "Önemli",
        createdAt: new Date().toISOString(),
        read: false,
      },
      {
        id: "ntf-3",
        userId: "usr-selin",
        title: "Masraf eklendi",
        detail: "2026/117 dosyasına harç kaydedildi",
        type: "Masraf",
        createdAt: new Date().toISOString(),
        read: false,
      },
    ],
    activities: [
      {
        id: "act-1",
        actorId: "usr-ahmet",
        action: "Tahsilat eklendi",
        entity: "Tahsilat",
        detail: "2026/109 • Kaya Holding A.Ş.",
        timestamp: "2026-07-28T10:22:00",
        amount: "₺62.000",
      },
      {
        id: "act-2",
        actorId: "usr-selin",
        action: "Dosya durumu güncellendi",
        entity: "Dosya",
        detail: "2026/127 • Ön inceleme",
        timestamp: "2026-07-27T18:40:00",
      },
    ],
    caseTypes: [...DEFAULT_CASE_TYPES],
    expenseTypes: [...DEFAULT_EXPENSE_TYPES],
    reminderTypes: [...DEFAULT_REMINDER_TYPES],
    currentUserId: "usr-ahmet",
  };
}

export const findClient = (id: string) => clients.find((client) => client.id === id)!;
export const findCase = (id: string) => cases.find((item) => item.id === id)!;
export const findLawyer = (id: string) => lawyers.find((lawyer) => lawyer.id === id)!;
export const caseOption = (item: CaseFile) => `${item.no} • ${item.title}`;
export const clientOptions = clients.map((client) => client.name);
export const caseOptions = cases.map(caseOption);
export const lawyerOptions = lawyers.map((lawyer) => lawyer.name);
