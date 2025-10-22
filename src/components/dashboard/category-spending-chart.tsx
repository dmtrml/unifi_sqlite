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
import { expenses, categories } from "@/lib/data"

const categorySpending = categories.map(category => {
  const total = expenses
    .filter(expense => expense.categoryId === category.id)
    .reduce((sum, expense) => sum + expense.amount, 0)
  return {
    category: category.name,
    total,
    fill: category.color,
  }
}).filter(item => item.total > 0);


const chartConfig = categorySpending.reduce((acc, item) => {
  acc[item.category] = {
    label: item.category,
    color: item.fill,
  }
  return acc
}, {} as ChartConfig)

export function CategorySpendingChart() {
  const [activeCategory, setActiveCategory] =
    React.useState<string | null>(null)
  const id = "pie-interactive"
  const activeIndex = React.useMemo(
    () => categorySpending.findIndex((item) => item.category === activeCategory),
    [activeCategory]
  )
  
  const totalSpent = React.useMemo(() => {
    return categorySpending.reduce((acc, curr) => acc + curr.total, 0)
  }, [])

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
