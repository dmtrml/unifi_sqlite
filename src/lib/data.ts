import type { Category, Expense, Budget, RecurringExpense } from './types';

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

export const expenses: Expense[] = [
  { id: 'exp-1', categoryId: 'cat-1', amount: 55.20, date: '2024-05-01', description: 'Groceries' },
  { id: 'exp-2', categoryId: 'cat-2', amount: 30.00, date: '2024-05-02', description: 'Gasoline' },
  { id: 'exp-3', categoryId: 'cat-4', amount: 45.00, date: '2024-05-03', description: 'Movie tickets' },
  { id: 'exp-4', categoryId: 'cat-1', amount: 22.50, date: '2024-05-04', description: 'Lunch with friends' },
  { id: 'exp-5', categoryId: 'cat-3', amount: 1200.00, date: '2024-05-01', description: 'Rent' },
  { id: 'exp-6', categoryId: 'cat-5', amount: 75.00, date: '2024-05-05', description: 'Electricity Bill' },
  { id: 'exp-7', categoryId: 'cat-7', amount: 150.00, date: '2024-05-06', description: 'New shoes' },
  { id: 'exp-8', categoryId: 'cat-6', amount: 60.00, date: '2024-05-07', description: 'Pharmacy' },
  { id: 'exp-9', categoryId: 'cat-1', amount: 12.00, date: '2024-05-08', description: 'Coffee' },
  { id: 'exp-10', categoryId: 'cat-2', amount: 15.00, date: '2024-05-09', description: 'Bus fare' },
];

export const budgets: Budget[] = [
  { categoryId: 'cat-1', amount: 500 },
  { categoryId: 'cat-2', amount: 150 },
  { categoryId: 'cat-3', amount: 1200 },
  { categoryId: 'cat-4', amount: 200 },
  { categoryId: 'cat-5', amount: 150 },
  { categoryId: 'cat-6', amount: 100 },
  { categoryId: 'cat-7', amount: 250 },
  { categoryId: 'cat-8', amount: 100 },
];

export const recurringExpenses: RecurringExpense[] = [
  { id: 'rec-1', categoryId: 'cat-3', amount: 1200.00, description: 'Monthly Rent', frequency: 'monthly' },
  { id: 'rec-2', categoryId: 'cat-5', amount: 50.00, description: 'Internet Bill', frequency: 'monthly' },
  { id: 'rec-3', categoryId: 'cat-4', amount: 15.00, description: 'Streaming Service', frequency: 'monthly' },
  { id: 'rec-4', categoryId: 'cat-6', amount: 80.00, description: 'Gym Membership', frequency: 'monthly' },
];
