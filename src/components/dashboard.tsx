"use client"
import * as React from "react"
import { collection, query, doc } from "firebase/firestore"
import { useCollection, useDoc, useFirestore, useUser, useMemoFirebase } from "@/firebase"
import { convertAmount } from "@/lib/currency"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import type { Budget, Category, Transaction, Account, User } from "@/lib/types"

import { MonthlySpendingChart } from "./dashboard/monthly-spending-chart"
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
  const userDocRef = useMemoFirebase(
    () => (user ? doc(firestore, "users", user.uid) : null),
    [user, firestore]
  )
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

  const { data: userData } = useDoc<User>(userDocRef);
  const { data: transactions, isLoading: transactionsLoading } = useCollection<Transaction>(transactionsQuery);
  const { data: categories, isLoading: categoriesLoading } = useCollection<Category>(categoriesQuery);
  const { data: accounts, isLoading: accountsLoading } = useCollection<Account>(accountsQuery);
  const { data: budgets, isLoading: budgetsLoading } = useCollection<Budget>(budgetsQuery);

  const isLoading = isUserLoading || transactionsLoading || categoriesLoading || budgetsLoading || accountsLoading;

  const mainCurrency = userData?.mainCurrency || "USD";

  const { totalIncome, totalExpenses, totalBudget } = React.useMemo(() => {
    const safeTransactions = transactions || [];
    const safeAccounts = accounts || [];
    const safeBudgets = budgets || [];

    const getAccountCurrency = (accountId?: string) => {
        return safeAccounts.find(a => a.id === accountId)?.currency || 'USD';
    }

    const totalIncome = safeTransactions
      .filter(t => t.transactionType === 'income')
      .reduce((acc, t) => {
        const fromCurrency = getAccountCurrency(t.accountId);
        return acc + convertAmount(t.amount, fromCurrency, mainCurrency);
      }, 0);

    const totalExpenses = safeTransactions
      .filter(t => t.transactionType === 'expense')
      .reduce((acc, t) => {
        const fromCurrency = getAccountCurrency(t.accountId);
        return acc + convertAmount(t.amount, fromCurrency, mainCurrency);
      }, 0);

    const totalBudget = safeBudgets.reduce((acc, b) => {
        const budgetCurrency = b.currency || mainCurrency;
        return acc + convertAmount(b.amount, budgetCurrency, mainCurrency);
    }, 0);

    return { totalIncome, totalExpenses, totalBudget };

  }, [transactions, accounts, budgets, mainCurrency]);


  if (isLoading || !user) {
    return <LoadingSkeleton />;
  }

  const safeTransactions = transactions || [];
  const safeCategories = categories || [];
  const safeBudgets = budgets || [];
  const safeAccounts = accounts || [];


  return (
    <div className="grid gap-4 md:gap-8">
        <SummaryCards 
          totalBudget={totalBudget}
          totalExpenses={totalExpenses}
          totalIncome={totalIncome}
          currency={mainCurrency}
        />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-full">
          <CardHeader>
            <CardTitle>Monthly Spending</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <MonthlySpendingChart 
              transactions={safeTransactions} 
              accounts={safeAccounts} 
              mainCurrency={mainCurrency}
            />
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Budget Status</CardTitle>
          <CardDescription>
            Your spending progress for each category budget. Budgets are shown in your main currency ({mainCurrency}).
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          {safeBudgets.length > 0 ? safeBudgets.map(budget => {
            const category = getCategoryName(safeCategories, budget.categoryId)
            const spent = safeTransactions
              .filter(e => e.categoryId === budget.categoryId && e.transactionType === 'expense')
              .reduce((acc, e) => {
                  const fromCurrency = safeAccounts.find(a => a.id === e.accountId)?.currency || 'USD';
                  return acc + convertAmount(e.amount, fromCurrency, mainCurrency)
                }, 0)
            const budgetAmountInMainCurrency = convertAmount(budget.amount, budget.currency || mainCurrency, mainCurrency);
            const progress = budgetAmountInMainCurrency > 0 ? (spent / budgetAmountInMainCurrency) * 100 : 0;
            
            const currencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: mainCurrency });

            return (
              <div key={budget.id} className="grid gap-2">
                <div className="flex items-center justify-between">
                   <span className="font-medium">{category}</span>
                   <span className="text-sm text-muted-foreground">
                    {currencyFormatter.format(spent)} / {currencyFormatter.format(budgetAmountInMainCurrency)}
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

    