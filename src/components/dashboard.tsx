"use client"
import * as React from "react"
import { collection, query, where } from "firebase/firestore"
import { useCollection, useFirestore, useUser, useMemoFirebase, useAuth } from "@/firebase"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"

import type { Budget, Category, Transaction, RecurringExpense } from "@/lib/types"

import { MonthlySpendingChart } from "./dashboard/monthly-spending-chart"
import { CategorySpendingChart } from "./dashboard/category-spending-chart"
import { SummaryCards } from "./dashboard/summary-cards"
import { Progress } from "./ui/progress"
import { Skeleton } from "./ui/skeleton"
import { initiateAnonymousSignIn } from "@/firebase/non-blocking-login"
import { AddCategoryDialog } from "./add-category-dialog"
import * as Icons from "lucide-react"

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

function WelcomeMessage({ onLogin }: { onLogin: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Welcome to BudgetWise</CardTitle>
          <CardDescription>
            To get started, please sign in. You can continue as a guest to explore the app.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={onLogin}>Continue as Guest</Button>
        </CardContent>
      </Card>
    </div>
  )
}


export default function Dashboard() {
  const { user, isUserLoading } = useUser()
  const firestore = useFirestore()
  const auth = useAuth()

  // Memoize Firestore queries
  const transactionsQuery = useMemoFirebase(() => 
    user ? query(collection(firestore, "users", user.uid, "transactions")) : null, 
    [user, firestore]
  );
  const categoriesQuery = useMemoFirebase(() => 
    user ? query(collection(firestore, "users", user.uid, "categories")) : null, 
    [user, firestore]
  );
  const budgetsQuery = useMemoFirebase(() => 
    user ? query(collection(firestore, "users", user.uid, "budgets")) : null, 
    [user, firestore]
  );
  const recurringQuery = useMemoFirebase(() => 
    user ? query(collection(firestore, "users", user.uid, "recurringTransactions")) : null, 
    [user, firestore]
  );

  const { data: transactions, isLoading: transactionsLoading } = useCollection<Transaction>(transactionsQuery);
  const { data: categories, isLoading: categoriesLoading } = useCollection<Category>(categoriesQuery);
  const { data: budgets, isLoading: budgetsLoading } = useCollection<Budget>(budgetsQuery);
  const { data: recurringExpenses, isLoading: recurringLoading } = useCollection<RecurringExpense>(recurringQuery);

  const isLoading = isUserLoading || transactionsLoading || categoriesLoading || budgetsLoading || recurringLoading;

  const handleGuestLogin = () => {
    if (!auth) return;
    initiateAnonymousSignIn(auth);
  };
  
  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (!user) {
    return <WelcomeMessage onLogin={handleGuestLogin} />;
  }

  const safeTransactions = transactions || [];
  const safeCategories = categories || [];
  const safeBudgets = budgets || [];
  const safeRecurringExpenses = recurringExpenses || [];

  const totalExpenses = safeTransactions
    .filter(t => t.transactionType === 'expense')
    .reduce((acc, exp) => acc + exp.amount, 0)
  
  const totalIncome = safeTransactions
    .filter(t => t.transactionType === 'income')
    .reduce((acc, exp) => acc + exp.amount, 0)

  const totalBudget = safeBudgets.reduce((acc, b) => acc + b.amount, 0)

  return (
    <Tabs defaultValue="dashboard">
      <div className="flex items-center">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="budgets">Budgets</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="recurring">Recurring</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="dashboard">
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
              {safeBudgets.map(budget => {
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
              })}
            </CardContent>
          </Card>
        </div>
      </TabsContent>
      <TabsContent value="transactions">
        <Card>
          <CardHeader>
            <CardTitle>Transactions</CardTitle>
            <CardDescription>
              A list of all your recorded expenses and income.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {safeTransactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell className="font-medium">{transaction.description}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {getCategoryName(safeCategories, transaction.categoryId)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={transaction.transactionType === 'expense' ? 'destructive' : 'default'}>
                        {transaction.transactionType}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">${transaction.amount.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{new Date(transaction.date.seconds * 1000).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="budgets">
      <Card>
          <CardHeader>
            <CardTitle>Category Budgets</CardTitle>
            <CardDescription>
              Set and manage your monthly budget for each category.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
              {safeBudgets.map(budget => {
                const category = getCategoryName(safeCategories, budget.categoryId);
                return (
                  <div key={budget.categoryId} className="flex items-center justify-between p-2 rounded-lg border">
                    <span className="font-medium text-sm">{category}</span>
                    <div className="flex items-center gap-2">
                      <Input type="number" defaultValue={budget.amount} className="w-32 h-9" aria-label={`${category} budget amount`} />
                      <Button size="sm" variant="outline">Save</Button>
                    </div>
                  </div>
                )
              })}
          </CardContent>
          <CardFooter className="border-t pt-6">
            <Button>Save All Budgets</Button>
          </CardFooter>
        </Card>
      </TabsContent>
       <TabsContent value="categories">
        <Card>
          <CardHeader className="flex flex-row items-center">
            <div className="grid gap-2">
              <CardTitle>Categories</CardTitle>
              <CardDescription>
                Manage your expense categories.
              </CardDescription>
            </div>
            <AddCategoryDialog />
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {safeCategories.map((category) => {
                   const IconComponent = (Icons as any)[category.icon] || Icons.MoreHorizontal;
                  return (
                    <TableRow key={category.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                           <span className="flex h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: category.color.replace(")", ", 0.2)").replace("hsl", "hsla") }}>
                            <IconComponent className="h-4 w-4" style={{ color: category.color }} />
                           </span>
                          {category.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon">
                          <Icons.MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="recurring">
        <Card>
          <CardHeader>
            <CardTitle>Recurring Expenses</CardTitle>
            <CardDescription>
              A list of your recurring expenses.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {safeRecurringExpenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell className="font-medium">{expense.description}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {getCategoryName(safeCategories, expense.categoryId)}
                      </Badge>
                    </TableCell>
                    <TableCell className="capitalize">{expense.frequency}</TableCell>
                    <TableCell className="text-right">${expense.amount.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}
