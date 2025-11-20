import { categories as categoriesTable } from '../src/server/db/schema';
import { db } from '../src/server/db/connection';
import { CategoriesRepository } from '../src/server/db/repositories/categories-repo';
import { getSuggestedCategoryIcon } from '../src/lib/category-icon-map';

async function main() {
  const records = await db.select().from(categoriesTable);
  let updated = 0;
  for (const record of records) {
    const type = record.type === 'income' ? 'income' : 'expense';
    const suggestion = getSuggestedCategoryIcon(record.name, type);
    if (suggestion && suggestion !== record.icon) {
      await CategoriesRepository.update(record.userId, record.id, { icon: suggestion });
      updated += 1;
    }
  }
  console.log(`Updated ${updated} categories with suggested icons.`);
}

main().catch((error) => {
  console.error('Failed to apply category icons:', error);
  process.exit(1);
});
