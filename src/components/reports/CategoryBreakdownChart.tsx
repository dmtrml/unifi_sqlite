"use client"

import * as React from "react"
import * as Icons from "lucide-react"
import type { LucideIcon } from "lucide-react"

import type { Category, Transaction, Account, Currency } from "@/lib/types"
import { convertAmount } from "@/lib/currency"
import { Progress } from "@/components/ui/progress"

type CategoryBreakdownChartProps = {
  transactions: Transaction[];
  categories: Category[];
  accounts: Account[];
  mainCurrency: Currency;
}

export function CategoryBreakdownChart({
  transactions,
  categories,
  accounts,
  mainCurrency,
}: CategoryBreakdownChartProps) {
  const getAccountCurrency = React.useCallback(
    (accountId?: string) => accounts.find((a) => a.id === accountId)?.currency || "USD",
    [accounts],
  );

  const expenseTransactions = React.useMemo(
    () => transactions.filter((t) => t.transactionType === "expense"),
    [transactions],
  );

  const categorySpending = React.useMemo(() => {
    const totalExpenses = expenseTransactions.reduce((sum, t) => {
      const fromCurrency = getAccountCurrency(t.accountId);
      return sum + convertAmount(t.amount ?? 0, fromCurrency, mainCurrency);
    }, 0);

    if (totalExpenses === 0) return [];

    return categories
      .filter((category) => category.type === "expense" || !category.type)
      .map((category) => {
        const total = expenseTransactions
          .filter((expense) => expense.categoryId === category.id)
          .reduce((sum, expense) => {
            const fromCurrency = getAccountCurrency(expense.accountId);
            return sum + convertAmount(expense.amount ?? 0, fromCurrency, mainCurrency);
          }, 0);

        const percentage = (total / totalExpenses) * 100;
        return {
          id: category.id,
          name: category.name,
          total,
          percentage,
          icon: category.icon,
          color: category.color,
        };
      })
      .filter((item) => item.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [expenseTransactions, categories, getAccountCurrency, mainCurrency]);

  const currencyFormatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: mainCurrency,
  });

  if (categorySpending.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-muted-foreground">
        No expense data to display.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {categorySpending.map((item) => {
        const IconComponent = (Icons[item.icon as keyof typeof Icons] ?? Icons.MoreHorizontal) as LucideIcon;
        return (
          <div key={item.id} className="space-y-1">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <IconComponent className="h-4 w-4" style={{ color: item.color }} />
                <span className="font-medium">{item.name}</span>
              </div>
              <span className="font-semibold">{currencyFormatter.format(item.total)}</span>
            </div>
            <div className="relative h-4">
              <Progress
                value={item.percentage}
                className="absolute top-1/2 h-2 w-full -translate-y-1/2"
                style={{ "--indicator-color": item.color } as React.CSSProperties}
              />
              <span
                className="absolute text-xs font-semibold text-muted-foreground"
                style={{
                  left: `calc(${Math.min(item.percentage, 95)}% + 4px)`,
                  top: "50%",
                  transform: "translateY(-50%)",
                }}
              >
                {item.percentage.toFixed(0)}%
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
