"use client"

import { Bar, BarChart, CartesianGrid, Legend, XAxis, YAxis } from "recharts"
import { format } from "date-fns"
import React from "react"

import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import type { Transaction, Account, Currency } from "@/lib/types"
import { convertAmount } from "@/lib/currency"
import type { DateRange } from "react-day-picker"
import { startOfMonth, endOfMonth, addMonths, isAfter, isWithinInterval, min as minDateFn, max as maxDateFn } from "date-fns"

type MonthlySpendingChartProps = {
  transactions: Transaction[];
  accounts: Account[];
  mainCurrency: Currency;
  dateRange?: DateRange;
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

const toMillis = (dateValue: Transaction["date"]) => {
  const anyDate = dateValue as any;
  if (typeof anyDate?.toMillis === "function") {
    return anyDate.toMillis();
  }
  if (typeof anyDate?.seconds === "number") {
    return anyDate.seconds * 1000;
  }
  if (anyDate instanceof Date) {
    return anyDate.getTime();
  }
  return 0;
};

export function IncomeExpenseChart({ transactions, accounts, mainCurrency, dateRange }: MonthlySpendingChartProps) {
  const normalizedRange = React.useMemo(() => {
    if (dateRange?.from) {
      const from = startOfMonth(dateRange.from);
      const to = endOfMonth(dateRange.to ?? dateRange.from);
      return { startDate: from, endDate: to };
    }

    if (transactions.length > 0) {
      const dates = transactions
        .map((tx) => {
          const millis = toMillis(tx.date);
          return Number.isFinite(millis) ? new Date(millis) : null;
        })
        .filter((value): value is Date => value instanceof Date);

      if (dates.length) {
        const minDate = startOfMonth(minDateFn(dates));
        const maxDate = endOfMonth(maxDateFn(dates));
        return { startDate: minDate, endDate: maxDate };
      }
    }

    const today = new Date();
    const fallbackStart = startOfMonth(new Date(today.getFullYear(), 0, 1));
    const fallbackEnd = endOfMonth(new Date(today.getFullYear(), 11, 31));
    return { startDate: fallbackStart, endDate: fallbackEnd };
  }, [dateRange, transactions]);

  const chartData = React.useMemo(() => {
    const { startDate, endDate } = normalizedRange;

    const months: Date[] = [];
    let cursor = startDate;
    while (!isAfter(cursor, endDate)) {
      months.push(cursor);
      cursor = addMonths(cursor, 1);
    }

    const monthlyData: Record<string, { income: number; expense: number }> = {};
    months.forEach((monthDate) => {
      const key = format(monthDate, 'MMM yyyy');
      monthlyData[key] = { income: 0, expense: 0 };
    });

    const getAccountCurrency = (accountId?: string) => {
      return accounts.find(a => a.id === accountId)?.currency || 'USD';
    }

    transactions.forEach(transaction => {
      const millis = toMillis(transaction.date);
      const transactionDate = new Date(millis);
      if (!isWithinInterval(transactionDate, { start: startDate, end: endDate })) {
        return;
      }
      const monthKey = format(startOfMonth(transactionDate), 'MMM yyyy');
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { income: 0, expense: 0 };
      }
      const fromCurrency = getAccountCurrency(transaction.accountId);
      const convertedAmount = convertAmount(transaction.amount ?? 0, fromCurrency, mainCurrency);

      if (transaction.transactionType === 'income') {
        monthlyData[monthKey].income += convertedAmount;
      } else if (transaction.transactionType === 'expense') {
        monthlyData[monthKey].expense += convertedAmount;
      }
    });

    return months.map((monthDate) => {
      const key = format(monthDate, 'MMM yyyy');
      return {
        month: key,
        income: monthlyData[key]?.income ?? 0,
        expense: monthlyData[key]?.expense ?? 0,
      };
    });

  }, [transactions, accounts, mainCurrency, normalizedRange]);
  
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
