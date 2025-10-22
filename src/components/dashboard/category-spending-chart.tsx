"use client"

import * as React from "react"
import { Pie, PieChart, Sector } from "recharts"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import type { Category, Transaction } from "@/lib/types"

type CategorySpendingChartProps = {
  transactions: Transaction[];
  categories: Category[];
}

export function CategorySpendingChart({ transactions, categories }: CategorySpendingChartProps) {
  const [activeCategory, setActiveCategory] =
    React.useState<string | null>(null)
  const id = "pie-interactive"

  const categorySpending = React.useMemo(() => {
    return categories.map(category => {
      const total = transactions
        .filter(expense => expense.categoryId === category.id && expense.transactionType === 'expense')
        .reduce((sum, expense) => sum + expense.amount, 0)
      return {
        category: category.name,
        total,
        fill: category.color,
      }
    }).filter(item => item.total > 0);
  }, [transactions, categories])

  const chartConfig = React.useMemo(() => {
    return categorySpending.reduce((acc, item) => {
      acc[item.category] = {
        label: item.category,
        color: item.fill,
      }
      return acc
    }, {} as ChartConfig)
  }, [categorySpending]);


  const activeIndex = React.useMemo(
    () => categorySpending.findIndex((item) => item.category === activeCategory),
    [activeCategory, categorySpending]
  )
  
  const totalSpent = React.useMemo(() => {
    return categorySpending.reduce((acc, curr) => acc + curr.total, 0)
  }, [categorySpending])

  if (categorySpending.length === 0) {
    return <div className="flex items-center justify-center h-[250px] text-muted-foreground">No spending data available.</div>
  }

  return (
    <ChartContainer
        config={chartConfig}
        id={id}
        className="mx-auto aspect-square h-[250px]"
      >
        <PieChart>
          <ChartTooltip
            cursor={false}
            content={<ChartTooltipContent hideLabel />}
          />
          <Pie
            data={categorySpending}
            dataKey="total"
            nameKey="category"
            innerRadius={60}
            strokeWidth={5}
            activeIndex={activeIndex}
            activeShape={({
              outerRadius = 0,
              ...props
            }) => (
              <g>
                <Sector {...props} outerRadius={outerRadius + 10} />
                <Sector
                  {...props}
                  outerRadius={outerRadius + 25}
                  innerRadius={outerRadius + 15}
                />
              </g>
            )}
            onMouseOver={(_, index) => {
              setActiveCategory(categorySpending[index].category)
            }}
            onMouseLeave={() => {
              setActiveCategory(null)
            }}
          />
        </PieChart>
      </ChartContainer>
  )
}
