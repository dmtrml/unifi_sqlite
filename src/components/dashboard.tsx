"use client"
import * as React from "react"
import { collection, query } from "firebase/firestore"
import { useCollection, useFirestore, useUser, useMemoFirebase } from "@/firebase"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import type { Budget, Category, Transaction, Account } from "@/lib/types"

import { MonthlySpendingChart } from "./dashboard/monthly-spending-chart"
import { CategorySpendingChart } from "./dashboard/category-spending-chart"
import { SummaryCards } from "./dashboard/summary-cards"
import { Progress } from "./ui/progress"
import { Skeleton } from "./ui/skeleton"

function getCategoryName(categories: Category[], categoryId: string) {
  return categories.find(c => c.id === categoryId)?.name ?? "Uncategorized"
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Skeleton className="col-span-4 h-80" />
        <Skeleton className="col-span-3 h-80" />
      </div>
      <Skeleton className="h-64" />
    </div>
  )
}


export default function Dashboard() {
  const { user, isUserLoading } = useUser()
  const firestore = useFirestore()
  
  // Memoize Firestore queries
  const transactionsQuery = useMemoFirebase(() => 
    user ? query(collection(firestore, "users", user.uid, "transactions")) : null, 
    [user, firestore]
  );
  const categoriesQuery = useMemoFirebase(() => 
    user ? query(collection(firestore, "users", user.uid, "categories")) : null, 
    [user, firestore]
  );
  const accountsQuery = useMemoFirebase(() =>
    user ? query(collection(firestore, "users", user.uid, "accounts")) : null,
    [user, firestore]
  );
  const budgetsQuery = useMemoFirebase(() => 
    user ? query(collection(firestore, "users", user.uid, "budgets")) : null, 
    [user, firestore]
  );

  const { data: transactions, isLoading: transactionsLoading } = useCollection<Transaction>(transactionsQuery);
  const { data: categories, isLoading: categoriesLoading } = useCollection<Category>(categoriesQuery);
  const { data: accounts, isLoading: accountsLoading } = useCollection<Account>(accountsQuery);
  const { data: budgets, isLoading: budgetsLoading } = useCollection<Budget>(budgetsQuery);

  const isLoading = isUserLoading || transactionsLoading || categoriesLoading || budgetsLoading || accountsLoading;

  if (isLoading || !user) {
    return <LoadingSkeleton />;
  }

  const safeTransactions = transactions || [];
  const safeCategories = categories || [];
  const safeBudgets = budgets || [];
  const safeAccounts = accounts || [];

  const totalExpenses = safeTransactions
    .filter(t => t.transactionType === 'expense')
    .reduce((acc, exp) => acc + exp.amount, 0)
  
  const totalIncome = safeTransactions
    .filter(t => t.transactionType === 'income')
    .reduce((acc, exp) => acc + exp.amount, 0)

  const totalBudget = safeBudgets.reduce((acc, b) => acc + b.amount, 0)

  return (
    <div className="grid gap-4 md:gap-8">
        <SummaryCards 
          totalBudget={totalBudget}
          totalExpenses={totalExpenses}
          totalIncome={totalIncome}
        />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Monthly Spending</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <MonthlySpendingChart transactions={safeTransactions} />
          </CardContent>
        </Card>
        <Card className="col-span-4 lg:col-span-3">
          <CardHeader>
            <CardTitle>Spending by Category</CardTitle>
            <CardDescription>
              Spending breakdown for the current month.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CategorySpendingChart transactions={safeTransactions} categories={safeCategories} />
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Budget Status</CardTitle>
          <CardDescription>
            Your spending progress for each category budget.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          {safeBudgets.length > 0 ? safeBudgets.map(budget => {
            const category = getCategoryName(safeCategories, budget.categoryId)
            const spent = safeTransactions
              .filter(e => e.categoryId === budget.categoryId && e.transactionType === 'expense')
              .reduce((acc, e) => acc + e.amount, 0)
            const progress = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;

            return (
              <div key={budget.categoryId} className="grid gap-2">
                <div className="flex items-center justify-between">
                   <span className="font-medium">{category}</span>
                   <span className="text-sm text-muted-foreground">
                    ${spent.toFixed(2)} / ${budget.amount.toFixed(2)}
                   </span>
                </div>
                <Progress value={progress} aria-label={`${category} budget progress`} />
              </div>
            )
          }) : (
            <div className="text-center text-muted-foreground py-8">
              You haven't set any budgets yet. Go to the <a href="/budgets" className="text-primary underline">Budgets</a> page to create one.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
