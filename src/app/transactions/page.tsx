"use client"

import * as React from "react"
import { collection, query } from "firebase/firestore"
import { useCollection, useFirestore, useUser, useMemoFirebase } from "@/firebase"
import Link from "next/link"
import {
  Home,
  LineChart,
  Repeat,
  DollarSign,
  Landmark,
  Wallet
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import AppHeader from "@/components/header"
import { BudgetWiseLogo } from "@/components/icons"
import type { Account, Category, Transaction } from "@/lib/types"
import { MoreHorizontal } from "lucide-react"
import { EditTransactionDialog } from "@/components/edit-transaction-dialog"
import { DeleteTransactionDialog } from "@/components/delete-transaction-dialog"

function getCategoryName(categories: Category[], categoryId: string) {
  return categories.find(c => c.id === categoryId)?.name ?? "Uncategorized"
}

function getAccountName(accounts: Account[], accountId: string) {
  return accounts.find(a => a.id === accountId)?.name ?? "No Account"
}


function TransactionsPageContent() {
  const { user } = useUser()
  const firestore = useFirestore()

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

  const { data: transactions } = useCollection<Transaction>(transactionsQuery);
  const { data: categories } = useCollection<Category>(categoriesQuery);
  const { data: accounts } = useCollection<Account>(accountsQuery);
  
  const safeTransactions = transactions || [];
  const safeCategories = categories || [];
  const safeAccounts = accounts || [];

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
      <div className="flex items-center">
        <h1 className="text-lg font-semibold md:text-2xl">Transactions</h1>
      </div>
       <Card>
          <CardHeader>
            <CardTitle>All Transactions</CardTitle>
            <CardDescription>
              A list of all your recorded expenses and income.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {safeTransactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell className="font-medium">{transaction.description}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {getAccountName(safeAccounts, transaction.accountId)}
                      </Badge>
                    </TableCell>
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
                    <TableCell>{new Date(transaction.date.seconds * 1000).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">${transaction.amount.toFixed(2)}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <EditTransactionDialog 
                            transaction={transaction}
                            categories={safeCategories}
                            accounts={safeAccounts}
                          />
                          <DeleteTransactionDialog transactionId={transaction.id} />
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
    </main>
  );
}

export default function TransactionsPage() {
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
                className="flex items-center gap-3 rounded-lg bg-muted px-3 py-2 text-primary transition-all hover:text-primary"
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
                href="#"
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary"
              >
                <DollarSign className="h-4 w-4" />
                Budgets
              </Link>
              <Link
                href="#"
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary"
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
        <TransactionsPageContent />
      </div>
    </div>
  )
}
