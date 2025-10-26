"use client"

import * as React from "react"
import { Pie, PieChart, Sector, Cell } from "recharts"
import * as Icons from "lucide-react"

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

const RADIAN = Math.PI / 180;
const CustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, payload, percent, index }: any) => {
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


export function CategorySpendingChart({ transactions, categories }: CategorySpendingChartProps) {
  const [activeCategory, setActiveCategory] =
    React.useState<string | null>(null)
  const id = "pie-interactive"

  const categorySpending = React.useMemo(() => {
    return categories
    .filter(c => c.type === 'expense' || !c.type)
    .map(category => {
      const total = transactions
        .filter(expense => expense.categoryId === category.id && expense.transactionType === 'expense')
        .reduce((sum, expense) => sum + expense.amount, 0)
      return {
        category: category.name,
        total,
        fill: category.color,
        icon: category.icon,
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
            content={<ChartTooltipContent 
                formatter={(value, name) => [`$${(value as number).toFixed(2)}`, name]}
            />}
          />
          <Pie
            data={categorySpending}
            dataKey="total"
            nameKey="category"
            innerRadius={60}
            strokeWidth={5}
            labelLine={false}
            label={<CustomLabel />}
            activeIndex={activeIndex}
            activeShape={({
              outerRadius = 0,
              ...props
            }) => (
              <g>
                <Sector {...props} outerRadius={outerRadius + 10} />
              </g>
            )}
            onMouseOver={(_, index) => {
              setActiveCategory(categorySpending[index].category)
            }}
            onMouseLeave={() => {
              setActiveCategory(null)
            }}
          >
            {categorySpending.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
  )
}
