"use client"

import * as React from "react"
import { collection, query } from "firebase/firestore"
import { useCollection, useFirestore, useUser, useMemoFirebase } from "@/firebase"
import AppLayout from "@/components/layout"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { Category, Transaction } from "@/lib/types"
import { IncomeExpenseChart } from "@/components/reports/IncomeExpenseChart"
import { CategoryBreakdownChart } from "@/components/reports/CategoryBreakdownChart"
import { CategorySpendingChart } from "@/components/dashboard/category-spending-chart"
import { Skeleton } from "@/components/ui/skeleton"

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-80 w-full" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-96 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    </div>
  )
}

function ReportsPageContent() {
  const { user, isUserLoading } = useUser()
  const firestore = useFirestore()

  const transactionsQuery = useMemoFirebase(() => 
    user ? query(collection(firestore, "users", user.uid, "transactions")) : null, 
    [user, firestore]
  );
  const categoriesQuery = useMemoFirebase(() => 
    user ? query(collection(firestore, "users", user.uid, "categories")) : null, 
    [user, firestore]
  );
  
  const { data: transactions, isLoading: transactionsLoading } = useCollection<Transaction>(transactionsQuery);
  const { data: categories, isLoading: categoriesLoading } = useCollection<Category>(categoriesQuery);

  const isLoading = isUserLoading || transactionsLoading || categoriesLoading;

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
      <div className="flex items-center">
        <h1 className="text-lg font-semibold md:text-2xl">Reports</h1>
      </div>
      
      {isLoading ? (
        <LoadingSkeleton />
      ) : (
        <div className="grid grid-cols-1 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Income vs. Expense</CardTitle>
              <CardDescription>
                A monthly comparison of your income and expenses for the current year.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <IncomeExpenseChart transactions={transactions || []} />
            </CardContent>
          </Card>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle>Spending by Category</CardTitle>
                <CardDescription>
                  Spending breakdown for the current month.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CategorySpendingChart transactions={transactions || []} categories={categories || []} />
              </CardContent>
            </Card>
            
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle>Expense Breakdown by Category</CardTitle>
                <CardDescription>
                  See where your money is going. This chart shows the distribution of your expenses across different categories.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CategoryBreakdownChart transactions={transactions || []} categories={categories || []} />
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </main>
  );
}

export default function ReportsPage() {
  return (
    <AppLayout>
      <ReportsPageContent />
    </AppLayout>
  )
}
