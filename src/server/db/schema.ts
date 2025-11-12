import { sql } from 'drizzle-orm';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

const currentTimestamp = sql<number>`(strftime('%s','now') * 1000)`;

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email'),
  name: text('name'),
  theme: text('theme'),
  mainCurrency: text('main_currency'),
  mercadoPagoAccessToken: text('mercado_pago_access_token'),
  mercadoPagoRefreshToken: text('mercado_pago_refresh_token'),
  mercadoPagoTokenExpires: integer('mercado_pago_token_expires', { mode: 'number' }),
  createdAt: integer('created_at', { mode: 'number' }).notNull().default(currentTimestamp),
  updatedAt: integer('updated_at', { mode: 'number' }).notNull().default(currentTimestamp),
});

export const accounts = sqliteTable(
  'accounts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    balanceCents: integer('balance_cents', { mode: 'number' }).notNull().default(0),
    icon: text('icon').notNull(),
    color: text('color').notNull(),
    type: text('type').notNull(),
    currency: text('currency').notNull(),
    createdAt: integer('created_at', { mode: 'number' }).notNull().default(currentTimestamp),
    updatedAt: integer('updated_at', { mode: 'number' }).notNull().default(currentTimestamp),
  },
  (table) => ({
    userIdx: index('accounts_user_idx').on(table.userId),
  }),
);

export const categories = sqliteTable(
  'categories',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    icon: text('icon').notNull(),
    color: text('color').notNull(),
    type: text('type').notNull(),
    createdAt: integer('created_at', { mode: 'number' }).notNull().default(currentTimestamp),
    updatedAt: integer('updated_at', { mode: 'number' }).notNull().default(currentTimestamp),
  },
  (table) => ({
    userIdx: index('categories_user_idx').on(table.userId),
  }),
);

export const budgets = sqliteTable(
  'budgets',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    categoryId: text('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
    amountCents: integer('amount_cents', { mode: 'number' }).notNull(),
    currency: text('currency').notNull(),
    createdAt: integer('created_at', { mode: 'number' }).notNull().default(currentTimestamp),
    updatedAt: integer('updated_at', { mode: 'number' }).notNull().default(currentTimestamp),
  },
  (table) => ({
    userIdx: index('budgets_user_idx').on(table.userId),
    uniqueCategory: uniqueIndex('budgets_user_category_idx').on(table.userId, table.categoryId),
  }),
);

export const transactions = sqliteTable(
  'transactions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accountId: text('account_id').references(() => accounts.id, { onDelete: 'set null' }),
    fromAccountId: text('from_account_id').references(() => accounts.id, { onDelete: 'set null' }),
    toAccountId: text('to_account_id').references(() => accounts.id, { onDelete: 'set null' }),
    categoryId: text('category_id').references(() => categories.id, { onDelete: 'set null' }),
    amountCents: integer('amount_cents', { mode: 'number' }),
    amountSentCents: integer('amount_sent_cents', { mode: 'number' }),
    amountReceivedCents: integer('amount_received_cents', { mode: 'number' }),
    date: integer('date', { mode: 'number' }).notNull(),
    description: text('description'),
    transactionType: text('transaction_type').notNull(),
    expenseType: text('expense_type'),
    incomeType: text('income_type'),
    createdAt: integer('created_at', { mode: 'number' }).notNull().default(currentTimestamp),
    updatedAt: integer('updated_at', { mode: 'number' }).notNull().default(currentTimestamp),
  },
  (table) => ({
    userDateIdx: index('transactions_user_date_idx').on(table.userId, table.date),
    userAccountIdx: index('transactions_user_account_idx').on(table.userId, table.accountId),
    userCategoryIdx: index('transactions_user_category_idx').on(table.userId, table.categoryId),
  }),
);

export const recurringTransactions = sqliteTable(
  'recurring_transactions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    categoryId: text('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
    amountCents: integer('amount_cents', { mode: 'number' }).notNull(),
    description: text('description').notNull(),
    frequency: text('frequency').notNull(),
    startDate: integer('start_date', { mode: 'number' }).notNull(),
    createdAt: integer('created_at', { mode: 'number' }).notNull().default(currentTimestamp),
    updatedAt: integer('updated_at', { mode: 'number' }).notNull().default(currentTimestamp),
  },
  (table) => ({
    userIdx: index('recurring_user_idx').on(table.userId),
    scheduleIdx: index('recurring_schedule_idx').on(table.userId, table.startDate),
  }),
);

export const imports = sqliteTable(
  'imports',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    source: text('source').notNull(),
    status: text('status').notNull(),
    meta: text('meta'),
    createdAt: integer('created_at', { mode: 'number' }).notNull().default(currentTimestamp),
    updatedAt: integer('updated_at', { mode: 'number' }).notNull().default(currentTimestamp),
  },
  (table) => ({
    userIdx: index('imports_user_idx').on(table.userId),
    sourceIdx: index('imports_source_idx').on(table.source),
  }),
);

export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;

export type Account = InferSelectModel<typeof accounts>;
export type NewAccount = InferInsertModel<typeof accounts>;

export type Category = InferSelectModel<typeof categories>;
export type NewCategory = InferInsertModel<typeof categories>;

export type Budget = InferSelectModel<typeof budgets>;
export type NewBudget = InferInsertModel<typeof budgets>;

export type Transaction = InferSelectModel<typeof transactions>;
export type NewTransaction = InferInsertModel<typeof transactions>;

export type RecurringTransaction = InferSelectModel<typeof recurringTransactions>;
export type NewRecurringTransaction = InferInsertModel<typeof recurringTransactions>;

export type ImportJob = InferSelectModel<typeof imports>;
export type NewImportJob = InferInsertModel<typeof imports>;
