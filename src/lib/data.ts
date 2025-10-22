import type { Category, Expense, Budget, RecurringExpense, Transaction } from './types';

export const categories: Category[] = [
  { id: 'cat-1', name: 'Food', icon: 'UtensilsCrossed', color: "hsl(var(--chart-1))" },
  { id: 'cat-2', name: 'Transport', icon: 'Car', color: "hsl(var(--chart-2))" },
  { id: 'cat-3', name: 'Housing', icon: 'Home', color: "hsl(var(--chart-3))" },
  { id: 'cat-4', name: 'Entertainment', icon: 'Ticket', color: "hsl(var(--chart-4))" },
  { id: 'cat-5', name: 'Utilities', icon: 'Lightbulb', color: "hsl(var(--chart-5))" },
  { id: 'cat-6', name: 'Health', icon: 'HeartPulse', color: "hsl(var(--chart-1))" },
  { id: 'cat-7', name: 'Shopping', icon: 'ShoppingBag', color: "hsl(var(--chart-2))" },
  { id: 'cat-8', name: 'Other', icon: 'MoreHorizontal', color: "hsl(var(--chart-3))" },
];

export const expenses: Transaction[] = [];

export const budgets: Budget[] = [];

export const recurringExpenses: RecurringExpense[] = [];
