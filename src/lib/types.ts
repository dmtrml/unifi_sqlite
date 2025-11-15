import { Timestamp } from "@/lib/timestamp";

export type Category = {
  id: string;
  name: string;
  icon: string;
  color: string;
  userId: string;
  type: 'expense' | 'income';
  parentId?: string | null;
};

export type AccountType = "Cash" | "Card" | "Bank Account" | "Deposit" | "Loan";
export type Currency = "USD" | "EUR" | "JPY" | "GBP" | "CHF" | "CAD" | "AUD" | "CNY" | "INR" | "ARS" | "RUB";

export type Account = {
  id: string;
  name: string;
  balance: number;
  icon: string;
  color: string;
  userId: string;
  type: AccountType;
  currency: Currency;
}

export type Transaction = {
  id: string;
  accountId?: string; // Optional for transfers
  fromAccountId?: string; // For transfers
  toAccountId?: string; // For transfers
  categoryId?: string; // Optional for transfers
  amount?: number; // For single currency expense/income/transfer
  amountSent?: number; // For multi-currency transfers
  amountReceived?: number; // For multi-currency transfers
  date: Timestamp;
  description: string;
  transactionType: 'expense' | 'income' | 'transfer';
  expenseType?: 'mandatory' | 'optional';
  incomeType?: 'active' | 'passive';
  userId: string;
};

export type Budget = {
  id: string;
  categoryId: string;
  amount: number;
  userId: string;
  currency: Currency;
};

export type RecurringTransaction = {
  id: string;
  accountId: string;
  categoryId: string;
  amount: number;
  description: string;
  frequency: 'weekly' | 'bi-weekly' | 'monthly';
  startDate: Timestamp;
  userId: string;
};

export type User = {
  id: string;
  email?: string;
  name?: string;
  theme?: 'light' | 'dark';
  mainCurrency?: Currency;
  mercadoPagoConnected?: boolean;
};

export type IncomeExpensePoint = {
  month: string; // ISO date string (YYYY-MM-01)
  income: number;
  expense: number;
};

export type CategorySummaryItem = {
  categoryId: string | null;
  name: string;
  color?: string | null;
  icon?: string | null;
  total: number;
};

export type DashboardKPI = {
  totalIncome: number;
  totalExpenses: number;
  totalBudget: number;
  netWorth: number;
};
