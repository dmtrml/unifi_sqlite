"use client"

import * as React from "react"
import { Pie, PieChart, Sector, Cell } from "recharts"
import * as Icons from "lucide-react"
import { startOfMonth, endOfMonth } from "date-fns"
import type { DateRange } from "react-day-picker"

import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import type { Category, Transaction, Account, Currency } from "@/lib/types"
import { convertAmount } from "@/lib/currency"

type CategorySpendingChartProps = {
  transactions: Transaction[];
  categories: Category[];
  accounts: Account[];
  mainCurrency: Currency;
  dateRange?: DateRange;
}

const RADIAN = Math.PI / 180;
const CustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, payload }: any) => {
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  const IconComponent = (Icons as any)[payload.icon] || Icons.MoreHorizontal;

  return (
    <g>
      <IconComponent
        x={x - 12}
        y={y - 12}
        width={24}
        height={24}
        color="white"
        strokeWidth={1.5}
      />
    </g>
  );
};

export function CategorySpendingChart({
  transactions,
  categories,
  accounts,
  mainCurrency,
  dateRange,
}: CategorySpendingChartProps) {
  const [activeCategory, setActiveCategory] = React.useState<string | null>(null);
  const id = "pie-interactive";

  const getAccountCurrency = React.useCallback(
    (accountId?: string) => accounts.find((a) => a.id === accountId)?.currency || "USD",
    [accounts],
  );

  const filteredTransactions = React.useMemo(() => {
    const now = new Date();
    let from = dateRange?.from;
    let to = dateRange?.to;

    if (!from || !to) {
      from = startOfMonth(now);
      to = endOfMonth(now);
    }

    const endDate = new Date(to);
    endDate.setHours(23, 59, 59, 999);

    return transactions.filter((t) => {
      if (t.transactionType !== "expense") return false;
      const transactionDate = t.date.toDate();
      return transactionDate >= from! && transactionDate <= endDate;
    });
  }, [transactions, dateRange]);

  const totalSpent = React.useMemo(
    () =>
      filteredTransactions.reduce((sum, t) => {
        const fromCurrency = getAccountCurrency(t.accountId);
        return sum + convertAmount(t.amount ?? 0, fromCurrency, mainCurrency);
      }, 0),
    [filteredTransactions, getAccountCurrency, mainCurrency],
  );

  const categorySpending = React.useMemo(() => {
    const spendingThreshold = totalSpent * 0.03;

    const allCategorySpending = categories
      .filter((c) => c.type === "expense" || !c.type)
      .map((category) => {
        const total = filteredTransactions
          .filter((expense) => expense.categoryId === category.id)
          .reduce((sum, expense) => {
            const fromCurrency = getAccountCurrency(expense.accountId);
            return sum + convertAmount(expense.amount ?? 0, fromCurrency, mainCurrency);
          }, 0);
        return {
          category: category.name,
          total,
          fill: category.color,
          icon: category.icon,
        };
      })
      .filter((item) => item.total > 0);

    const majorCategories = allCategorySpending.filter((item) => item.total >= spendingThreshold);
    const minorCategories = allCategorySpending.filter((item) => item.total < spendingThreshold);

    if (minorCategories.length > 1) {
      const otherTotal = minorCategories.reduce((sum, item) => sum + item.total, 0);
      majorCategories.push({
        category: "Other",
        total: otherTotal,
        fill: "hsl(var(--muted-foreground))",
        icon: "MoreHorizontal",
      });
    } else {
      majorCategories.push(...minorCategories);
    }

    return majorCategories.sort((a, b) => b.total - a.total);
  }, [filteredTransactions, categories, getAccountCurrency, mainCurrency, totalSpent]);

  const chartConfig = React.useMemo(() => {
    const config = categorySpending.reduce((acc, item) => {
      acc[item.category] = {
        label: item.category,
        color: item.fill,
      };
      return acc;
    }, {} as ChartConfig);

    if (categorySpending.some((item) => item.category === "Other")) {
      config["Other"] = {
        label: "Other",
        color: "hsl(var(--muted-foreground))",
      };
    }

    return config;
  }, [categorySpending]);

  const activeIndex = React.useMemo(
    () => categorySpending.findIndex((item) => item.category === activeCategory),
    [activeCategory, categorySpending],
  );

  const currencyFormatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: mainCurrency,
  });

  if (categorySpending.length === 0) {
    return (
      <div className="flex h-[250px] items-center justify-center text-muted-foreground">
        No spending data available for this period.
      </div>
    );
  }

  return (
    <ChartContainer config={chartConfig} id={id} className="mx-auto aspect-square h-full w-full">
      <PieChart>
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              formatter={(value, name) => {
                const percentage = totalSpent > 0 ? ((value as number) / totalSpent) * 100 : 0;
                return (
                  <div>
                    <div className="font-medium text-foreground">{name}</div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-lg font-bold">
                        {currencyFormatter.format(value as number)}
                      </span>
                      <span className="text-sm text-muted-foreground">({percentage.toFixed(2)}%)</span>
                    </div>
                  </div>
                );
              }}
            />
          }
        />
        <text
          x="50%"
          y="45%"
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-muted-foreground text-sm"
        >
          Total Spent
        </text>
        <text
          x="50%"
          y="55%"
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-foreground text-2xl font-bold"
        >
          {currencyFormatter.format(totalSpent)}
        </text>
        <Pie
          data={categorySpending}
          dataKey="total"
          nameKey="category"
          innerRadius="65%"
          outerRadius="85%"
          strokeWidth={5}
          labelLine={false}
          label={<CustomLabel />}
          activeIndex={activeIndex}
          activeShape={({ outerRadius = 0, ...props }) => (
            <g>
              <Sector {...props} outerRadius={outerRadius + 10} />
            </g>
          )}
          onMouseOver={(_, index) => {
            setActiveCategory(categorySpending[index].category);
          }}
          onMouseLeave={() => {
            setActiveCategory(null);
          }}
        >
          {categorySpending.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.fill} />
          ))}
        </Pie>
      </PieChart>
    </ChartContainer>
  );
}
