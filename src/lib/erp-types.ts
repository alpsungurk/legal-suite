export type UserRole = "Admin" | "Avukat" | "Sekreter";

export type User = {
  id: string;
  name: string;
  role: UserRole;
  email: string;
  username: string;
};

export type Client = {
  id: string;
  name: string;
  kind: "Bireysel" | "Kurumsal";
  email: string;
  phone: string;
  status: "Aktif" | "Pasif";
  identity?: string;
  address?: string;
  monthlyFee?: number;
  monthlyFeeStartDate?: string;
};

export type CaseFile = {
  id: string;
  no: string;
  title: string;
  clientId?: string;
  court?: string;
  type: string;
  openingDate: string;
  note?: string;
};

export type PaymentInstallment = {
  id: string;
  dueDate: string;
  amount: number;
  status: "Ödendi" | "Bekliyor" | "Gecikmiş";
};

export type Expense = {
  id: string;
  title: string;
  caseId?: string;
  clientId?: string;
  amount: number;
  date: string;
  payer: string;
  type: string;
  status: string;
  direction?: "Gelen" | "Giden";
  recordDate?: string;
};

export type Payment = {
  id: string;
  caseId?: string;
  clientId?: string;
  amount: number;
  date: string;
  type: string;
  description: string;
  status: string;
  installments?: PaymentInstallment[];
  feePeriod?: string;
};

export type Reminder = {
  id: string;
  title: string;
  caseId: string;
  clientId?: string;
  assigneeId: string;
  date: string;
  type: string;
  status: string;
  note?: string;
};

export type AppNotification = {
  id: string;
  userId: string;
  title: string;
  detail: string;
  type: string;
  createdAt: string;
  read: boolean;
};

export type ActivityLog = {
  id: string;
  actorId: string;
  action: string;
  entity: string;
  detail: string;
  timestamp: string;
  amount?: string;
};

export type ErpState = {
  users: User[];
  clients: Client[];
  cases: CaseFile[];
  expenses: Expense[];
  payments: Payment[];
  reminders: Reminder[];
  notifications: AppNotification[];
  activities: ActivityLog[];
  caseTypes: string[];
  expenseTypes: string[];
  reminderTypes: string[];
  currentUserId: string;
};

export const DEFAULT_CASE_TYPES = ["Dava", "İcra", "Danışmanlık", "Arabuluculuk"];
export const DEFAULT_EXPENSE_TYPES = [
  "Harç",
  "Bilirkişi",
  "Tebligat",
  "Yol",
  "Kargo",
  "Fotokopi",
  "Ofis gideri",
  "Diğer",
];
export const DEFAULT_REMINDER_TYPES = [
  "Duruşma",
  "Evrak teslimi",
  "Müvekkili ara",
  "Tahsilat",
  "Toplantı",
  "Diğer",
];

export function permissionsFor(role: UserRole) {
  const isAdmin = role === "Admin";
  const isLawyer = role === "Avukat";
  const isSecretary = role === "Sekreter";

  return {
    canAccessSettings: isAdmin || isSecretary,
    canManageUsers: isAdmin,
    canManageCategories: isAdmin || isSecretary,
    canDelete: isAdmin || isSecretary,
    canWrite: isAdmin || isSecretary,
    canManageRecords: isAdmin || isSecretary,
    canManageFinance: isAdmin || isSecretary,
    canViewFinance: isAdmin || isSecretary,
    canViewPayments: isAdmin || isSecretary || isLawyer,
    canViewActivityHistory: isAdmin,
    canMarkExpenseReceived: isAdmin,
    canCreateClients: isAdmin || isLawyer || isSecretary,
    canCreateCases: isAdmin || isLawyer || isSecretary,
  };
}
