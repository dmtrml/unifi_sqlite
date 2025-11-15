"use client"

import React from "react"
import { addMonths, endOfMonth, format, isAfter, min as minDateFn, max as maxDateFn, startOfMonth } from "date-fns"
import type { DateRange } from "react-day-picker"
import { Bar, BarChart, CartesianGrid, Legend, XAxis, YAxis } from "recharts"

import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import type { Currency, IncomeExpensePoint } from "@/lib/types"

type IncomeExpenseChartProps = {
  data: IncomeExpensePoint[];
  mainCurrency: Currency;
  dateRange?: DateRange;
  onSelectBucket?: (startDate: number, endDate: number, label: string) => void;
};

const chartConfig = {
  income: {
    label: "Income",
    color: "hsl(var(--chart-1))",
  },
  expense: {
    label: "Expense",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig;

const parseMonth = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return startOfMonth(date);
};

export function IncomeExpenseChart({ data, mainCurrency, dateRange, onSelectBucket }: IncomeExpenseChartProps) {
  const dataMap = React.useMemo(() => {
    const map = new Map<string, { income: number; expense: number }>();
    data.forEach((point) => {
      const parsed = parseMonth(point.month);
      if (!parsed) return;
      const key = format(parsed, "yyyy-MM-01");
      map.set(key, {
        income: point.income,
        expense: point.expense,
      });
    });
    return map;
  }, [data]);

  const normalizedRange = React.useMemo(() => {
    if (dateRange?.from) {
      const from = startOfMonth(dateRange.from);
      const to = endOfMonth(dateRange.to ?? dateRange.from);
      return { startDate: from, endDate: to };
    }

    const parsedDates = data
      .map((point) => parseMonth(point.month))
      .filter((value): value is Date => value instanceof Date);

    if (parsedDates.length > 0) {
      const minDate = startOfMonth(minDateFn(parsedDates));
      const maxDate = endOfMonth(maxDateFn(parsedDates));
      return { startDate: minDate, endDate: maxDate };
    }

    const today = new Date();
    const fallbackStart = startOfMonth(new Date(today.getFullYear(), 0, 1));
    const fallbackEnd = endOfMonth(new Date(today.getFullYear(), 11, 31));
    return { startDate: fallbackStart, endDate: fallbackEnd };
  }, [data, dateRange]);

  const chartData = React.useMemo(() => {
    const { startDate, endDate } = normalizedRange;
    const months: Date[] = [];
    let cursor = startDate;
    while (!isAfter(cursor, endDate)) {
      months.push(cursor);
      cursor = addMonths(cursor, 1);
    }

    return months.map((monthDate) => {
      const key = format(monthDate, "yyyy-MM-01");
      const entry = dataMap.get(key) ?? { income: 0, expense: 0 };
      return {
        month: format(monthDate, "MMM yyyy"),
        income: entry.income,
        expense: entry.expense,
        startDate: monthDate.getTime(),
        endDate: endOfMonth(monthDate).getTime(),
      };
    });
  }, [dataMap, normalizedRange]);

  const currencyFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: mainCurrency });

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
          tickFormatter={(value) => currencyFormatter.format(value).replace(/(\.00|,\d{2})$/, "")}
        />
        <XAxis
          dataKey="month"
          tickLine={false}
          tickMargin={10}
          axisLine={false}
          tickFormatter={(value) => (value as string).slice(0, 3)}
        />
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent formatter={(value) => currencyFormatter.format(value as number)} />}
        />
        <Legend />
        <Bar
          dataKey="income"
          fill="var(--color-income)"
          radius={8}
          onClick={(dataPoint) => {
            if (!onSelectBucket) return;
            onSelectBucket(dataPoint.startDate, dataPoint.endDate, dataPoint.month);
          }}
        />
        <Bar
          dataKey="expense"
          fill="var(--color-expense)"
          radius={8}
          onClick={(dataPoint) => {
            if (!onSelectBucket) return;
            onSelectBucket(dataPoint.startDate, dataPoint.endDate, dataPoint.month);
          }}
        />
      </BarChart>
    </ChartContainer>
  );
}
