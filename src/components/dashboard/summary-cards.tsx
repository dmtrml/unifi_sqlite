"use client"

import { DollarSign, PiggyBank, Wallet, TrendingUp, TrendingDown } from "lucide-react";
import type { Currency } from "@/lib/types";
import { cn } from "@/lib/utils";

type SummaryCardsProps = {
  totalBudget: number;
  totalExpenses: number;
  totalIncome: number;
  netWorth: number;
  currency: Currency;
};

export function SummaryCards({ totalBudget, totalExpenses, totalIncome, netWorth, currency }: SummaryCardsProps) {
  const remainingBudget = totalBudget - totalExpenses;
  const currencyFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency });
  const incomeVsExpense = totalIncome
    ? ((totalIncome - totalExpenses) / totalIncome) * 100
    : 0;
  const spendingOfBudget = totalBudget ? (totalExpenses / totalBudget) * 100 : null;
  const remainingOfBudget = totalBudget ? (remainingBudget / totalBudget) * 100 : null;

  const cards = [
    {
      title: "Net Worth",
      amount: netWorth,
      icon: DollarSign,
      accent: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
      meta: `${currencyFormatter.format(totalIncome - totalExpenses)} net flow`,
      trendValue: totalIncome - totalExpenses,
      trendIsPercent: false,
    },
    {
      title: "Income (period)",
      amount: totalIncome,
      icon: PiggyBank,
      accent: "bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300",
      meta: `${incomeVsExpense.toFixed(1)}% vs expenses`,
      trendValue: incomeVsExpense,
      trendIsPercent: true,
    },
    {
      title: "Expenses (period)",
      amount: totalExpenses,
      icon: Wallet,
      accent: "bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300",
      meta: spendingOfBudget != null ? `${spendingOfBudget.toFixed(1)}% of budget` : undefined,
      trendValue: spendingOfBudget ?? 0,
      trendIsPercent: true,
    },
    {
      title: "Remaining Budget",
      amount: remainingBudget,
      icon: DollarSign,
      accent: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
      meta:
        remainingOfBudget != null
          ? `${remainingOfBudget.toFixed(1)}% of total`
          : undefined,
      trendValue: remainingOfBudget ?? 0,
      trendIsPercent: true,
    },
  ];

  return (
    <div className="flex gap-3 overflow-x-auto pb-1">
      {cards.map((card) => (
        <div
          key={card.title}
          className="inline-flex min-w-[190px] flex-col justify-center border-r border-border/40 px-3 py-2 text-sm last:border-r-0"
        >
          <div className="flex items-center gap-2">
            <card.icon className={cn("h-3.5 w-3.5", card.accent)} />
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {card.title}
            </p>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-base font-semibold">
              {currencyFormatter.format(card.amount)}
            </p>
            {card.meta && (
              <span className="text-[11px] text-muted-foreground">{card.meta}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
