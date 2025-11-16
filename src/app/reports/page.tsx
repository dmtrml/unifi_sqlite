"use client"

import * as React from "react"
import { useUser } from "@/lib/auth-context"
import { useAccounts } from "@/hooks/use-accounts"
import { useCategories } from "@/hooks/use-categories"
import useSWR from "swr"
import { useUserProfile } from "@/hooks/use-user-profile"
import { useTransactions, type UseTransactionsFilters } from "@/hooks/use-transactions"
import AppLayout from "@/components/layout"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { IncomeExpenseChart } from "@/components/reports/IncomeExpenseChart"
import { CategoryBreakdownChart } from "@/components/reports/CategoryBreakdownChart"
import { CategorySpendingChart } from "@/components/dashboard/category-spending-chart"
import { Skeleton } from "@/components/ui/skeleton"
import type { CategorySummaryItem, Currency, IncomeExpensePoint, Transaction } from "@/lib/types"
import type { DateRange } from "react-day-picker"
import { DateRangePicker } from "@/components/reports/date-range-picker"
import { startOfYear, endOfYear } from "date-fns"
import { getCategoryRootId, getCategoryWithDescendants } from "@/lib/category-tree"

type DetailFilters = UseTransactionsFilters & { title: string };
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-80 w-full" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-96 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    </div>
  )
}

function ReportsPageContent() {
  const { user } = useUser()
  const { accounts, isLoading: accountsLoading } = useAccounts();
  const { categories, isLoading: categoriesLoading } = useCategories();
  const { profile, isLoading: profileLoading } = useUserProfile();
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>({
    from: startOfYear(new Date()),
    to: endOfYear(new Date()),
  });
  const [detailFilters, setDetailFilters] = React.useState<DetailFilters | null>(null);
  const [isDetailOpen, setIsDetailOpen] = React.useState(false);

  const normalizeStart = (date?: Date) => {
    if (!date) return undefined;
    const copy = new Date(date);
    copy.setHours(0, 0, 0, 0);
    return copy.getTime();
  };

  const normalizeEnd = (date?: Date) => {
    if (!date) return undefined;
    const copy = new Date(date);
    copy.setHours(23, 59, 59, 999);
    return copy.getTime();
  };

  const startTimestamp = normalizeStart(dateRange?.from);
  const endTimestamp = normalizeEnd(dateRange?.to);

  const incomeExpenseFetcher = React.useCallback(async () => {
    if (!user) return { items: [] as IncomeExpensePoint[] };
    const params = new URLSearchParams();
    if (startTimestamp) params.set('startDate', String(startTimestamp));
    if (endTimestamp) params.set('endDate', String(endTimestamp));
    const response = await fetch(`/api/reports/income-expense?${params.toString()}`, {
      headers: {
        'Content-Type': 'application/json',
        'x-uid': user.uid,
      },
    });
    if (!response.ok) {
      throw new Error('Failed to load income vs expense data');
    }
    return response.json();
  }, [startTimestamp, endTimestamp, user]);

  const categorySummaryFetcher = React.useCallback(async () => {
    if (!user) return { items: [] as CategorySummaryItem[], total: 0 };
    const params = new URLSearchParams();
    if (startTimestamp) params.set('startDate', String(startTimestamp));
    if (endTimestamp) params.set('endDate', String(endTimestamp));
    const response = await fetch(`/api/reports/categories?${params.toString()}`, {
      headers: {
        'Content-Type': 'application/json',
        'x-uid': user.uid,
      },
    });
    if (!response.ok) {
      throw new Error('Failed to load category breakdown');
    }
    return response.json();
  }, [startTimestamp, endTimestamp, user]);

  const { data: incomeExpenseData, isLoading: incomeExpenseLoading } = useSWR<{ items: IncomeExpensePoint[] }>(
    user ? ['reports-income-expense', user.uid, startTimestamp, endTimestamp] : null,
    incomeExpenseFetcher,
  );

  const { data: categorySummary, isLoading: categorySummaryLoading } = useSWR<{ items: CategorySummaryItem[]; total: number }>(
    user ? ['reports-categories', user.uid, startTimestamp, endTimestamp] : null,
    categorySummaryFetcher,
  );

  const isLoading = profileLoading || incomeExpenseLoading || categorySummaryLoading || accountsLoading || categoriesLoading;
  const mainCurrency = (profile?.mainCurrency ?? "USD") as Currency;
  const incomeExpenseSeries = incomeExpenseData?.items ?? [];
  const summaryItems = categorySummary?.items;
  const categoryItems = React.useMemo(() => summaryItems ?? [], [summaryItems]);
  const categoryTotal = categorySummary?.total ?? 0;
  const aggregatedCategoryItems = React.useMemo(() => {
    if (!categories?.length) return categoryItems;
    const byId = new Map(categories.map((category) => [category.id, category]));
    const map = new Map<string, CategorySummaryItem>();
    categoryItems.forEach((item) => {
      if (!item.categoryId) {
        const uncategorized = map.get('uncategorized') ?? {
          categoryId: null,
          name: item.name,
          color: item.color,
          icon: item.icon,
          total: 0,
        };
        uncategorized.total += item.total;
        map.set('uncategorized', uncategorized);
        return;
      }
      const rootId = getCategoryRootId(item.categoryId, categories) ?? item.categoryId;
      const rootMeta = byId.get(rootId);
      const key = rootId;
      const entry =
        map.get(key) ??
        {
          categoryId: rootId,
          name: rootMeta?.name ?? item.name,
          color: rootMeta?.color ?? item.color,
          icon: rootMeta?.icon ?? item.icon,
          total: 0,
        };
      entry.total += item.total;
      map.set(key, entry);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [categories, categoryItems]);
  const categoryChildrenMap = React.useMemo(() => {
    if (!categories?.length) return {};
    const map = new Map<string, CategorySummaryItem[]>();
    categoryItems.forEach((item) => {
      if (!item.categoryId) return;
      const rootId = getCategoryRootId(item.categoryId, categories);
      if (!rootId || rootId === item.categoryId) return;
      const bucket = map.get(rootId) ?? [];
      bucket.push(item);
      map.set(rootId, bucket);
    });
    return Object.fromEntries(map);
  }, [categories, categoryItems]);
  const openDetail = React.useCallback((filters: DetailFilters) => {
    setDetailFilters(filters);
    setIsDetailOpen(true);
  }, []);
  const handleCategorySelect = React.useCallback(
    (categoryId: string | null, name: string) => {
      const descendantIds =
        categoryId && categories?.length
          ? getCategoryWithDescendants(categoryId, categories)
          : undefined;
      openDetail({
        startDate: startTimestamp,
        endDate: endTimestamp,
        categoryId: categoryId ?? undefined,
        categoryIds: descendantIds,
        includeUncategorized: !categoryId,
        transactionType: "expense",
        title: `Transactions in ${name}`,
        sort: "desc",
      });
    },
    [categories, endTimestamp, openDetail, startTimestamp],
  );

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
      <div className="flex flex-col items-start gap-3 md:flex-row md:items-center md:justify-end">
        <DateRangePicker dateRange={dateRange} onDateChange={setDateRange} />
      </div>
      
  {isLoading ? (
        <LoadingSkeleton />
      ) : (
        <div className="grid grid-cols-1 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Income vs. Expense</CardTitle>
              <CardDescription>
                Monthly income and expense totals for the selected range (defaulting to the current year) in {mainCurrency}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <IncomeExpenseChart
                data={incomeExpenseSeries}
                mainCurrency={mainCurrency}
                dateRange={dateRange}
                onSelectBucket={(start, end, label) => {
                  openDetail({
                    startDate: start,
                    endDate: end,
                    title: `Transactions for ${label}`,
                    sort: "desc",
                  });
                }}
              />
            </CardContent>
          </Card>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle>Spending by Category</CardTitle>
                <CardDescription>
                  Spending breakdown for the currently selected period in {mainCurrency}.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CategorySpendingChart
                  data={aggregatedCategoryItems}
                  total={categoryTotal}
                  mainCurrency={mainCurrency}
                  childrenMap={categoryChildrenMap}
                  onSelectCategory={handleCategorySelect}
                />
              </CardContent>
            </Card>
            
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle>Expense Breakdown by Category</CardTitle>
                <CardDescription>
                  Expense distribution by category for the selected period, displayed in {mainCurrency}.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CategoryBreakdownChart
                  data={aggregatedCategoryItems}
                  total={categoryTotal}
                  mainCurrency={mainCurrency}
                  childrenMap={categoryChildrenMap}
                  onSelectCategory={handleCategorySelect}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      )}
      {detailFilters && (
        <TransactionsDetailDialog
          open={isDetailOpen}
          onOpenChange={setIsDetailOpen}
          filters={detailFilters}
          accounts={accounts || []}
          categories={categories || []}
          mainCurrency={mainCurrency}
        />
      )}
    </main>
  );
}

export default function ReportsPage() {
  return (
    <AppLayout>
      <ReportsPageContent />
    </AppLayout>
  )
}

type TransactionsDetailDialogProps = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  filters: DetailFilters;
  accounts: NonNullable<ReturnType<typeof useAccounts>['accounts']>;
  categories: NonNullable<ReturnType<typeof useCategories>['categories']>;
  mainCurrency: Currency;
};

function TransactionsDetailDialog({ open, onOpenChange, filters, accounts, categories, mainCurrency }: TransactionsDetailDialogProps) {
  const { transactions, isLoading, loadMore, hasMore, isLoadingMore } = useTransactions(filters);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>{filters.title}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[70vh] overflow-y-auto">
          <TransactionsTable
            transactions={transactions}
            accounts={accounts}
            categories={categories}
            mainCurrency={mainCurrency}
          />
          {isLoading && <p className="text-sm text-muted-foreground mt-4">Loading transactions...</p>}
          {!isLoading && transactions.length === 0 && (
            <p className="py-6 text-center text-muted-foreground">No transactions found for the selected filters.</p>
          )}
        </div>
        {hasMore && (
          <div className="flex justify-end gap-2 pt-2">
            <Button onClick={() => loadMore()} disabled={isLoadingMore}>
              {isLoadingMore ? "Loading..." : "Load more"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

type TransactionsTableProps = {
  transactions: Transaction[];
  accounts: NonNullable<ReturnType<typeof useAccounts>['accounts']>;
  categories: NonNullable<ReturnType<typeof useCategories>['categories']>;
  mainCurrency: Currency;
};

function TransactionsTable({ transactions, accounts, categories, mainCurrency }: TransactionsTableProps) {
  const accountMap = React.useMemo(() => new Map(accounts.map((account) => [account.id, account])), [accounts]);
  const categoryMap = React.useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );

  const formatAmount = (value: number, currency?: string | null) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: currency ?? mainCurrency }).format(value);

  const getAmountDisplay = (transaction: Transaction) => {
    if (transaction.transactionType === 'transfer') {
      const fromAccount = transaction.fromAccountId ? accountMap.get(transaction.fromAccountId) : null;
      const toAccount = transaction.toAccountId ? accountMap.get(transaction.toAccountId) : null;
      const sent = transaction.amountSent ?? transaction.amount ?? 0;
      const received = transaction.amountReceived ?? transaction.amount ?? 0;
      return `${formatAmount(sent, fromAccount?.currency ?? mainCurrency)} → ${formatAmount(received, toAccount?.currency ?? mainCurrency)}`;
    }

    const account = transaction.accountId ? accountMap.get(transaction.accountId) : null;
    const amount = transaction.amount ?? 0;
    return formatAmount(amount, account?.currency ?? mainCurrency);
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Description</TableHead>
          <TableHead>Account</TableHead>
          <TableHead className="text-right">Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {transactions.map((transaction) => {
          const date =
            typeof (transaction.date as any)?.toDate === 'function'
              ? (transaction.date as any).toDate()
              : new Date(
                  typeof (transaction.date as any)?.seconds === 'number'
                    ? (transaction.date as any).seconds * 1000
                    : (transaction.date as any),
                );
          const category = transaction.categoryId ? categoryMap.get(transaction.categoryId) : null;
          const account =
            transaction.accountId && accountMap.get(transaction.accountId)
              ? accountMap.get(transaction.accountId)
              : transaction.toAccountId
              ? accountMap.get(transaction.toAccountId)
              : null;

          return (
            <TableRow key={transaction.id}>
              <TableCell>{Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString()}</TableCell>
              <TableCell>
                {category?.name ?? (transaction.transactionType === 'transfer' ? 'Transfer' : 'Uncategorized')}
              </TableCell>
              <TableCell>{transaction.description ?? '—'}</TableCell>
              <TableCell>{account?.name ?? '—'}</TableCell>
              <TableCell className="text-right font-medium">{getAmountDisplay(transaction)}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
