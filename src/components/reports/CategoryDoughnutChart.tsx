"use client"

import * as React from "react"
import ReactECharts from "echarts-for-react"
import type { Category, Transaction } from "@/lib/types"

type CategoryDoughnutChartProps = {
  transactions: Transaction[];
  categories: Category[];
}

export function CategoryDoughnutChart({ transactions, categories }: CategoryDoughnutChartProps) {
  const chartData = React.useMemo(() => {
    const expenseCategories = categories.filter(c => c.type === 'expense' || !c.type);
    const items = expenseCategories.map(category => {
      const value = transactions
        .filter(t => t.transactionType === 'expense' && t.categoryId === category.id)
        .reduce((sum, t) => sum + (t.amount ?? 0), 0);
      return {
        name: category.name,
        value: value,
        itemStyle: {
          color: category.color
        }
      };
    }).filter(item => item.value > 0).sort((a, b) => b.value - a.value);

    const total = items.reduce((sum, item) => sum + item.value, 0);
    if (total === 0) {
      return [];
    }

    const MIN_PERCENT = 0.04; // 4%
    const MAX_SEGMENTS = 5;
    const grouped: typeof items = [];
    let otherTotal = 0;

    items.forEach((item) => {
      const percent = item.value / total;
      if (percent < MIN_PERCENT || grouped.length >= MAX_SEGMENTS) {
        otherTotal += item.value;
      } else {
        grouped.push(item);
      }
    });

    if (otherTotal > 0) {
      grouped.push({
        name: 'Other',
        value: otherTotal,
        itemStyle: {
          color: 'hsl(var(--muted))',
        },
      });
    }

    return grouped;
  }, [transactions, categories]);

  const totalExpenses = React.useMemo(() => {
    return chartData.reduce((sum, item) => sum + item.value, 0);
  }, [chartData]);
  
  if (chartData.length === 0) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">No expense data for this period.</div>;
  }

  const option = {
    tooltip: {
      trigger: 'item',
      formatter: '{b}: ${c} ({d}%)'
    },
    legend: {
      orient: 'vertical',
      left: 'left',
      data: chartData.map(item => item.name)
    },
    series: [
      {
        name: 'Expenses',
        type: 'pie',
        radius: ['50%', '70%'],
        avoidLabelOverlap: false,
        label: {
          show: false,
          position: 'center'
        },
        emphasis: {
          label: {
            show: true,
            fontSize: '20',
            fontWeight: 'bold'
          }
        },
        labelLine: {
          show: false
        },
        data: chartData,
        itemStyle: {
          borderRadius: 10,
          borderColor: 'hsl(var(--background))',
          borderWidth: 2
        },
        graphic: {
          elements: [
            {
              type: 'text',
              left: 'center',
              top: '45%',
              style: {
                text: 'Total Spent',
                fontSize: 14,
                fontWeight: 'normal',
                fill: 'hsl(var(--muted-foreground))'
              }
            },
            {
              type: 'text',
              left: 'center',
              top: '55%',
              style: {
                text: `$${totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                fontSize: 24,
                fontWeight: 'bold',
                fill: 'hsl(var(--foreground))'
              }
            }
          ]
        }
      }
    ]
  };

  return <ReactECharts option={option} style={{ height: 300 }} />;
}
