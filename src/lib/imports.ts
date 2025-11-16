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

export type ImportErrorCode =
  | 'invalid_date'
  | 'invalid_amount'
  | 'missing_account'
  | 'missing_category'
  | 'transfer_accounts_missing'
  | 'transaction_service_error'
  | 'unknown';

export type ImportErrorDetail = {
  rowIndex: number;
  code: ImportErrorCode;
  message: string;
  rowSample?: Pick<
    NormalizedImportRow,
    'transactionType' | 'date' | 'amount' | 'amountSent' | 'amountReceived' | 'accountName' | 'fromAccountName' | 'toAccountName' | 'categoryName'
  >;
};

export type ImportSummary = {
  successCount: number;
  errorCount: number;
  newCategories: number;
  newAccounts: number;
  newCategoryNames?: string[];
  newAccountNames?: string[];
  processedRows?: number;
  errorDetails?: ImportErrorDetail[];
  errorStats?: Partial<Record<ImportErrorCode | 'other', number>>;
};
