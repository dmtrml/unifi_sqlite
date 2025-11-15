import type { Category } from '@/lib/types';

type CategoryLike = Pick<Category, 'id'> & { parentId?: string | null };

export const buildCategoryChildrenMap = (categories: CategoryLike[]) => {
  const map = new Map<string, CategoryLike[]>();
  categories.forEach((category) => {
    if (!category.parentId) return;
    const existing = map.get(category.parentId) ?? [];
    existing.push(category);
    map.set(category.parentId, existing);
  });
  return map;
};

export const getDescendantCategoryIds = (categoryId: string, categories: CategoryLike[]) => {
  const childrenMap = buildCategoryChildrenMap(categories);
  const result: string[] = [];
  const stack = [...(childrenMap.get(categoryId) ?? [])];
  while (stack.length) {
    const current = stack.pop()!;
    result.push(current.id);
    const children = childrenMap.get(current.id);
    if (children) {
      stack.push(...children);
    }
  }
  return result;
};

export const getCategoryRootId = (categoryId: string, categories: CategoryLike[]): string | null => {
  const byId = new Map<string, CategoryLike>();
  categories.forEach((category) => byId.set(category.id, category));
  let current = byId.get(categoryId);
  if (!current) return null;
  while (current.parentId && byId.has(current.parentId)) {
    current = byId.get(current.parentId)!;
  }
  return current?.id ?? null;
};

export const getCategoryWithDescendants = (categoryId: string, categories: CategoryLike[]) => {
  const descendants = getDescendantCategoryIds(categoryId, categories);
  return [categoryId, ...descendants];
};
