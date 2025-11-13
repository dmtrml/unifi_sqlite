"use client"

import * as React from "react"
import { useUser } from "@/lib/auth-context"
import { useAccounts } from "@/hooks/use-accounts"
import { useCategories } from "@/hooks/use-categories"
import { useTransactions } from "@/hooks/use-transactions"
import { useUserProfile } from "@/hooks/use-user-profile"
import AppLayout from "@/components/layout"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { IncomeExpenseChart } from "@/components/reports/IncomeExpenseChart"
import { CategoryBreakdownChart } from "@/components/reports/CategoryBreakdownChart"
import { CategorySpendingChart } from "@/components/dashboard/category-spending-chart"
import { Skeleton } from "@/components/ui/skeleton"
import type { Currency } from "@/lib/types"

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
  const { user } = useUser()
  const { accounts, isLoading: accountsLoading } = useAccounts();
  const { categories, isLoading: categoriesLoading } = useCategories();
  const { profile, isLoading: profileLoading } = useUserProfile();
  const { transactions, isLoading: transactionsLoading } = useTransactions();

  const isLoading = transactionsLoading || categoriesLoading || accountsLoading || profileLoading;
  const mainCurrency = (profile?.mainCurrency ?? "USD") as Currency;

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
                A monthly comparison of your income and expenses for the current year, shown in {mainCurrency}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <IncomeExpenseChart 
                transactions={transactions || []} 
                accounts={accounts || []} 
                mainCurrency={mainCurrency}
              />
            </CardContent>
          </Card>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle>Spending by Category</CardTitle>
                <CardDescription>
                  Spending breakdown for the current month in {mainCurrency}.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CategorySpendingChart 
                  transactions={transactions || []} 
                  categories={categories || []}
                  accounts={accounts || []}
                  mainCurrency={mainCurrency}
                />
              </CardContent>
            </Card>
            
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle>Expense Breakdown by Category</CardTitle>
                <CardDescription>
                  See where your money is going. This chart shows the distribution of your expenses across different categories in {mainCurrency}.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CategoryBreakdownChart 
                  transactions={transactions || []} 
                  categories={categories || []} 
                  accounts={accounts || []}
                  mainCurrency={mainCurrency}
                />
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
