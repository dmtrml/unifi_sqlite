"use client"

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { format, getMonth, getYear } from "date-fns"

import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import type { Transaction } from "@/lib/types"
import React from "react"

type MonthlySpendingChartProps = {
  transactions: Transaction[];
}

const chartConfig = {
  spending: {
    label: "Spending",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig

export function MonthlySpendingChart({ transactions }: MonthlySpendingChartProps) {

  const chartData = React.useMemo(() => {
    const currentYear = getYear(new Date());
    const monthlySpending: { [key: string]: number } = {};

    for (let i = 0; i < 12; i++) {
        const monthName = format(new Date(currentYear, i), 'MMMM');
        monthlySpending[monthName] = 0;
    }

    transactions.forEach(transaction => {
      // Ensure transaction.date is a valid Date object
      const transactionDate = new Date(transaction.date);
      if (getYear(transactionDate) === currentYear && transaction.transactionType === 'expense') {
        const monthName = format(transactionDate, 'MMMM');
        monthlySpending[monthName] += transaction.amount;
      }
    });

    return Object.keys(monthlySpending).map(month => ({
      month,
      spending: monthlySpending[month],
    }));

  }, [transactions]);


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
            tickFormatter={(value) => `$${value}`}
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
          content={<ChartTooltipContent hideLabel />}
        />
        <Bar dataKey="spending" fill="var(--color-spending)" radius={8} />
      </BarChart>
    </ChartContainer>
  )
}
