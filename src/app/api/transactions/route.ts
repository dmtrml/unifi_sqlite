import { NextResponse } from 'next/server';
import { getUserIdOrThrow } from '@/server/auth/get-user-id';
import {
  TransactionsRepository,
  type TransactionFilters,
} from '@/server/db/repositories/transactions-repo';
import { TransactionsService } from '@/server/db/services/transactions-service';
import { toCents } from '@/server/db/utils';

const parseNumber = (value: string | null) => {
  if (!value) return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
};

const mapRecord = (
  record: NonNullable<Awaited<ReturnType<typeof TransactionsRepository.get>>>,
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

const parseFilters = (url: string): TransactionFilters => {
  const searchParams = new URL(url).searchParams;
  return {
    accountId: searchParams.get('accountId') ?? undefined,
    categoryId: searchParams.get('categoryId') ?? undefined,
    startDate: parseNumber(searchParams.get('startDate')),
    endDate: parseNumber(searchParams.get('endDate')),
    cursor: parseNumber(searchParams.get('cursor')),
    limit: parseNumber(searchParams.get('limit')),
    sort: (searchParams.get('sort') as TransactionFilters['sort']) ?? undefined,
  };
};

export async function GET(request: Request) {
  try {
    const userId = await getUserIdOrThrow();
    const filters = parseFilters(request.url);
    const result = await TransactionsRepository.list(userId, filters);
    return NextResponse.json({
      items: result.items.map(mapRecord),
      hasMore: result.hasMore,
      nextCursor: result.nextCursor,
    });
  } catch (error) {
    const status = error instanceof Error && error.message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unexpected error' },
      { status },
    );
  }
}

export async function POST(request: Request) {
  try {
    const userId = await getUserIdOrThrow();
    const payload = await request.json();
    if (!payload?.transactionType) {
      return NextResponse.json({ message: 'transactionType is required.' }, { status: 400 });
    }

    const record = await TransactionsService.create(userId, {
      transactionType: payload.transactionType,
      accountId: payload.accountId ?? null,
      fromAccountId: payload.fromAccountId ?? null,
      toAccountId: payload.toAccountId ?? null,
      categoryId: payload.categoryId ?? null,
      amountCents: payload.amount != null ? toCents(payload.amount) : undefined,
      amountSentCents: payload.amountSent != null ? toCents(payload.amountSent) : undefined,
      amountReceivedCents:
        payload.amountReceived != null ? toCents(payload.amountReceived) : undefined,
      date:
        typeof payload.date === 'number'
          ? payload.date
          : payload.date
          ? new Date(payload.date).getTime()
          : Date.now(),
      description: payload.description ?? '',
      expenseType: payload.expenseType ?? null,
      incomeType: payload.incomeType ?? null,
    });

    if (!record) {
      return NextResponse.json({ message: 'Failed to create transaction.' }, { status: 500 });
    }

    return NextResponse.json(mapRecord(record), { status: 201 });
  } catch (error) {
    const status = error instanceof Error && error.message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unexpected error' },
      { status },
    );
  }
}
