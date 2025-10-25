"use client"

import * as React from "react"
import { collection, query, orderBy } from "firebase/firestore"
import { useCollection, useFirestore, useUser, useMemoFirebase } from "@/firebase"
import AppLayout from "@/components/layout"

import {
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
    user ? query(collection(firestore, "users", user.uid, "recurringTransactions"), orderBy("startDate", "desc")) : null,
    [user, firestore]
  );
  const categoriesQuery = useMemoFirebase(() =>
    user ? query(collection(firestore, "users", user.uid, "categories"), (where: any) => where("type", "==", "expense")) : null,
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
    <AppLayout>
      <RecurringPageContent />
    </AppLayout>
  )
}
