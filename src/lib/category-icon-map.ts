import iconSource from '@/data/category-icons.json';

type CategoryIconSource = {
  expense: Record<string, string>;
  income: Record<string, string>;
};

const slugToComponentName = (slug: string) =>
  slug
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join('');

const normalizeName = (name: string) => name.trim().toLowerCase();

const buildIconMap = (entries: Record<string, string>) =>
  new Map<string, string>(
    Object.entries(entries).map(([name, slug]) => [normalizeName(name), slugToComponentName(slug)]),
  );

const data = iconSource as CategoryIconSource;

const expenseIconMap = buildIconMap(data.expense);
const incomeIconMap = buildIconMap(data.income);

const uniqueExpenseIcons = new Set(expenseIconMap.values());
const uniqueIncomeIcons = new Set(incomeIconMap.values());

export const expenseCategoryIconNames = Array.from(uniqueExpenseIcons).sort();
export const incomeCategoryIconNames = Array.from(uniqueIncomeIcons).sort();
export const categoryIconNames = Array.from(new Set([...uniqueExpenseIcons, ...uniqueIncomeIcons])).sort();

export const getSuggestedCategoryIcon = (
  name: string,
  type: 'expense' | 'income',
): string | null => {
  if (!name?.trim()) return null;
  const normalized = normalizeName(name);
  const map = type === 'income' ? incomeIconMap : expenseIconMap;
  return map.get(normalized) ?? null;
};

export const getCategoryIconMap = () => ({
  expense: expenseIconMap,
  income: incomeIconMap,
});
