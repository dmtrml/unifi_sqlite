"use client"

import * as React from "react"
import { useUser } from "@/lib/auth-context"
import { useAccounts } from "@/hooks/use-accounts"
import { useCategories } from "@/hooks/use-categories"
import useSWR from "swr"
import { useUserProfile } from "@/hooks/use-user-profile"
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
import type { Currency, Transaction } from "@/lib/types"
import type { DateRange } from "react-day-picker"
import { DateRangePicker } from "@/components/reports/date-range-picker"
import { startOfYear, endOfYear } from "date-fns"
import { Timestamp } from "@/lib/timestamp"

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

  const startTimestamp = dateRange?.from ? dateRange.from.getTime() : undefined;
  const endTimestamp = dateRange?.to ? dateRange.to.getTime() : undefined;

  const fetcher = React.useCallback(async () => {
    if (!user) return [];
    const params = new URLSearchParams();
    if (startTimestamp) params.set('startDate', String(startTimestamp));
    if (endTimestamp) params.set('endDate', String(endTimestamp));
    const response = await fetch(`/api/reports/transactions?${params.toString()}`, {
      headers: {
        'Content-Type': 'application/json',
        'x-uid': user.uid,
      },
    });
    if (!response.ok) {
      throw new Error('Failed to load report transactions');
    }
    const payload = await response.json();
    return (payload.items ?? []).map((item: any) => ({
      ...item,
      date: Timestamp.fromMillis(item.date),
    }));
  }, [startTimestamp, endTimestamp, user]);

  const { data: reportTransactions, isLoading: transactionsLoading } = useSWR<Transaction[]>(
    user ? ['reports-transactions', user.uid, startTimestamp, endTimestamp] : null,
    fetcher,
  );

  const isLoading = transactionsLoading || categoriesLoading || accountsLoading || profileLoading;
  const mainCurrency = (profile?.mainCurrency ?? "USD") as Currency;

  const filteredTransactions = React.useMemo(() => {
    if (!reportTransactions) return [];
    if (!dateRange?.from || !dateRange?.to) {
      return reportTransactions;
    }
    const fromMs = dateRange.from.getTime();
    const toMs = dateRange.to.getTime();
    return reportTransactions.filter((transaction) => {
      const txDate =
        typeof (transaction.date as any)?.toMillis === "function"
          ? (transaction.date as any).toMillis()
          : transaction.date instanceof Date
          ? transaction.date.getTime()
          : 0;
      return txDate >= fromMs && txDate <= toMs;
    });
  }, [reportTransactions, dateRange]);

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h1 className="text-lg font-semibold md:text-2xl">Reports</h1>
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
                transactions={filteredTransactions} 
                accounts={accounts || []} 
                mainCurrency={mainCurrency}
                dateRange={dateRange}
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
                  transactions={filteredTransactions} 
                  categories={categories || []}
                  accounts={accounts || []}
                  mainCurrency={mainCurrency}
                  dateRange={dateRange}
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
                  transactions={filteredTransactions} 
                  categories={categories || []} 
                  accounts={accounts || []}
                  mainCurrency={mainCurrency}
                />
              </CardContent>
            </Card>
          </div>
        </div>
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
