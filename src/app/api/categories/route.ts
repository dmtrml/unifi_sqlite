import { NextResponse } from 'next/server';
import { getUserIdOrThrow } from '@/server/auth/get-user-id';
import { CategoriesRepository } from '@/server/db/repositories/categories-repo';
import type { Category } from '@/lib/types';
import { getSuggestedCategoryIcon } from '@/lib/category-icon-map';

const mapCategory = (
  record: Awaited<ReturnType<typeof CategoriesRepository.list>>[number],
): Category => ({
  id: record.id,
  name: record.name,
  icon: record.icon,
  color: record.color,
  userId: record.userId,
  type: (record.type as Category['type']) ?? 'expense',
  parentId: record.parentId ?? null,
});

export async function GET() {
  try {
    const userId = await getUserIdOrThrow();
    const records = await CategoriesRepository.list(userId);
    return NextResponse.json(records.map(mapCategory));
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unexpected error' },
      { status: error instanceof Error && error.message === 'Unauthorized' ? 401 : 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const userId = await getUserIdOrThrow();
    const payload = await request.json();
    if (!payload?.name) {
      return NextResponse.json({ message: 'Name is required.' }, { status: 400 });
    }
    if (!payload?.type) {
      return NextResponse.json({ message: 'Type is required.' }, { status: 400 });
    }
    const parentId =
      typeof payload.parentId === 'string' && payload.parentId.trim().length > 0 ? payload.parentId.trim() : null;
    const defaultIcon = getSuggestedCategoryIcon(payload.name, payload.type) ?? 'MoreHorizontal';
    const record = await CategoriesRepository.create(userId, {
      name: payload.name,
      icon: payload.icon ?? defaultIcon,
      color: payload.color ?? 'hsl(var(--muted-foreground))',
      type: payload.type,
      parentId,
    });

    if (!record) {
      return NextResponse.json({ message: 'Failed to create category.' }, { status: 500 });
    }

    return NextResponse.json(mapCategory(record), { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unexpected error' },
      { status: error instanceof Error && error.message === 'Unauthorized' ? 401 : 500 },
    );
  }
}
