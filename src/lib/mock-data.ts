export const stats = {
  clients: { value: 342, delta: 8.2 },
  activeCases: { value: 128, delta: 3.1 },
  monthRevenue: { value: 284500, delta: 12.4 },
  monthExpense: { value: 47300, delta: -4.6 },
};

export const revenueSeries = [
  { month: "Ağu", value: 182000 },
  { month: "Eyl", value: 205000 },
  { month: "Eki", value: 198000 },
  { month: "Kas", value: 221000 },
  { month: "Ara", value: 246000 },
  { month: "Oca", value: 231000 },
  { month: "Şub", value: 258000 },
  { month: "Mar", value: 274000 },
  { month: "Nis", value: 262000 },
  { month: "May", value: 289000 },
  { month: "Haz", value: 271000 },
  { month: "Tem", value: 284500 },
];

export const expenseBreakdown = [
  { name: "Harç", value: 18400 },
  { name: "Bilirkişi", value: 12200 },
  { name: "Tebligat", value: 6800 },
  { name: "Yol", value: 5300 },
  { name: "Diğer", value: 4600 },
];

export type TxStatus = "Tamamlandı" | "Beklemede" | "İptal";

export const recentTransactions: Array<{
  id: string;
  date: string;
  type: "Tahsilat" | "Masraf" | "Avans" | "İade";
  client: string;
  file: string;
  amount: number;
  status: TxStatus;
}> = [
  {
    id: "TX-1042",
    date: "28.07.2026",
    type: "Tahsilat",
    client: "Ayşe Demir",
    file: "2026/128",
    amount: 24500,
    status: "Tamamlandı",
  },
  {
    id: "TX-1041",
    date: "28.07.2026",
    type: "Masraf",
    client: "Mehmet Kaya",
    file: "2026/117",
    amount: -1850,
    status: "Tamamlandı",
  },
  {
    id: "TX-1040",
    date: "27.07.2026",
    type: "Avans",
    client: "Zeynep Şahin",
    file: "2026/122",
    amount: 8000,
    status: "Beklemede",
  },
  {
    id: "TX-1039",
    date: "27.07.2026",
    type: "Tahsilat",
    client: "Kaya Holding A.Ş.",
    file: "2026/109",
    amount: 62000,
    status: "Tamamlandı",
  },
  {
    id: "TX-1038",
    date: "26.07.2026",
    type: "Masraf",
    client: "Ali Yıldız",
    file: "2026/114",
    amount: -640,
    status: "Tamamlandı",
  },
  {
    id: "TX-1037",
    date: "26.07.2026",
    type: "Tahsilat",
    client: "Emre Aksoy",
    file: "2026/106",
    amount: 15750,
    status: "Tamamlandı",
  },
  {
    id: "TX-1036",
    date: "25.07.2026",
    type: "İade",
    client: "Fatma Öz",
    file: "2026/098",
    amount: -3200,
    status: "İptal",
  },
  {
    id: "TX-1035",
    date: "25.07.2026",
    type: "Tahsilat",
    client: "Nurdan İşler Ltd.",
    file: "2026/104",
    amount: 41200,
    status: "Tamamlandı",
  },
  {
    id: "TX-1034",
    date: "24.07.2026",
    type: "Masraf",
    client: "Barış Türk",
    file: "2026/101",
    amount: -1200,
    status: "Tamamlandı",
  },
  {
    id: "TX-1033",
    date: "24.07.2026",
    type: "Avans",
    client: "Selma Arı",
    file: "2026/096",
    amount: 6500,
    status: "Beklemede",
  },
];

export const upcomingReminders = [
  {
    day: 29,
    month: "Tem",
    title: "İstanbul 3. Asliye Hukuk – Duruşma",
    type: "Duruşma",
    time: "10:30",
  },
  {
    day: 30,
    month: "Tem",
    title: "Kaya Holding – Sözleşme toplantısı",
    type: "Toplantı",
    time: "14:00",
  },
  {
    day: 31,
    month: "Tem",
    title: "Ayşe Demir – Tahsilat hatırlatması",
    type: "Tahsilat",
    time: "09:00",
  },
  { day: 2, month: "Ağu", title: "Ankara 1. İdare – Duruşma", type: "Duruşma", time: "11:15" },
  { day: 4, month: "Ağu", title: "Nurdan İşler – Bilirkişi raporu", type: "Görev", time: "17:00" },
];

export const notifications = [
  {
    title: "Yeni tahsilat alındı",
    desc: "Kaya Holding A.Ş. – ₺62.000",
    tone: "success" as const,
    time: "10 dk önce",
  },
  {
    title: "Yeni masraf eklendi",
    desc: "2026/117 dosyasına harç kaydedildi",
    tone: "info" as const,
    time: "1 sa önce",
  },
  {
    title: "Duruşma yaklaşıyor",
    desc: "29 Tem 10:30 – İstanbul 3. Asliye",
    tone: "warning" as const,
    time: "3 sa önce",
  },
  {
    title: "Yeni dosya oluşturuldu",
    desc: "2026/128 – Ayşe Demir",
    tone: "info" as const,
    time: "Dün",
  },
  { title: "Ödeme gecikti", desc: "Fatma Öz – ₺3.200", tone: "destructive" as const, time: "Dün" },
];

export const recentClients = [
  { name: "Ayşe Demir", tag: "Bireysel", cases: 2 },
  { name: "Kaya Holding A.Ş.", tag: "Kurumsal", cases: 7 },
  { name: "Emre Aksoy", tag: "Bireysel", cases: 1 },
  { name: "Nurdan İşler Ltd.", tag: "Kurumsal", cases: 4 },
];

export const recentCases = [
  { no: "2026/128", title: "Alacak davası", client: "Ayşe Demir" },
  { no: "2026/127", title: "İş sözleşmesi feshi", client: "Mehmet Kaya" },
  { no: "2026/126", title: "Tazminat", client: "Kaya Holding" },
  { no: "2026/125", title: "Kira uyuşmazlığı", client: "Selma Arı" },
];

export const pendingCollections = [
  { client: "Fatma Öz", file: "2026/098", amount: 3200, due: "22.07.2026", overdue: true },
  { client: "Selma Arı", file: "2026/096", amount: 6500, due: "01.08.2026", overdue: false },
  { client: "Barış Türk", file: "2026/101", amount: 4200, due: "05.08.2026", overdue: false },
  { client: "Ali Yıldız", file: "2026/114", amount: 9100, due: "10.08.2026", overdue: false },
];

export const activeReminders = [
  { title: "Duruşma – 2026/128", when: "29 Tem 10:30", tone: "warning" as const },
  { title: "Bilirkişi raporu teslim", when: "04 Ağu 17:00", tone: "info" as const },
  { title: "Sözleşme yenileme", when: "07 Ağu", tone: "info" as const },
  { title: "Vekalet süresi bitiyor", when: "12 Ağu", tone: "destructive" as const },
];
