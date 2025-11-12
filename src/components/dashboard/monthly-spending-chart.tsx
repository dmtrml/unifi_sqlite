"use client"

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { format, getYear } from "date-fns"
import { fromZonedTime } from "date-fns-tz"
import React from "react"

import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import type { Transaction, Account, Currency } from "@/lib/types"
import { convertAmount } from "@/lib/currency"

type MonthlySpendingChartProps = {
  transactions: Transaction[];
  accounts: Account[];
  mainCurrency: Currency;
}

const chartConfig = {
  spending: {
    label: "Spending",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig

export function MonthlySpendingChart({ transactions, accounts, mainCurrency }: MonthlySpendingChartProps) {

  const chartData = React.useMemo(() => {
    const currentYear = getYear(new Date());
    const monthlySpending: { [key: string]: number } = {};

    for (let i = 0; i < 12; i++) {
        const monthName = format(new Date(currentYear, i), 'MMMM');
        monthlySpending[monthName] = 0;
    }
    
    const getAccountCurrency = (accountId?: string) => {
        return accounts.find(a => a.id === accountId)?.currency || 'USD';
    }

    transactions.forEach(transaction => {
      const jsDate = new Date(transaction.date.seconds * 1000);
      const transactionDate = fromZonedTime(jsDate, 'UTC');

      if (getYear(transactionDate) === currentYear && transaction.transactionType === 'expense') {
        const monthName = format(transactionDate, 'MMMM');
        const fromCurrency = getAccountCurrency(transaction.accountId);
        const convertedAmount = convertAmount(transaction.amount ?? 0, fromCurrency, mainCurrency);
        monthlySpending[monthName] += convertedAmount;
      }
    });

    return Object.keys(monthlySpending).map(month => ({
      month,
      spending: monthlySpending[month],
    }));

  }, [transactions, accounts, mainCurrency]);

  const currencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: mainCurrency });

  return (
    <ChartContainer config={chartConfig} className="min-h-[200px] w-full">
      <BarChart 
        accessibilityLayer 
        data={chartData}
        margin={{
            left: 12,
            right: 12,
        }}
      >
        <CartesianGrid vertical={false} />
        <YAxis 
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tickFormatter={(value) => currencyFormatter.format(value).replace(/(\.00|,\d{2})$/, '')}
        />
        <XAxis
          dataKey="month"
          tickLine={false}
          tickMargin={10}
          axisLine={false}
          tickFormatter={(value) => value.slice(0, 3)}
        />
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent 
            hideLabel 
            formatter={(value) => currencyFormatter.format(value as number)}
           />}
        />
        <Bar dataKey="spending" fill="var(--color-spending)" radius={8} />
      </BarChart>
    </ChartContainer>
  )
}
