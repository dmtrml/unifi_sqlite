import { NextResponse } from 'next/server';
import { getUserIdOrThrow } from '@/server/auth/get-user-id';
import { CategoriesRepository } from '@/server/db/repositories/categories-repo';

const mapCategory = (record: NonNullable<Awaited<ReturnType<typeof CategoriesRepository.get>>>) => ({
  id: record.id,
  name: record.name,
  icon: record.icon,
  color: record.color,
  userId: record.userId,
  type: record.type,
});

export async function PATCH(
  request: Request,
  { params }: { params: { categoryId: string } },
) {
  try {
    const userId = await getUserIdOrThrow();
    const payload = await request.json();
    const updated = await CategoriesRepository.update(userId, params.categoryId, {
      name: payload.name,
      icon: payload.icon,
      color: payload.color,
      type: payload.type,
    });

    if (!updated) {
      return NextResponse.json({ message: 'Category not found.' }, { status: 404 });
    }

    return NextResponse.json(mapCategory(updated));
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unexpected error' },
      { status: error instanceof Error && error.message === 'Unauthorized' ? 401 : 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { categoryId: string } },
) {
  try {
    const userId = await getUserIdOrThrow();
    const existing = await CategoriesRepository.get(userId, params.categoryId);
    if (!existing) {
      return NextResponse.json({ message: 'Category not found.' }, { status: 404 });
    }

    await CategoriesRepository.delete(userId, params.categoryId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unexpected error' },
      { status: error instanceof Error && error.message === 'Unauthorized' ? 401 : 500 },
    );
  }
}
