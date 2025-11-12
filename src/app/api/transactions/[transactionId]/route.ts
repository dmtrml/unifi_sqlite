import { NextResponse } from 'next/server';
import { getUserIdOrThrow } from '@/server/auth/get-user-id';
import { TransactionsService } from '@/server/db/services/transactions-service';
import { toCents } from '@/server/db/utils';
import { TransactionsRepository } from '@/server/db/repositories/transactions-repo';

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

export async function PATCH(
  request: Request,
  { params }: { params: { transactionId: string } },
) {
  try {
    const userId = await getUserIdOrThrow();
    const payload = await request.json();
    const updated = await TransactionsService.update(userId, params.transactionId, {
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
          : undefined,
      description: payload.description ?? undefined,
      expenseType: payload.expenseType ?? undefined,
      incomeType: payload.incomeType ?? undefined,
    });

    if (!updated) {
      return NextResponse.json({ message: 'Transaction not found.' }, { status: 404 });
    }

    return NextResponse.json(mapRecord(updated));
  } catch (error) {
    const status = error instanceof Error && error.message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unexpected error' },
      { status },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { transactionId: string } },
) {
  try {
    const userId = await getUserIdOrThrow();
    const existing = await TransactionsService.delete(userId, params.transactionId);
    if (!existing) {
      return NextResponse.json({ message: 'Transaction not found.' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const status = error instanceof Error && error.message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unexpected error' },
      { status },
    );
  }
}
