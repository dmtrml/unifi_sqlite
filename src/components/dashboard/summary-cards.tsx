"use client"

import { DollarSign, PiggyBank, Wallet, TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import type { Currency } from "@/lib/types";

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

  const cards = [
    {
      title: "Net Worth",
      amount: netWorth,
      icon: DollarSign,
      trend: totalIncome - totalExpenses,
      trendLabel: "net flow",
    },
    {
      title: "Income (period)",
      amount: totalIncome,
      icon: PiggyBank,
      trend: totalIncome ? (totalIncome - totalExpenses) / totalIncome : 0,
      trendLabel: "vs expenses",
    },
    {
      title: "Expenses (period)",
      amount: totalExpenses,
      icon: Wallet,
      trend: totalBudget ? totalExpenses / totalBudget : 0,
      trendLabel: totalBudget ? "of budget" : undefined,
    },
    {
      title: "Remaining Budget",
      amount: remainingBudget,
      icon: DollarSign,
      trend: totalBudget ? remainingBudget / totalBudget : 0,
      trendLabel: totalBudget ? "of total" : undefined,
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => {
        const trendPositive = card.trend >= 0;
        return (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              <card.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-2xl font-bold">{currencyFormatter.format(card.amount)}</div>
              {card.trendLabel && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  {trendPositive ? (
                    <TrendingUp className="h-3 w-3 text-emerald-500" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-destructive" />
                  )}
                  {Math.abs(card.trend * 100).toFixed(1)}% {trendPositive ? "↑" : "↓"} {card.trendLabel}
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
