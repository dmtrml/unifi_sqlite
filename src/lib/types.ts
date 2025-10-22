export type Category = {
  id: string;
  name: string;
  icon: string;
  color: string;
};

export type Expense = {
  id: string;
  categoryId: string;
  amount: number;
  date: string;
  description: string;
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
