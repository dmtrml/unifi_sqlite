"use client"

import * as React from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Progress } from "@/components/ui/progress"
import type { Category, Transaction } from "@/lib/types"

type CategoryBreakdownChartProps = {
  transactions: Transaction[];
  categories: Category[];
}

export function CategoryBreakdownChart({ transactions, categories }: CategoryBreakdownChartProps) {
  const categorySpending = React.useMemo(() => {
    const expenseTransactions = transactions.filter(t => t.transactionType === 'expense');
    const totalExpenses = expenseTransactions.reduce((sum, t) => sum + t.amount, 0);

    if (totalExpenses === 0) return [];

    return categories
      .filter(c => c.type === 'expense' || !c.type) // Only expense categories
      .map(category => {
        const total = expenseTransactions
          .filter(expense => expense.categoryId === category.id)
          .reduce((sum, expense) => sum + expense.amount, 0);
        
        const percentage = (total / totalExpenses) * 100;
        return {
          id: category.id,
          name: category.name,
          total,
          percentage,
          color: category.color,
        };
      })
      .filter(item => item.total > 0)
      .sort((a, b) => b.total - a.total); // Sort by most spent

  }, [transactions, categories]);

  if (categorySpending.length === 0) {
    return <div className="flex items-center justify-center h-40 text-muted-foreground">No expense data to display.</div>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[40%]">Category</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead className="w-[30%] text-right">Percentage</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {categorySpending.map((item) => (
          <TableRow key={item.id}>
            <TableCell className="font-medium">{item.name}</TableCell>
            <TableCell className="text-right">
              ${item.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </TableCell>
            <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                    <Progress value={item.percentage} className="h-2 w-24" indicatorColor={item.color} />
                    <span>{item.percentage.toFixed(2)}%</span>
                </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// Small modification to Progress component to accept custom color
declare module "react" {
  interface CSSProperties {
    '--indicator-color'?: string;
  }
}

(Progress as any).defaultProps = {
  ...Progress.defaultProps,
  indicatorColor: 'hsl(var(--primary))'
};

const OriginalProgress = Progress;
const CustomColorProgress = React.forwardRef<
  React.ElementRef<typeof OriginalProgress>,
  React.ComponentPropsWithoutRef<typeof OriginalProgress> & { indicatorColor?: string }
>(({ indicatorColor, ...props }, ref) => (
  <OriginalProgress
    ref={ref}
    {...props}
    indicatorStyle={{ backgroundColor: indicatorColor }}
  />
));
CustomColorProgress.displayName = "Progress";
