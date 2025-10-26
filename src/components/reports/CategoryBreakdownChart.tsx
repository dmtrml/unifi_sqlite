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
import type { Category, Transaction, Account, Currency } from "@/lib/types"
import { convertAmount } from "@/lib/currency"

type CategoryBreakdownChartProps = {
  transactions: Transaction[];
  categories: Category[];
  accounts: Account[];
  mainCurrency: Currency;
}

export function CategoryBreakdownChart({ transactions, categories, accounts, mainCurrency }: CategoryBreakdownChartProps) {
  
  const getAccountCurrency = React.useCallback((accountId?: string) => {
    return accounts.find(a => a.id === accountId)?.currency || 'USD';
  }, [accounts]);

  const categorySpending = React.useMemo(() => {
    const expenseTransactions = transactions.filter(t => t.transactionType === 'expense');
    const totalExpenses = expenseTransactions.reduce((sum, t) => {
      const fromCurrency = getAccountCurrency(t.accountId);
      return sum + convertAmount(t.amount, fromCurrency, mainCurrency);
    }, 0);

    if (totalExpenses === 0) return [];

    return categories
      .filter(c => c.type === 'expense' || !c.type)
      .map(category => {
        const total = expenseTransactions
          .filter(expense => expense.categoryId === category.id)
          .reduce((sum, expense) => {
            const fromCurrency = getAccountCurrency(expense.accountId);
            return sum + convertAmount(expense.amount, fromCurrency, mainCurrency);
          }, 0);
        
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
      .sort((a, b) => b.total - a.total);

  }, [transactions, categories, getAccountCurrency, mainCurrency]);
  
  const currencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: mainCurrency });

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
              {currencyFormatter.format(item.total)}
            </TableCell>
            <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                    <Progress value={item.percentage} className="h-2 w-24" style={{ '--indicator-color': item.color } as React.CSSProperties} />
                    <span>{item.percentage.toFixed(2)}%</span>
                </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
