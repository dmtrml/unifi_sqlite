import { Timestamp } from "firebase/firestore";

export type Category = {
  id: string;
  name: string;
  icon: string;
  color: string;
  userId: string;
  type: 'expense' | 'income';
};

export type AccountType = "Cash" | "Card" | "Bank Account" | "Deposit" | "Loan";
export type Currency = "USD" | "EUR" | "JPY" | "GBP" | "CHF" | "CAD" | "AUD" | "CNY" | "INR" | "ARS";

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
  amount: number;
  date: Timestamp;
  description: string;
  transactionType: 'expense' | 'income' | 'transfer';
  userId: string;
};

export type Budget = {
  categoryId: string;
  amount: number;
};

export type RecurringExpense = {
    id: string;
    accountId: string;
    categoryId: string;
    amount: number;
    description: string;
    frequency: 'weekly' | 'bi-weekly' | 'monthly';
}
