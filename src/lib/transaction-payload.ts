import {
  transactionFormSchema,
  editTransactionFormSchema,
  type TransactionFormInput,
  type EditTransactionFormInput,
  type TransactionFormValues,
} from '@/lib/schemas';

export type TransactionRequestPayload = {
  transactionType: 'expense' | 'income' | 'transfer';
  accountId: string | null;
  fromAccountId: string | null;
  toAccountId: string | null;
  categoryId: string | null;
  amount: number | null;
  amountSent: number | null;
  amountReceived: number | null;
  description: string;
  expenseType: 'mandatory' | 'optional' | null;
  incomeType: 'active' | 'passive' | null;
  date: number;
};

const mapParsedValues = (data: TransactionFormValues): TransactionRequestPayload => {
  const base: TransactionRequestPayload = {
    transactionType: data.transactionType,
    accountId: null,
    fromAccountId: null,
    toAccountId: null,
    categoryId: null,
    amount: null,
    amountSent: null,
    amountReceived: null,
    description: data.description ?? '',
    expenseType: data.transactionType === 'expense' ? data.expenseType ?? null : null,
    incomeType: data.transactionType === 'income' ? data.incomeType ?? null : null,
    date: data.date ? data.date.getTime() : Date.now(),
  };

  if (data.transactionType === 'expense' || data.transactionType === 'income') {
    base.accountId = data.accountId ?? null;
    base.categoryId = data.categoryId ?? null;
    base.amount = data.amount ?? null;
  } else if (data.transactionType === 'transfer') {
    base.fromAccountId = data.fromAccountId ?? null;
    base.toAccountId = data.toAccountId ?? null;
    base.amount = data.amount ?? null;
    base.amountSent = data.amountSent ?? null;
    base.amountReceived = data.amountReceived ?? null;
  }

  return base;
};

export const buildTransactionPayload = (input: TransactionFormInput): TransactionRequestPayload => {
  const parsed = transactionFormSchema.parse(input);
  return mapParsedValues(parsed);
};

export const buildEditTransactionPayload = (input: EditTransactionFormInput): TransactionRequestPayload => {
  const parsed = editTransactionFormSchema.parse(input);
  return mapParsedValues(parsed);
};
