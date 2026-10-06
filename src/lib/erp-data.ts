/**
 * Demo verisi. Tarihler bugüne göre hesaplanır; böylece demo her açıldığında
 * yaklaşan duruşmalar, geciken taksitler vb. canlı görünür.
 */
import {
  DEFAULT_CASE_TYPES,
  DEFAULT_DOCUMENT_CATEGORIES,
  DEFAULT_EXPENSE_TYPES,
  DEFAULT_REMINDER_TYPES,
  STATE_VERSION,
  type Account,
  type AccountTx,
  type ActivityLog,
  type Advance,
  type AppNotification,
  type CaseFile,
  type Client,
  type Collection,
  type ContactLog,
  type Debtor,
  type DocumentRequest,
  type EnforcementFile,
  type ErpState,
  type Expense,
  type FeePlan,
  type Installment,
  type Message,
  type PaymentPromise,
  type Reminder,
  type Settings,
  type User,
} from "@/lib/erp-types";
import { addDays, addMonths, splitAmount, today } from "@/lib/format";

export const FIRM_ID = "firm-main";

/** Demo hesapların şifresi: 123456 */
export const DEMO_PASSWORD = "123456";
const SEED_SALT = "lexseed0000000000000000000000001";
const SEED_HASH = "7e8a30ccccd27dc77394c5edd467ab138148581f5e84b5a22e355825628e183e";

export const DEMO_ACCOUNTS = [
  { username: "admin", label: "Admin" },
  { username: "avukat", label: "Avukat" },
  { username: "sekreter", label: "Sekreter" },
  { username: "muvekkil", label: "Müvekkil portalı" },
];

export function defaultSettings(): Settings {
  return {
    firm: {
      name: "Lex Hukuk Bürosu",
      legalName: "Av. Ahmet Yılmaz Hukuk Bürosu",
      address: "Halaskargazi Cad. No:120 Kat:4, Şişli / İstanbul",
      phone: "0212 555 40 40",
      email: "info@lexhukuk.com",
      taxOffice: "Şişli",
      taxNo: "1234567890",
      bankName: "Türkiye İş Bankası",
      iban: "TR120006400000112345678901",
      statementNote:
        "Ekstrede yer alan bakiyeye itirazınızı 7 gün içinde büromuza bildirmenizi rica ederiz.",
    },
    caseTypes: [...DEFAULT_CASE_TYPES],
    expenseTypes: [...DEFAULT_EXPENSE_TYPES],
    reminderTypes: [...DEFAULT_REMINDER_TYPES],
    documentCategories: [...DEFAULT_DOCUMENT_CATEGORIES],
  };
}

export function emptyState(): ErpState {
  return {
    version: STATE_VERSION,
    firmId: FIRM_ID,
    settings: defaultSettings(),
    users: [],
    clients: [],
    cases: [],
    expenses: [],
    advances: [],
    plans: [],
    accounts: [],
    transactions: [],
    reminders: [],
    debtors: [],
    enforcements: [],
    promises: [],
    collections: [],
    contacts: [],
    documents: [],
    docRequests: [],
    messages: [],
    notifications: [],
    activities: [],
  };
}

export function createSeedState(): ErpState {
  const t = today();
  const d = (n: number) => addDays(t, n);
  const stamp = new Date().toISOString();
  const base = { firmId: FIRM_ID, createdAt: stamp, updatedAt: stamp };
  const ago = (n: number) => new Date(Date.now() - n * 60_000).toISOString();

  const user = (
    u: Omit<User, keyof typeof base | "passwordHash" | "passwordSalt" | "active">,
  ): User => ({
    ...base,
    ...u,
    active: true,
    passwordHash: SEED_HASH,
    passwordSalt: SEED_SALT,
  });

  const users: User[] = [
    user({
      id: "usr-ahmet",
      name: "Av. Ahmet Yılmaz",
      role: "Admin",
      email: "ahmet@lexhukuk.com",
      username: "admin",
      title: "Kurucu Ortak",
      phone: "0532 100 10 10",
    }),
    user({
      id: "usr-selin",
      name: "Av. Selin Aras",
      role: "Avukat",
      email: "selin@lexhukuk.com",
      username: "avukat",
      title: "Kıdemli Avukat",
      phone: "0533 200 20 20",
    }),
    user({
      id: "usr-buse",
      name: "Av. Buse Eren",
      role: "Avukat",
      email: "buse@lexhukuk.com",
      username: "avukat2",
      title: "Avukat",
    }),
    user({
      id: "usr-leyla",
      name: "Leyla Demir",
      role: "Sekreter",
      email: "leyla@lexhukuk.com",
      username: "sekreter",
      title: "Büro Sorumlusu",
    }),
    user({
      id: "usr-portal-ayse",
      name: "Ayşe Demir",
      role: "Müvekkil",
      email: "ayse.demir@email.com",
      username: "muvekkil",
      clientId: "cli-ayse",
    }),
  ];

  const client = (
    c: Omit<Client, keyof typeof base | "portalEnabled" | "portalShowStatement"> &
      Partial<Pick<Client, "portalEnabled" | "portalShowStatement">>,
  ): Client => ({
    ...base,
    portalEnabled: false,
    portalShowStatement: true,
    ...c,
  });

  const clients: Client[] = [
    client({
      id: "cli-ayse",
      name: "Ayşe Demir",
      kind: "Bireysel",
      email: "ayse.demir@email.com",
      phone: "0532 448 21 65",
      status: "Aktif",
      identity: "12345678901",
      address: "Kadıköy / İstanbul",
      advanceThreshold: 1000,
      portalEnabled: true,
    }),
    client({
      id: "cli-kaya",
      name: "Kaya Holding A.Ş.",
      kind: "Kurumsal",
      email: "finans@kayaholding.com",
      phone: "0212 444 07 21",
      status: "Aktif",
      identity: "4810012345",
      taxOffice: "Büyük Mükellefler",
      address: "Levent / İstanbul",
      monthlyFee: 25000,
      monthlyFeeStartDate: addMonths(t, -3).slice(0, 8) + "01",
      advanceThreshold: 5000,
    }),
    client({
      id: "cli-mehmet",
      name: "Mehmet Kaya",
      kind: "Bireysel",
      email: "mehmet.kaya@email.com",
      phone: "0535 217 09 40",
      status: "Aktif",
      advanceThreshold: 1500,
    }),
    client({
      id: "cli-selma",
      name: "Selma Arı",
      kind: "Bireysel",
      email: "selma.ari@email.com",
      phone: "0532 782 16 00",
      status: "Pasif",
    }),
    client({
      id: "cli-fatma",
      name: "Fatma Öz",
      kind: "Bireysel",
      email: "fatma.oz@email.com",
      phone: "0536 104 38 18",
      status: "Aktif",
      advanceThreshold: 500,
    }),
    client({
      id: "cli-deniz",
      name: "Deniz Lojistik Ltd. Şti.",
      kind: "Kurumsal",
      email: "muhasebe@denizlojistik.com",
      phone: "0216 330 12 12",
      status: "Aktif",
      identity: "2950087412",
      taxOffice: "Kozyatağı",
      monthlyFee: 15000,
      monthlyFeeStartDate: addMonths(t, -2).slice(0, 8) + "01",
      advanceThreshold: 3000,
    }),
  ];

  const kase = (
    c: Omit<CaseFile, keyof typeof base | "portalVisible"> & { portalVisible?: boolean },
  ): CaseFile => ({
    ...base,
    portalVisible: true,
    ...c,
  });

  const cases: CaseFile[] = [
    kase({
      id: "case-128",
      no: "2026/128",
      title: "Alacak davası",
      clientId: "cli-ayse",
      court: "İstanbul 3. Asliye Hukuk",
      esasNo: "2026/412 E.",
      type: "Dava",
      status: "Derdest",
      responsibleIds: ["usr-selin"],
      opposingParty: "Yıldız İnşaat A.Ş.",
      openingDate: d(-90),
      agreedFee: 40000,
    }),
    kase({
      id: "case-127",
      no: "2026/127",
      title: "İş sözleşmesi feshi",
      clientId: "cli-mehmet",
      court: "İstanbul 12. İş Mahkemesi",
      esasNo: "2026/1180 E.",
      type: "Dava",
      status: "Derdest",
      responsibleIds: ["usr-buse"],
      opposingParty: "Atlas Tekstil",
      openingDate: d(-95),
      agreedFee: 30000,
    }),
    kase({
      id: "case-126",
      no: "2026/126",
      title: "Tazminat",
      clientId: "cli-kaya",
      court: "İstanbul BAM 5. HD",
      type: "Dava",
      status: "Kanun yolu",
      responsibleIds: ["usr-ahmet", "usr-selin"],
      opposingParty: "Mavi Enerji A.Ş.",
      openingDate: d(-110),
    }),
    kase({
      id: "case-125",
      no: "2026/125",
      title: "Kira uyuşmazlığı",
      clientId: "cli-selma",
      court: "İstanbul 4. Sulh Hukuk",
      type: "Arabuluculuk",
      status: "Kapalı",
      responsibleIds: ["usr-buse"],
      openingDate: d(-120),
      closingDate: d(-30),
    }),
    kase({
      id: "case-117",
      no: "2026/117",
      title: "İşçilik alacağı",
      clientId: "cli-mehmet",
      court: "İstanbul 5. İş Mahkemesi",
      type: "Dava",
      status: "Karar",
      responsibleIds: ["usr-selin"],
      openingDate: d(-150),
    }),
    kase({
      id: "case-109",
      no: "2026/109",
      title: "Ticari uyuşmazlık",
      clientId: "cli-kaya",
      court: "İstanbul 2. Asliye Ticaret",
      esasNo: "2026/88 E.",
      type: "Dava",
      status: "Derdest",
      responsibleIds: ["usr-ahmet"],
      opposingParty: "Ege Gıda Ltd.",
      openingDate: d(-170),
      agreedFee: 120000,
    }),
    kase({
      id: "case-098",
      no: "2026/098",
      title: "Kira tespit",
      clientId: "cli-fatma",
      court: "İstanbul 1. Sulh Hukuk",
      type: "Dava",
      status: "Derdest",
      responsibleIds: ["usr-buse"],
      openingDate: d(-200),
    }),
    kase({
      id: "case-131",
      no: "2026/131",
      title: "Sözleşme danışmanlığı",
      clientId: "cli-deniz",
      type: "Danışmanlık",
      status: "Açık",
      responsibleIds: ["usr-selin"],
      openingDate: d(-20),
    }),
  ];

  const accounts: Account[] = [
    {
      ...base,
      id: "acc-kasa",
      name: "Büro Kasası",
      type: "Kasa",
      openingBalance: 15000,
      openingDate: d(-200),
      active: true,
    },
    {
      ...base,
      id: "acc-isbank",
      name: "İş Bankası Ticari",
      type: "Banka",
      bankName: "Türkiye İş Bankası",
      iban: "TR120006400000112345678901",
      openingBalance: 185000,
      openingDate: d(-200),
      active: true,
    },
    {
      ...base,
      id: "acc-garanti",
      name: "Garanti Masraf Hesabı",
      type: "Banka",
      bankName: "Garanti BBVA",
      iban: "TR330006200011100006298765",
      openingBalance: 40000,
      openingDate: d(-200),
      active: true,
    },
  ];

  const advance = (a: Omit<Advance, keyof typeof base>): Advance => ({ ...base, ...a });
  const advances: Advance[] = [
    advance({
      id: "adv-1",
      kind: "Avans",
      clientId: "cli-ayse",
      caseId: "case-128",
      amount: 8000,
      date: d(-85),
      method: "Havale/EFT",
      accountId: "acc-garanti",
      note: "Dava açılış avansı",
    }),
    advance({
      id: "adv-2",
      kind: "Avans",
      clientId: "cli-mehmet",
      caseId: "case-127",
      amount: 4000,
      date: d(-90),
      method: "Nakit",
      accountId: "acc-kasa",
    }),
    advance({
      id: "adv-3",
      kind: "Avans",
      clientId: "cli-kaya",
      amount: 25000,
      date: d(-100),
      method: "Havale/EFT",
      accountId: "acc-garanti",
      note: "Genel masraf avansı",
    }),
    advance({
      id: "adv-4",
      kind: "Avans",
      clientId: "cli-fatma",
      caseId: "case-098",
      amount: 3000,
      date: d(-60),
      method: "Havale/EFT",
      accountId: "acc-garanti",
    }),
    advance({
      id: "adv-5",
      kind: "Avans",
      clientId: "cli-deniz",
      amount: 10000,
      date: d(-15),
      method: "Havale/EFT",
      accountId: "acc-garanti",
    }),
  ];

  const expense = (
    e: Omit<Expense, keyof typeof base | "receipts" | "createdBy"> & { createdBy?: string },
  ): Expense => ({
    ...base,
    receipts: [],
    createdBy: "usr-leyla",
    ...e,
  });
  const expenses: Expense[] = [
    expense({
      id: "exp-1",
      title: "Başvuru ve peşin harç",
      type: "Harç",
      amount: 2850,
      date: d(-84),
      caseId: "case-128",
      clientId: "cli-ayse",
      chargeTo: "Müvekkil",
      paidBy: "Büro",
      accountId: "acc-garanti",
    }),
    expense({
      id: "exp-2",
      title: "Tebligat gideri",
      type: "Tebligat",
      amount: 380,
      date: d(-60),
      caseId: "case-128",
      clientId: "cli-ayse",
      chargeTo: "Müvekkil",
      paidBy: "Büro",
      accountId: "acc-kasa",
      createdBy: "usr-selin",
    }),
    expense({
      id: "exp-3",
      title: "Bilirkişi ücreti",
      type: "Bilirkişi",
      amount: 2500,
      date: d(-12),
      caseId: "case-128",
      clientId: "cli-ayse",
      chargeTo: "Müvekkil",
      paidBy: "Büro",
      accountId: "acc-garanti",
    }),
    expense({
      id: "exp-4",
      title: "Mahkeme harcı",
      type: "Harç",
      amount: 1850,
      date: d(-88),
      caseId: "case-127",
      clientId: "cli-mehmet",
      chargeTo: "Müvekkil",
      paidBy: "Büro",
      accountId: "acc-kasa",
    }),
    expense({
      id: "exp-5",
      title: "Tanık tebligatları",
      type: "Tebligat",
      amount: 960,
      date: d(-40),
      caseId: "case-127",
      clientId: "cli-mehmet",
      chargeTo: "Müvekkil",
      paidBy: "Büro",
      accountId: "acc-kasa",
      createdBy: "usr-buse",
    }),
    expense({
      id: "exp-6",
      title: "Keşif harcı ve yol",
      type: "Keşif",
      amount: 3200,
      date: d(-5),
      caseId: "case-127",
      clientId: "cli-mehmet",
      chargeTo: "Müvekkil",
      paidBy: "Büro",
      accountId: "acc-garanti",
      createdBy: "usr-buse",
    }),
    expense({
      id: "exp-7",
      title: "Bilirkişi ücreti",
      type: "Bilirkişi",
      amount: 6200,
      date: d(-30),
      caseId: "case-126",
      clientId: "cli-kaya",
      chargeTo: "Müvekkil",
      paidBy: "Büro",
      accountId: "acc-garanti",
    }),
    expense({
      id: "exp-8",
      title: "İstinaf harcı",
      type: "Harç",
      amount: 4100,
      date: d(-20),
      caseId: "case-126",
      clientId: "cli-kaya",
      chargeTo: "Müvekkil",
      paidBy: "Büro",
      accountId: "acc-garanti",
    }),
    expense({
      id: "exp-9",
      title: "Noter onaylı vekaletname",
      type: "Noter",
      amount: 1450,
      date: d(-58),
      caseId: "case-098",
      clientId: "cli-fatma",
      chargeTo: "Müvekkil",
      paidBy: "Büro",
      accountId: "acc-kasa",
    }),
    expense({
      id: "exp-10",
      title: "Yol gideri",
      type: "Yol",
      amount: 640,
      date: d(-3),
      caseId: "case-098",
      clientId: "cli-fatma",
      chargeTo: "Müvekkil",
      paidBy: "Büro",
      accountId: "acc-kasa",
      createdBy: "usr-buse",
    }),
    expense({
      id: "exp-11",
      title: "Ofis kirası",
      type: "Ofis gideri",
      amount: 35000,
      date: d(-35),
      chargeTo: "Büro",
      paidBy: "Büro",
      accountId: "acc-isbank",
    }),
    expense({
      id: "exp-12",
      title: "Ofis kirası",
      type: "Ofis gideri",
      amount: 35000,
      date: d(-5),
      chargeTo: "Büro",
      paidBy: "Büro",
      accountId: "acc-isbank",
    }),
    expense({
      id: "exp-13",
      title: "Kırtasiye ve toner",
      type: "Fotokopi",
      amount: 1850,
      date: d(-18),
      chargeTo: "Büro",
      paidBy: "Büro",
      accountId: "acc-kasa",
    }),
    expense({
      id: "exp-14",
      title: "Kargo gönderimi",
      type: "Kargo",
      amount: 220,
      date: d(-2),
      caseId: "case-109",
      clientId: "cli-kaya",
      chargeTo: "Müvekkil",
      paidBy: "Müvekkil",
    }),
  ];

  let instSeq = 0;
  const inst = (
    dueDate: string,
    amount: number,
    paid?: {
      amount?: number;
      date: string;
      accountId?: string;
      method?: Installment["payments"][number]["method"];
    },
  ): Installment => ({
    id: `inst-seed-${++instSeq}`,
    dueDate,
    amount,
    payments: paid
      ? [
          {
            id: `ip-seed-${instSeq}`,
            date: paid.date,
            amount: paid.amount ?? amount,
            method: paid.method ?? "Havale/EFT",
            accountId: paid.accountId ?? "acc-isbank",
          },
        ]
      : [],
  });
  const plan = (p: Omit<FeePlan, keyof typeof base | "cancelled">): FeePlan => ({
    ...base,
    cancelled: false,
    ...p,
  });

  const [a1, a2, a3, a4] = splitAmount(40000, 4);
  const plans: FeePlan[] = [
    plan({
      id: "plan-128",
      title: "Vekalet ücreti · Alacak davası",
      kind: "Vekalet ücreti",
      clientId: "cli-ayse",
      caseId: "case-128",
      date: d(-90),
      total: 40000,
      installments: [
        inst(d(-90), a1, { date: d(-90) }),
        inst(d(-60), a2, { date: d(-58) }),
        inst(d(-30), a3, { amount: 4000, date: d(-25), method: "Nakit", accountId: "acc-kasa" }),
        inst(d(0), a4),
      ],
    }),
    plan({
      id: "plan-127",
      title: "Vekalet ücreti · İş davası",
      kind: "Vekalet ücreti",
      clientId: "cli-mehmet",
      caseId: "case-127",
      date: d(-95),
      total: 30000,
      installments: [
        inst(d(-95), 10000, { date: d(-95), method: "Nakit", accountId: "acc-kasa" }),
        inst(d(-35), 10000, { amount: 6000, date: d(-1), method: "Nakit", accountId: "acc-kasa" }),
        inst(d(25), 10000),
      ],
    }),
    plan({
      id: "plan-109",
      title: "Vekalet ücreti · Ticari uyuşmazlık",
      kind: "Vekalet ücreti",
      clientId: "cli-kaya",
      caseId: "case-109",
      date: d(-170),
      total: 120000,
      installments: [
        inst(d(-170), 60000, { date: d(-168) }),
        inst(d(-80), 30000, { date: d(-80) }),
        inst(d(10), 30000),
      ],
    }),
    plan({
      id: "plan-098",
      title: "Vekalet ücreti · Kira tespit",
      kind: "Vekalet ücreti",
      clientId: "cli-fatma",
      caseId: "case-098",
      date: d(-200),
      total: 18000,
      installments: [
        inst(d(-200), 6000, { date: d(-200) }),
        inst(d(-140), 6000, { date: d(-139) }),
        inst(d(-80), 6000, { amount: 2800, date: d(-70) }),
      ],
    }),
    plan({
      id: "plan-125",
      title: "Arabuluculuk ücreti",
      kind: "Vekalet ücreti",
      clientId: "cli-selma",
      caseId: "case-125",
      date: d(-120),
      total: 6500,
      installments: [
        inst(d(-120), 6500, { date: d(-118), method: "Nakit", accountId: "acc-kasa" }),
      ],
    }),
  ];
  // Aylık ücret tahakkukları
  for (const c of clients.filter((c) => c.monthlyFee && c.monthlyFeeStartDate)) {
    let period = c.monthlyFeeStartDate!.slice(0, 7);
    const current = t.slice(0, 7);
    let i = 0;
    while (period <= current) {
      const due = `${period}-05`;
      const isPaid =
        (period < current && !(c.id === "cli-deniz" && i === 1)) ||
        (period === current && c.id === "cli-kaya");
      plans.push(
        plan({
          id: `plan-fee-${c.id}-${period}`,
          title: `Aylık danışmanlık ücreti`,
          kind: "Aylık ücret",
          clientId: c.id,
          date: `${period}-01`,
          total: c.monthlyFee!,
          period,
          installments: [
            inst(
              due,
              c.monthlyFee!,
              isPaid ? { date: period === current ? t : addDays(due, 2) } : undefined,
            ),
          ],
        }),
      );
      period = addMonths(`${period}-01`, 1).slice(0, 7);
      i++;
    }
  }

  const transactions: AccountTx[] = [
    {
      ...base,
      id: "tx-1",
      accountId: "acc-isbank",
      date: d(-45),
      amount: -20000,
      category: "Virman",
      description: "Garanti masraf hesabına virman",
      transferId: "trf-1",
    },
    {
      ...base,
      id: "tx-2",
      accountId: "acc-garanti",
      date: d(-45),
      amount: 20000,
      category: "Virman",
      description: "İş Bankası'ndan virman",
      transferId: "trf-1",
    },
    {
      ...base,
      id: "tx-3",
      accountId: "acc-isbank",
      date: d(-10),
      amount: -4800,
      category: "Diğer gider",
      description: "Muhasebe hizmet bedeli",
    },
  ];

  const reminder = (
    r: Omit<Reminder, keyof typeof base | "portalVisible" | "status"> &
      Partial<Pick<Reminder, "portalVisible" | "status">>,
  ): Reminder => ({
    ...base,
    status: "Bekliyor",
    portalVisible: false,
    ...r,
  });
  const reminders: Reminder[] = [
    reminder({
      id: "rem-1",
      title: "Ön inceleme duruşması",
      type: "Duruşma",
      date: d(1),
      time: "10:30",
      location: "Çağlayan Adliyesi B Blok 7. kat",
      caseId: "case-128",
      clientId: "cli-ayse",
      assigneeId: "usr-selin",
      portalVisible: true,
    }),
    reminder({
      id: "rem-2",
      title: "Tanık listesi son gün",
      type: "Süre sonu",
      date: d(0),
      caseId: "case-127",
      clientId: "cli-mehmet",
      assigneeId: "usr-buse",
    }),
    reminder({
      id: "rem-3",
      title: "Bilirkişi raporuna itiraz",
      type: "Süre sonu",
      date: d(4),
      caseId: "case-128",
      assigneeId: "usr-selin",
    }),
    reminder({
      id: "rem-4",
      title: "Kaya Holding aylık toplantı",
      type: "Toplantı",
      date: d(2),
      time: "14:00",
      location: "Müvekkil ofisi",
      clientId: "cli-kaya",
      assigneeId: "usr-ahmet",
    }),
    reminder({
      id: "rem-5",
      title: "Keşif",
      type: "Keşif",
      date: d(6),
      time: "09:30",
      caseId: "case-098",
      clientId: "cli-fatma",
      assigneeId: "usr-buse",
      portalVisible: true,
    }),
    reminder({
      id: "rem-6",
      title: "İstinaf duruşması",
      type: "Duruşma",
      date: d(9),
      time: "11:00",
      caseId: "case-126",
      clientId: "cli-kaya",
      assigneeId: "usr-ahmet",
    }),
    reminder({
      id: "rem-7",
      title: "Mehmet Bey'i ara — ücret",
      type: "Müvekkili ara",
      date: d(-2),
      clientId: "cli-mehmet",
      assigneeId: "usr-leyla",
    }),
    reminder({
      id: "rem-8",
      title: "Cevap dilekçesi",
      type: "Evrak teslimi",
      date: d(12),
      caseId: "case-109",
      assigneeId: "usr-ahmet",
    }),
    reminder({
      id: "rem-9",
      title: "Delil listesi",
      type: "Evrak teslimi",
      date: d(-8),
      caseId: "case-128",
      assigneeId: "usr-selin",
      status: "Tamamlandı",
    }),
    reminder({
      id: "rem-10",
      title: "Duruşma",
      type: "Duruşma",
      date: d(15),
      time: "13:30",
      caseId: "case-127",
      clientId: "cli-mehmet",
      assigneeId: "usr-buse",
      portalVisible: true,
    }),
  ];

  const debtors: Debtor[] = [
    {
      ...base,
      id: "dbt-1",
      name: "Murat Çelik",
      kind: "Bireysel",
      identity: "23456789012",
      phone: "0541 222 33 44",
      address: "Bağcılar / İstanbul",
      assets: "34 ABC 123 plakalı araç; maaş haczi (Atlas Tekstil)",
    },
    {
      ...base,
      id: "dbt-2",
      name: "Ege Gıda Ltd. Şti.",
      kind: "Kurumsal",
      identity: "3330012345",
      phone: "0232 444 55 66",
      address: "Bornova / İzmir",
      assets: "Banka hesapları (Ziraat), depo stokları",
    },
    {
      ...base,
      id: "dbt-3",
      name: "Hasan Polat",
      kind: "Bireysel",
      phone: "0505 777 88 99",
      address: "Ümraniye / İstanbul",
    },
  ];
  const enforcements: EnforcementFile[] = [
    {
      ...base,
      id: "enf-1",
      no: "2026/4521 E.",
      office: "İstanbul 14. İcra Dairesi",
      type: "İlamsız",
      clientId: "cli-kaya",
      debtorIds: ["dbt-2"],
      principal: 180000,
      interest: 14200,
      costs: 3850,
      status: "Ödeme planı",
      openingDate: d(-75),
      responsibleIds: ["usr-ahmet"],
      caseId: "case-109",
    },
    {
      ...base,
      id: "enf-2",
      no: "2026/1877 E.",
      office: "İstanbul Anadolu 3. İcra Dairesi",
      type: "Kambiyo",
      clientId: "cli-ayse",
      debtorIds: ["dbt-1"],
      principal: 42000,
      interest: 2100,
      costs: 1250,
      status: "Haciz",
      openingDate: d(-50),
      responsibleIds: ["usr-selin"],
    },
    {
      ...base,
      id: "enf-3",
      no: "2026/990 E.",
      office: "İstanbul 2. İcra Dairesi",
      type: "Kira",
      clientId: "cli-fatma",
      debtorIds: ["dbt-3"],
      principal: 24000,
      interest: 900,
      costs: 760,
      status: "Derdest",
      openingDate: d(-25),
      responsibleIds: ["usr-buse"],
    },
  ];
  const promises: PaymentPromise[] = [
    {
      ...base,
      id: "prm-1",
      enforcementId: "enf-1",
      debtorId: "dbt-2",
      amount: 50000,
      dueDate: d(-40),
      status: "Tutuldu",
    },
    {
      ...base,
      id: "prm-2",
      enforcementId: "enf-1",
      debtorId: "dbt-2",
      amount: 50000,
      dueDate: d(-10),
      status: "Tutuldu",
    },
    {
      ...base,
      id: "prm-3",
      enforcementId: "enf-1",
      debtorId: "dbt-2",
      amount: 50000,
      dueDate: d(20),
      status: "Bekliyor",
    },
    {
      ...base,
      id: "prm-4",
      enforcementId: "enf-2",
      debtorId: "dbt-1",
      amount: 10000,
      dueDate: d(-3),
      status: "Bekliyor",
      note: "Telefonda maaş gününde ödeyeceğini söyledi",
    },
    {
      ...base,
      id: "prm-5",
      enforcementId: "enf-3",
      debtorId: "dbt-3",
      amount: 8000,
      dueDate: d(2),
      status: "Bekliyor",
    },
  ];
  const collections: Collection[] = [
    {
      ...base,
      id: "col-1",
      enforcementId: "enf-1",
      debtorId: "dbt-2",
      amount: 50000,
      date: d(-40),
      method: "Havale/EFT",
      accountId: "acc-isbank",
      promiseId: "prm-1",
      transferredToClient: true,
    },
    {
      ...base,
      id: "col-2",
      enforcementId: "enf-1",
      debtorId: "dbt-2",
      amount: 50000,
      date: d(-9),
      method: "Havale/EFT",
      accountId: "acc-isbank",
      promiseId: "prm-2",
      transferredToClient: false,
    },
    {
      ...base,
      id: "col-3",
      enforcementId: "enf-2",
      debtorId: "dbt-1",
      amount: 6500,
      date: d(-20),
      method: "Havale/EFT",
      accountId: "acc-isbank",
      transferredToClient: false,
      note: "Maaş haczi kesintisi",
    },
  ];
  transactions.push({
    ...base,
    id: "tx-4",
    accountId: "acc-isbank",
    date: d(-38),
    amount: -50000,
    category: "Müvekkile aktarım",
    description: "Ege Gıda tahsilatı müvekkile aktarıldı",
    clientId: "cli-kaya",
  });

  const contacts: ContactLog[] = [
    {
      ...base,
      id: "cnt-1",
      debtorId: "dbt-1",
      enforcementId: "enf-2",
      date: d(-6),
      channel: "Telefon",
      note: "Maaş gününde 10.000 TL ödeyeceğini beyan etti.",
      userId: "usr-selin",
    },
    {
      ...base,
      id: "cnt-2",
      debtorId: "dbt-2",
      enforcementId: "enf-1",
      date: d(-12),
      channel: "E-posta",
      note: "Muhasebe ile görüşüldü, ikinci taksit 2 gün içinde yatırılacak.",
      userId: "usr-ahmet",
    },
    {
      ...base,
      id: "cnt-3",
      debtorId: "dbt-3",
      enforcementId: "enf-3",
      date: d(-4),
      channel: "WhatsApp",
      note: "Ödeme planı teklif edildi, dönüş bekleniyor.",
      userId: "usr-buse",
    },
  ];

  const docRequests: DocumentRequest[] = [
    {
      ...base,
      id: "req-1",
      clientId: "cli-ayse",
      caseId: "case-128",
      title: "Fatura ve irsaliye suretleri",
      note: "Alacağı ispat için tüm faturaların taranmış hali",
      dueDate: d(5),
      status: "Bekliyor",
    },
  ];

  const messages: Message[] = [
    {
      ...base,
      id: "msg-1",
      clientId: "cli-ayse",
      authorId: "usr-selin",
      body: "Merhaba Ayşe Hanım, yarınki duruşma saat 10:30'da. 10:00'da adliye girişinde buluşalım.",
      readByFirm: true,
      readByClient: false,
      createdAt: ago(60 * 20),
      updatedAt: ago(60 * 20),
    },
    {
      ...base,
      id: "msg-2",
      clientId: "cli-ayse",
      authorId: "usr-portal-ayse",
      body: "Teşekkürler, orada olacağım. Faturaları bu akşam yüklerim.",
      readByFirm: false,
      readByClient: true,
      createdAt: ago(60 * 3),
      updatedAt: ago(60 * 3),
    },
  ];

  const notification = (
    n: Omit<AppNotification, keyof typeof base | "read"> & { read?: boolean; at: string },
  ): AppNotification => {
    const { at, ...rest } = n;
    return { ...base, read: false, createdAt: at, updatedAt: at, ...rest };
  };
  const notifications: AppNotification[] = [
    notification({
      id: "ntf-1",
      userId: "usr-selin",
      title: "Size yeni görev atandı",
      detail: "Bilirkişi raporuna itiraz · 2026/128",
      type: "Ajanda",
      link: "/takvim",
      at: ago(45),
    }),
    notification({
      id: "ntf-2",
      userId: "usr-ahmet",
      title: "İcra tahsilatı alındı",
      detail: "Ege Gıda Ltd. · ₺50.000",
      type: "İcra",
      link: "/icra/enf-1",
      at: ago(60 * 26),
    }),
    notification({
      id: "ntf-3",
      userId: "usr-buse",
      title: "Size yeni dosya atandı",
      detail: "2026/098 · Kira tespit",
      type: "Dosya",
      link: "/dosyalar/case-098",
      at: ago(60 * 50),
    }),
  ];

  const activities: ActivityLog[] = [
    {
      ...base,
      id: "act-1",
      actorId: "usr-leyla",
      action: "Ekleme",
      entity: "Masraf",
      entityId: "exp-3",
      detail: "Bilirkişi ücreti · ₺2.500",
      createdAt: ago(60 * 24 * 12),
      updatedAt: ago(60 * 24 * 12),
    },
    {
      ...base,
      id: "act-2",
      actorId: "usr-ahmet",
      action: "İşlem",
      entity: "Tahsilat",
      entityId: "plan-128",
      detail: "Taksit tahsil edildi · Ayşe Demir · ₺4.000",
      createdAt: ago(60 * 24 * 25),
      updatedAt: ago(60 * 24 * 25),
    },
  ];

  return {
    ...emptyState(),
    users,
    clients,
    cases,
    expenses,
    advances,
    plans,
    accounts,
    transactions,
    reminders,
    debtors,
    enforcements,
    promises,
    collections,
    contacts,
    documents: [],
    docRequests,
    messages,
    notifications,
    activities,
  };
}
