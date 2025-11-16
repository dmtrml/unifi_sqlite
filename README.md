# BudgetWise (Next.js + SQLite)

BudgetWise — личный финансовый менеджер на Next.js 15 (App Router) с локальной базой SQLite/Drizzle. Проект полностью избавлен от Firebase: все данные лежат в `.data/app.sqlite`, а в dev-режиме используется один фиксированный пользователь (`dev-user`).

## Требования

- Node.js **>= 20** (гарантированно работает на 20/22, иначе `better-sqlite3` не собирается).
- npm 9+.

## Быстрый старт

```bash
npm install
npm run db:migrate   # создаёт/обновляет таблицы в .data/app.sqlite
npm run dev          # Turbopack dev server (порт 9002)
```

Если база повреждена или нужно начать заново:

```bash
npm run db:reset     # rm -rf .data && drizzle-kit migrate
```

## Стек

- **Клиент:** Next.js 15 (App Router), React 18, TypeScript, shadcn/ui + Tailwind, SWR/SWR Infinite, date-fns, Recharts/ECharts, lucide-react.
- **Сервер / БД:** Next.js API routes, Drizzle ORM, better-sqlite3, SQLite (WAL). Миграции в `drizzle/`, схема в `src/server/db/schema.ts`.
- **Прочее:** CSV импорт, Mercado Pago API, dev-аутентификация (`src/lib/dev-user.ts`), утилиты уведомлений о транзакциях, DateRangePicker для отчётов.

## Основные разделы

- **Dashboard** (`/`) — суммарные KPI, графики доходов/расходов, диаграммы категорий.
- **Accounts** (`/accounts`) — список счетов; просмотр `/accounts/[id]` с вкладками Transactions/Analytics.
- **Transactions** (`/transactions`) — курсовая пагинация, фильтры (sheet), поиск, CRUD-диалоги.
- **Categories / Budgets / Recurring** — управление справочниками, бюджетами и рекуррентными операциями.
- **Import** (`/import`) — загрузка CSV, пресеты для ZenMoney/Monefy, автоматическое сопоставление колонок и поддержка мультивалютных переводов.
- **Reports** (`/reports`) — DateRangePicker, графики Income vs Expense, Spending by Category, Breakdown.
- **Settings** (`/settings`) — профиль (имя/email/валюта), локальное хранение темы, Mercado Pago статусы, экспорт CSV/JSON и полный JSON-бэкап (восстановление перезаписывает все пользовательские данные).
- **Delete data** — диалог, который чистит транзакции или все данные пользователя (`/api/data`).

## Аутентификация

Сейчас в dev используется `DevAuthProvider` (единственный пользователь `dev-user`). Для продакшена нужно внедрить реальную auth-систему (Auth.js/NextAuth/Clerk) и обновить `getUserIdOrThrow`, который сейчас просто смотрит на заголовок `x-uid`.

## Структура

- `src/app` — страницы и API (App Router).
- `src/components` — UI, layout, дашборд, отчётные виджеты, диалоги.
- `src/hooks` — клиентские SWR-хуки (`useAccounts`, `useTransactions`, `useUserProfile`, ...).
- `src/server/db` — Drizzle schema, репозитории и сервисы (`TransactionsService`, `AccountsRepository`, ...).
- `src/lib` — dev-user, currency/utils, контекст авторизации, события транзакций.
- `drizzle/` — SQL миграции.
- `docs/` — blueprint проекта и описание сущностей.

## Команды npm

- `npm run dev` — dev-сервер (Turbopack).
- `npm run build` / `npm start` — прод сборка и запуск.
- `npm run lint` — ESLint.
- `npm run typecheck` — `tsc --noEmit`.
- `npm run db:generate` — генерация миграции Drizzle.
- `npm run db:migrate` — применение миграций.
- `npm run db:reset` — очистка `.data` и запуск миграций заново.

## Известные ограничения / TODO

1. Реализовать полноценную аутентификацию вместо dev-заглушки и описать login-flow в README.
2. Оптимизировать отчётные эндпоинты (`/api/reports/transactions`) — добавить агрегации/лимиты, задокументировать Mercado Pago интеграцию.
3. Довести dashboard до финального дизайна (по аналогии с Monarch Money): перестроить карточки, добавить net worth/insights.
4. Добавить автотесты (unit/e2e) и CI (lint/typecheck) + описать процесс импорта CSV/Mercado Pago (пресеты, Auto map, обработку мультивалютных переводов).
5. Задокументировать dev-user/`DEV_USER_ID` и добавить сиды/примерные данные для быстрого старта.

С вопросами по настройке или расширению — см. комментарии внутри `src/server/db` и `src/hooks`, либо создавай issue/TODO.
