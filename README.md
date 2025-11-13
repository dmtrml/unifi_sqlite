# BudgetWise (Next.js + SQLite)

BudgetWise — это финансовое приложение на Next.js 15 (App Router) с серверной частью на SQLite + Drizzle ORM и dev-аутентификацией (фиксированный пользователь). Firebase удалён, все данные хранятся локально в `.data/app.sqlite`.

## Запуск и разработка

```bash
npm install
npm run db:migrate   # создаёт таблицы, если база новая
npm run dev
```

Если база повреждена или нужно начать «с нуля»:

```bash
npm run db:reset     # удаляет .data и снова прогоняет миграции
```

## Основные возможности

- Учёт транзакций (расходы/доходы/переводы), категории, счета, бюджеты, рекуррентные операции.
- Серверная пагинация с курсором и поиск по описанию транзакций.
- Импорт CSV и интеграция Mercado Pago.
- UI: shadcn/ui + Tailwind, графики на Recharts, данные через SWR/SWR Infinite.

## Структура

- `src/app` — страницы/роуты Next.js (App Router).
- `src/server/db` — Drizzle ORM: схема, репозитории, сервисы.
- `src/hooks` — клиентские хуки (SWR/SWR Infinite).
- `drizzle/` — SQL миграции (`0000_eminent_quicksilver.sql`).

## Аутентификация

В dev-режиме используется `DevAuthProvider` с фиксированным пользователем. Для продакшена нужно внедрить реальную auth-систему (cookie/NextAuth/JWT) и обновить `getUserIdOrThrow`.

## Полезные команды

- `npm run dev` — запуск с Turbopack.
- `npm run lint` — ESLint.
- `npm run typecheck` — `tsc --noEmit`.
- `npm run db:generate` — генерация миграций Drizzle.
- `npm run db:migrate` — применение миграций.
- `npm run db:reset` — пересоздание базы (удаляет `.data`, затем `migrate`).
