import { AccountsRepository } from '@/server/db/repositories/accounts-repo';
import {
  TransactionsRepository,
  type TransactionInput,
} from '@/server/db/repositories/transactions-repo';
import { withTransaction, type TransactionClient } from '@/server/db/transaction';

export type CreateTransactionParams = TransactionInput & {
  transactionType: 'expense' | 'income' | 'transfer';
};

export type UpdateTransactionParams = Partial<TransactionInput>;

const ensurePositive = (value: number | null | undefined, field: string) => {
  if (!value || value <= 0) {
    throw new Error(`${field} must be greater than zero.`);
  }
  return value;
};

const requireAccount = (
  userId: string,
  accountId: string | undefined | null,
  tx: TransactionClient,
) => {
  if (!accountId) {
    throw new Error('Account is required for this operation.');
  }
  const account = AccountsRepository.get(userId, accountId, tx);
  if (!account) {
    throw new Error('Account not found.');
  }
  return account;
};

const applyAccountingEffect = (
  record: NonNullable<ReturnType<typeof TransactionsRepository.get>>,
  tx: TransactionClient,
  mode: 'apply' | 'revert',
) => {
  const sign = mode === 'apply' ? 1 : -1;
  const amount = record.amountCents ?? 0;
  const amountSent = record.amountSentCents ?? record.amountCents ?? 0;
  const amountReceived = record.amountReceivedCents ?? record.amountCents ?? 0;

  if (record.transactionType === 'expense' && record.accountId) {
    AccountsRepository.adjustBalance(record.accountId, -amount * sign, tx);
  }

  if (record.transactionType === 'income' && record.accountId) {
    AccountsRepository.adjustBalance(record.accountId, amount * sign, tx);
  }

  if (record.transactionType === 'transfer') {
    if (record.fromAccountId && amountSent) {
      AccountsRepository.adjustBalance(record.fromAccountId, -amountSent * sign, tx);
    }
    if (record.toAccountId && amountReceived) {
      AccountsRepository.adjustBalance(record.toAccountId, amountReceived * sign, tx);
    }
  }
};

export class TransactionsService {
  static async create(userId: string, params: CreateTransactionParams) {
    const record = withTransaction((tx) => {
      if (params.transactionType === 'expense' || params.transactionType === 'income') {
        const amount = ensurePositive(params.amountCents ?? null, 'Amount');
        requireAccount(userId, params.accountId, tx);
        const newRecord = TransactionsRepository.create(
          userId,
          { ...params, amountCents: amount },
          tx,
        );
        if (!newRecord) throw new Error('Failed to create transaction.');
        applyAccountingEffect(newRecord, tx, 'apply');
        return newRecord;
      }

      // transfer
      const fromAccount = requireAccount(userId, params.fromAccountId, tx);
      const toAccount = requireAccount(userId, params.toAccountId, tx);
      if (fromAccount.id === toAccount.id) {
        throw new Error('Source and destination accounts must differ.');
      }

      const debit = ensurePositive(
        params.amountSentCents ?? params.amountCents ?? null,
        'Sent amount',
      );
      const credit = ensurePositive(
        params.amountReceivedCents ?? params.amountCents ?? null,
        'Received amount',
      );

      const newRecord = TransactionsRepository.create(
        userId,
        {
          ...params,
          amountSentCents: params.amountSentCents ?? params.amountCents ?? debit,
          amountReceivedCents: params.amountReceivedCents ?? params.amountCents ?? credit,
        },
        tx,
      );

      if (!newRecord) throw new Error('Failed to create transaction.');
      applyAccountingEffect(newRecord, tx, 'apply');
      return newRecord;
    });

    return record;
  }

  static async update(userId: string, transactionId: string, params: UpdateTransactionParams) {
    const updated = withTransaction((tx) => {
      const existing = TransactionsRepository.get(userId, transactionId, tx);
      if (!existing) {
        throw new Error('Transaction not found.');
      }

      const targetType = params.transactionType ?? existing.transactionType;
      if (targetType === 'expense' || targetType === 'income') {
        const targetAccount = params.accountId ?? existing.accountId;
        requireAccount(userId, targetAccount, tx);
        ensurePositive(params.amountCents ?? existing.amountCents ?? null, 'Amount');
      } else {
        const targetFrom = params.fromAccountId ?? existing.fromAccountId;
        const targetTo = params.toAccountId ?? existing.toAccountId;
        const debit = params.amountSentCents ?? params.amountCents ?? existing.amountSentCents ?? existing.amountCents;
        const credit =
          params.amountReceivedCents ?? params.amountCents ?? existing.amountReceivedCents ?? existing.amountCents;

        requireAccount(userId, targetFrom, tx);
        requireAccount(userId, targetTo, tx);
        if (targetFrom && targetTo && targetFrom === targetTo) {
          throw new Error('Source and destination accounts must differ.');
        }
        ensurePositive(debit ?? null, 'Sent amount');
        ensurePositive(credit ?? null, 'Received amount');
      }

      applyAccountingEffect(existing, tx, 'revert');

      const updatedRecord = TransactionsRepository.update(userId, transactionId, params, tx);
      if (!updatedRecord) {
        throw new Error('Failed to update transaction.');
      }

      applyAccountingEffect(updatedRecord, tx, 'apply');
      return updatedRecord;
    });

    return updated;
  }

  static async delete(userId: string, transactionId: string) {
    const deleted = withTransaction((tx) => {
      const existing = TransactionsRepository.get(userId, transactionId, tx);
      if (!existing) {
        return null;
      }
      applyAccountingEffect(existing, tx, 'revert');
      TransactionsRepository.delete(userId, transactionId, tx);
      return existing;
    });

    return deleted;
  }
}
