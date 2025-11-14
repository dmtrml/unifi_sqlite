import { NextResponse } from 'next/server';
import { getUserIdOrThrow } from '@/server/auth/get-user-id';
import { TransactionsRepository } from '@/server/db/repositories/transactions-repo';

const parseNumber = (value: string | null) => {
  if (!value) return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
};

const mapRecord = (
  record: NonNullable<ReturnType<typeof TransactionsRepository.listRange>[number]>,
) => ({
  id: record.id,
  userId: record.userId,
  accountId: record.accountId,
  fromAccountId: record.fromAccountId,
  toAccountId: record.toAccountId,
  categoryId: record.categoryId,
  amount: record.amountCents != null ? record.amountCents / 100 : null,
  amountSent: record.amountSentCents != null ? record.amountSentCents / 100 : null,
  amountReceived: record.amountReceivedCents != null ? record.amountReceivedCents / 100 : null,
  date: record.date,
  description: record.description ?? '',
  transactionType: record.transactionType,
  expenseType: record.expenseType,
  incomeType: record.incomeType,
});

export async function GET(request: Request) {
  try {
    const userId = await getUserIdOrThrow();
    const searchParams = new URL(request.url).searchParams;
    const startDate = parseNumber(searchParams.get('startDate'));
    const endDate = parseNumber(searchParams.get('endDate'));

    const rows = TransactionsRepository.listRange(userId, {
      startDate,
      endDate,
      sort: 'desc',
    });

    return NextResponse.json({ items: rows.map(mapRecord) });
  } catch (error) {
    const status = error instanceof Error && error.message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unexpected error' },
      { status },
    );
  }
}
