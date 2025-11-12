import { NextResponse } from 'next/server';
import { getUserIdOrThrow } from '@/server/auth/get-user-id';
import { AccountsRepository } from '@/server/db/repositories/accounts-repo';

const mapRecord = (record: NonNullable<Awaited<ReturnType<typeof AccountsRepository.get>>>) => ({
  id: record.id,
  name: record.name,
  balance: record.balanceCents / 100,
  icon: record.icon,
  color: record.color,
  userId: record.userId,
  type: record.type,
  currency: record.currency,
});

export async function PATCH(
  request: Request,
  { params }: { params: { accountId: string } },
) {
  try {
    const userId = await getUserIdOrThrow();
    const payload = await request.json();
    const balanceValue =
      typeof payload.balance === 'number' ? Math.round(payload.balance * 100) : undefined;

    const updated = await AccountsRepository.update(
      userId,
      params.accountId,
      {
        name: payload.name,
        icon: payload.icon,
        color: payload.color,
        type: payload.type,
        currency: payload.currency,
        balanceCents: balanceValue,
      },
    );

    if (!updated) {
      return NextResponse.json({ message: 'Account not found.' }, { status: 404 });
    }

    return NextResponse.json(mapRecord(updated));
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unexpected error' },
      { status: error instanceof Error && error.message === 'Unauthorized' ? 401 : 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { accountId: string } },
) {
  try {
    const userId = await getUserIdOrThrow();
    const existing = await AccountsRepository.get(userId, params.accountId);
    if (!existing) {
      return NextResponse.json({ message: 'Account not found.' }, { status: 404 });
    }

    await AccountsRepository.delete(userId, params.accountId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unexpected error' },
      { status: error instanceof Error && error.message === 'Unauthorized' ? 401 : 500 },
    );
  }
}
