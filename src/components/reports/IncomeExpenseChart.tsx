"use client"

import { Bar, BarChart, CartesianGrid, Legend, XAxis, YAxis } from "recharts"
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
  income: {
    label: "Income",
    color: "hsl(var(--chart-1))",
  },
  expense: {
    label: "Expense",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig

export function IncomeExpenseChart({ transactions, accounts, mainCurrency }: MonthlySpendingChartProps) {

  const chartData = React.useMemo(() => {
    const currentYear = getYear(new Date());
    const monthlyData: { [key: string]: { income: number; expense: number } } = {};

    for (let i = 0; i < 12; i++) {
        const monthName = format(new Date(currentYear, i), 'MMMM');
        monthlyData[monthName] = { income: 0, expense: 0 };
    }

    const getAccountCurrency = (accountId?: string) => {
        return accounts.find(a => a.id === accountId)?.currency || 'USD';
    }

    transactions.forEach(transaction => {
      const jsDate = new Date(transaction.date.seconds * 1000);
      const transactionDate = fromZonedTime(jsDate, 'UTC');

      if (getYear(transactionDate) === currentYear) {
        const monthName = format(transactionDate, 'MMMM');
        const fromCurrency = getAccountCurrency(transaction.accountId);
        const convertedAmount = convertAmount(transaction.amount ?? 0, fromCurrency, mainCurrency);

        if (transaction.transactionType === 'income') {
          monthlyData[monthName].income += convertedAmount;
        } else if (transaction.transactionType === 'expense') {
          monthlyData[monthName].expense += convertedAmount;
        }
      }
    });

    return Object.keys(monthlyData).map(month => ({
      month,
      income: monthlyData[month].income,
      expense: monthlyData[month].expense,
    }));

  }, [transactions, accounts, mainCurrency]);
  
  const currencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: mainCurrency });

  return (
    <ChartContainer config={chartConfig} className="min-h-[300px] w-full">
      <BarChart 
        accessibilityLayer 
        data={chartData}
        margin={{
            top: 20,
            left: -10,
            right: 20,
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
            formatter={(value) => currencyFormatter.format(value as number)}
          />}
        />
        <Legend />
        <Bar dataKey="income" fill="var(--color-income)" radius={8} />
        <Bar dataKey="expense" fill="var(--color-expense)" radius={8} />
      </BarChart>
    </ChartContainer>
  )
}
