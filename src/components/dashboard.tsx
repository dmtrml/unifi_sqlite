"use client"
import * as React from "react"
import { useUser } from "@/lib/auth-context"
import { convertAmount } from "@/lib/currency"
import type { Currency } from "@/lib/types"
import { useDashboardSnapshot } from "@/hooks/use-dashboard-snapshot"

import { SummaryCards } from "./dashboard/summary-cards"
import { Skeleton } from "./ui/skeleton"
import { MiniTransactionsCard } from "./dashboard/mini-transactions-card"
import { MiniAccountsCard } from "./dashboard/mini-accounts-card"

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
    </div>
  )
}

export default function Dashboard() {
  const { user } = useUser()
  const { snapshot, isLoading } = useDashboardSnapshot();

  const mainCurrency = (snapshot?.profile?.mainCurrency ?? "USD") as Currency;

  const { totalIncome, totalExpenses, totalBudget } = React.useMemo(() => {
    if (!snapshot) {
      return { totalIncome: 0, totalExpenses: 0, totalBudget: 0 };
    }

    const getAccountCurrency = (accountId?: string) => {
        return snapshot.accounts.find(a => a.id === accountId)?.currency || mainCurrency;
    }

    const totalIncome = snapshot.transactions
      .filter(t => t.transactionType === 'income')
      .reduce((acc, t) => {
        const fromCurrency = getAccountCurrency(t.accountId);
        return acc + convertAmount(t.amount ?? 0, fromCurrency, mainCurrency);
      }, 0);

    const totalExpenses = snapshot.transactions
      .filter(t => t.transactionType === 'expense')
      .reduce((acc, t) => {
        const fromCurrency = getAccountCurrency(t.accountId);
        return acc + convertAmount(t.amount ?? 0, fromCurrency, mainCurrency);
      }, 0);

    const totalBudget = snapshot.budgets.reduce((acc, b) => {
        const budgetCurrency = b.currency || mainCurrency;
        return acc + convertAmount(b.amount, budgetCurrency, mainCurrency);
    }, 0);

    return { totalIncome, totalExpenses, totalBudget };

  }, [snapshot, mainCurrency]);

  const netWorth = React.useMemo(() => {
    if (!snapshot) return 0;
    return snapshot.accounts.reduce((acc, account) => {
      return acc + convertAmount(account.balance, account.currency, mainCurrency);
    }, 0);
  }, [snapshot, mainCurrency]);

  if (!user) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        Please sign in to view your dashboard.
      </div>
    )
  }

  if (isLoading || !snapshot) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="grid gap-4 md:gap-8">
      <SummaryCards
        totalBudget={totalBudget}
        totalExpenses={totalExpenses}
        totalIncome={totalIncome}
        netWorth={netWorth}
        currency={mainCurrency}
      />
      <div className="grid gap-4 md:grid-cols-2">
        <MiniTransactionsCard
          transactions={snapshot.transactions}
          categories={snapshot.categories}
          accounts={snapshot.accounts}
          currency={mainCurrency}
        />
        <MiniAccountsCard accounts={snapshot.accounts} transactions={snapshot.transactions} />
      </div>
    </div>
  )
}
