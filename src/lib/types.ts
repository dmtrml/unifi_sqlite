import { Timestamp } from "firebase/firestore";

export type Category = {
  id: string;
  name: string;
  icon: string;
  color: string;
  userId: string;
};

export type Transaction = {
  id: string;
  categoryId: string;
  amount: number;
  date: Timestamp;
  description: string;
  transactionType: 'expense' | 'income';
  userId: string;
};

export type Budget = {
  categoryId: string;
  amount: number;
};

export type RecurringExpense = {
    id: string;
    categoryId: string;
    amount: number;
    description: string;
    frequency: 'weekly' | 'bi-weekly' | 'monthly';
}
