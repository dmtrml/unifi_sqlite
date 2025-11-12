export type NormalizedImportRow = {
  transactionType: 'income' | 'expense' | 'transfer';
  date: number;
  description?: string | null;
  amount?: number | null;
  amountSent?: number | null;
  amountReceived?: number | null;
  accountId?: string | null;
  accountName?: string | null;
  accountCurrency?: string | null;
  fromAccountId?: string | null;
  fromAccountName?: string | null;
  fromAccountCurrency?: string | null;
  toAccountId?: string | null;
  toAccountName?: string | null;
  toAccountCurrency?: string | null;
  categoryId?: string | null;
  categoryName?: string | null;
};

export type ImportSummary = {
  successCount: number;
  errorCount: number;
  newCategories: number;
  newAccounts: number;
};
