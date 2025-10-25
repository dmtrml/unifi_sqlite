"use client"

import * as React from "react"
import Link from "next/link"
import { collection, query } from "firebase/firestore"
import { useCollection, useFirestore, useUser, useMemoFirebase } from "@/firebase"
import {
  Home,
  LineChart,
  Repeat,
  DollarSign,
  Landmark,
  Wallet,
  Shapes,
  MoreHorizontal,
} from "lucide-react"
import { format } from 'date-fns'

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import AppHeader from "@/components/header"
import { BudgetWiseLogo } from "@/components/icons"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { AddRecurringTransactionDialog } from "@/components/add-recurring-transaction-dialog"
import type { RecurringTransaction, Category, Account } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent } from "@/components/ui/dropdown-menu"
import { EditRecurringTransactionDialog } from "@/components/edit-recurring-transaction-dialog"
import { DeleteRecurringTransactionDialog } from "@/components/delete-recurring-transaction-dialog"

function getCategory(categories: Category[], categoryId?: string): Category | undefined {
  if (!categoryId) return undefined;
  return categories.find(c => c.id === categoryId)
}

function getAccount(accounts: Account[], accountId?: string): Account | undefined {
  if (!accountId) return undefined;
  return accounts.find(a => a.id === accountId)
}

function RecurringPageContent() {
  const { user } = useUser()
  const firestore = useFirestore()

  const recurringTransactionsQuery = useMemoFirebase(() =>
    user ? query(collection(firestore, "users", user.uid, "recurringTransactions")) : null,
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

  const { data: recurringTransactions } = useCollection<RecurringTransaction>(recurringTransactionsQuery);
  const { data: categories } = useCollection<Category>(categoriesQuery);
  const { data: accounts } = useCollection<Account>(accountsQuery);

  const safeRecurringTransactions = recurringTransactions || [];
  const safeCategories = categories || [];
  const safeAccounts = accounts || [];

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
      <div className="flex items-center">
        <h1 className="text-lg font-semibold md:text-2xl">Recurring Transactions</h1>
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center">
          <div className="grid gap-2">
            <CardTitle>Recurring Transactions</CardTitle>
            <CardDescription>
              Manage your recurring expenses and income.
            </CardDescription>
          </div>
          <AddRecurringTransactionDialog categories={safeCategories} accounts={safeAccounts} />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {safeRecurringTransactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center h-24">
                    No recurring transactions yet.
                  </TableCell>
                </TableRow>
              ) : (
                safeRecurringTransactions.map((rt) => {
                  const category = getCategory(safeCategories, rt.categoryId)
                  const account = getAccount(safeAccounts, rt.accountId)
                  return (
                    <TableRow key={rt.id}>
                      <TableCell className="font-medium">{rt.description}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{category?.name ?? "N/A"}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{account?.name ?? "N/A"}</Badge>
                      </TableCell>
                      <TableCell className="capitalize">{rt.frequency}</TableCell>
                      <TableCell>
                        {rt.startDate ? format(rt.startDate.toDate(), "PPP") : 'N/A'}
                      </TableCell>
                      <TableCell className="text-right">${rt.amount.toFixed(2)}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <EditRecurringTransactionDialog 
                              recurringTransaction={rt}
                              categories={safeCategories}
                              accounts={safeAccounts} 
                            />
                            <DeleteRecurringTransactionDialog recurringTransactionId={rt.id} />
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </main>
  );
}

export default function RecurringPage() {
  return (
    <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
      <aside className="hidden border-r bg-muted/40 md:block">
        <div className="flex h-full max-h-screen flex-col gap-2">
          <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <BudgetWiseLogo className="h-6 w-6" />
              <span className="">BudgetWise</span>
            </Link>
          </div>
          <div className="flex-1">
            <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
              <Link
                href="/"
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary"
              >
                <Home className="h-4 w-4" />
                Dashboard
              </Link>
              <Link
                href="/transactions"
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary"
              >
                <Wallet className="h-4 w-4" />
                Transactions
              </Link>
              <Link
                href="/accounts"
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary"
              >
                <Landmark className="h-4 w-4" />
                Accounts
              </Link>
              <Link
                href="/categories"
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary"
              >
                <Shapes className="h-4 w-4" />
                Categories
              </Link>
              <Link
                href="/budgets"
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary"
              >
                <DollarSign className="h-4 w-4" />
                Budgets
              </Link>
              <Link
                href="/recurring"
                className="flex items-center gap-3 rounded-lg bg-muted px-3 py-2 text-primary transition-all hover:text-primary"
              >
                <Repeat className="h-4 w-4" />
                Recurring
              </Link>
              <Link
                href="#"
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary"
              >
                <LineChart className="h-4 w-4" />
                Reports
              </Link>
            </nav>
          </div>
          <div className="mt-auto p-4">
            <Card>
              <CardHeader className="p-2 pt-0 md:p-4">
                <CardTitle>Upgrade to Pro</CardTitle>
              </CardHeader>
              <CardContent className="p-2 pt-0 md:p-4 md:pt-0">
                <Button size="sm" className="w-full">
                  Upgrade
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </aside>
      <div className="flex flex-col">
        <AppHeader />
        <RecurringPageContent />
      </div>
    </div>
  )
}
