import type { Account, Budget, Category, RecurringTransaction, Transaction } from '@/lib/types';

export type BackupMeta = {
  schemaVersion: number;
  exportedAt: string;
};

export type BackupPayload = {
  meta: BackupMeta;
  accounts: Array<Omit<Account, 'currency' | 'type'> & { currency: string; type: string }>;
  categories: Category[];
  budgets: Array<Omit<Budget, 'currency'> & { currency: string }>;
  transactions: Array<
    Omit<Transaction, 'date' | 'accountId' | 'fromAccountId' | 'toAccountId' | 'categoryId' | 'amount' | 'amountSent' | 'amountReceived'> & {
      date: number;
      accountId: string | null;
      fromAccountId: string | null;
      toAccountId: string | null;
      categoryId: string | null;
      amount: number | null;
      amountSent: number | null;
      amountReceived: number | null;
    }
  >;
  recurring: Array<Omit<RecurringTransaction, 'startDate'> & { startDate: number }>;
};

export const CURRENT_BACKUP_SCHEMA_VERSION = 1;
