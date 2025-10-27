"use client"

import * as React from "react"
import { collection, query, orderBy } from "firebase/firestore"
import { useCollection, useFirestore, useUser, useMemoFirebase } from "@/firebase"
import AppLayout from "@/components/layout"
import {
  ArrowRightLeft
} from "lucide-react"
import { format } from 'date-fns';

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
import type { Account, Category, Transaction } from "@/lib/types"
import { MoreHorizontal, Landmark } from "lucide-react"
import { EditTransactionDialog } from "@/components/edit-transaction-dialog"
import { DeleteTransactionDialog } from "@/components/delete-transaction-dialog"
import * as Icons from "lucide-react"
import type { DateRange } from "react-day-picker"
import { TransactionFilters } from "@/components/transaction-filters"
import { DuplicateTransactionDialog } from "@/components/duplicate-transaction-dialog"

function getCategory(categories: Category[], categoryId?: string): Category | undefined {
  if (!categoryId) return undefined;
  return categories.find(c => c.id === categoryId)
}

function getAccount(accounts: Account[], accountId?: string): Account | undefined {
  if (!accountId) return undefined;
  return accounts.find(a => a.id === accountId)
}

function formatDateHeader(dateStr: string) {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const todayStr = format(today, 'yyyy-MM-dd');
  const yesterdayStr = format(yesterday, 'yyyy-MM-dd');
  
  if (dateStr === todayStr) return "Today";
  if (dateStr === yesterdayStr) return "Yesterday";
  
  const date = new Date(dateStr);
  const zonedDate = new Date(date.valueOf() + date.getTimezoneOffset() * 60 * 1000);
  return format(zonedDate, "MMMM d, yyyy");
}

function TransactionsPageContent() {
  const { user } = useUser()
  const firestore = useFirestore()

  const [dateRange, setDateRange] = React.useState<DateRange | undefined>(undefined);
  const [accountId, setAccountId] = React.useState<string>("all");
  const [categoryId, setCategoryId] = React.useState<string>("all");
  const [searchQuery, setSearchQuery] = React.useState<string>("");

  const transactionsQuery = useMemoFirebase(() => 
    user ? query(collection(firestore, "users", user.uid, "transactions"), orderBy("date", "desc")) : null, 
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
  
  const filteredTransactions = React.useMemo(() => {
    return safeTransactions.filter(transaction => {
      const transactionDate = new Date(transaction.date.seconds * 1000);
      if (dateRange?.from && transactionDate < dateRange.from) return false;
      if (dateRange?.to) {
        const toDate = new Date(dateRange.to);
        toDate.setHours(23, 59, 59, 999);
        if (transactionDate > toDate) return false;
      }
      if (accountId !== 'all' && transaction.accountId !== accountId && transaction.fromAccountId !== accountId && transaction.toAccountId !== accountId) return false;
      if (categoryId !== 'all' && transaction.categoryId !== categoryId) return false;
      if (searchQuery && !transaction.description.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [safeTransactions, dateRange, accountId, categoryId, searchQuery]);


  const groupedTransactions = React.useMemo(() => {
    return filteredTransactions.reduce((acc, transaction) => {
      const jsDate = new Date(transaction.date.seconds * 1000);
      const dateStr = format(jsDate, 'yyyy-MM-dd');
      
      if (!acc[dateStr]) {
        acc[dateStr] = [];
      }
      acc[dateStr].push(transaction);
      return acc;
    }, {} as Record<string, Transaction[]>);
  }, [filteredTransactions]);

  const handleFiltersReset = () => {
    setDateRange(undefined);
    setAccountId("all");
    setCategoryId("all");
    setSearchQuery("");
  }


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
            <TransactionFilters
              dateRange={dateRange}
              onDateChange={setDateRange}
              accounts={safeAccounts}
              selectedAccount={accountId}
              onAccountChange={setAccountId}
              categories={safeCategories}
              selectedCategory={categoryId}
              onCategoryChange={setCategoryId}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onReset={handleFiltersReset}
            />
            {/* Desktop Table */}
            <div className="hidden md:block">
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
                {Object.keys(groupedTransactions).length === 0 ? (
                  <TableBody>
                    <TableRow>
                      <TableCell colSpan={7} className="text-center h-24">
                        No transactions found for the selected filters.
                      </TableCell>
                    </TableRow>
                  </TableBody>
                ) : (
                  Object.entries(groupedTransactions).map(([date, transactionsInGroup]) => (
                    <TableBody key={date}>
                      <TableRow>
                        <TableCell colSpan={7} className="font-semibold text-muted-foreground pt-6">
                          {formatDateHeader(date)}
                        </TableCell>
                      </TableRow>
                      {transactionsInGroup.map((transaction) => {
                        const category = getCategory(safeCategories, transaction.categoryId);
                        const account = getAccount(safeAccounts, transaction.accountId);
                        const fromAccount = getAccount(safeAccounts, transaction.fromAccountId);
                        const toAccount = getAccount(safeAccounts, transaction.toAccountId);

                        return (
                          <TableRow key={transaction.id}>
                            <TableCell className="font-medium">{transaction.description}</TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {transaction.transactionType === 'transfer' 
                                  ? `${fromAccount?.name} -> ${toAccount?.name}` 
                                  : (account?.name ?? "No Account")}
                              </Badge>
                            </TableCell>
                            <TableCell>
                                <Badge variant="outline">
                                  {category?.name ?? "Uncategorized"}
                                </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={transaction.transactionType === 'expense' ? 'destructive' : transaction.transactionType === 'income' ? 'default' : 'secondary'}>
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
                                  <DuplicateTransactionDialog
                                    transaction={transaction}
                                    categories={safeCategories}
                                    accounts={safeAccounts}
                                  />
                                  <DeleteTransactionDialog transactionId={transaction.id} />
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  ))
                )}
              </Table>
            </div>
            
            {/* Mobile List */}
            <div className="md:hidden space-y-2">
              {Object.keys(groupedTransactions).length === 0 ? (
                 <div className="text-center h-24 flex items-center justify-center text-muted-foreground">
                    No transactions found for the selected filters.
                  </div>
              ) : (
                Object.entries(groupedTransactions).map(([date, transactionsInGroup]) => (
                  <div key={date} className="space-y-2">
                     <h3 className="font-semibold text-muted-foreground px-1 pt-4">{formatDateHeader(date)}</h3>
                     <div className="space-y-2">
                      {transactionsInGroup.map((transaction) => {
                          const category = getCategory(safeCategories, transaction.categoryId);
                          const account = getAccount(safeAccounts, transaction.accountId);
                          const fromAccount = getAccount(safeAccounts, transaction.fromAccountId);
                          const toAccount = getAccount(safeAccounts, transaction.toAccountId);
                          
                          const isTransfer = transaction.transactionType === 'transfer';
                          const MainIcon = isTransfer ? ArrowRightLeft : (category && (Icons as any)[category.icon]) || Icons.MoreHorizontal;
                          const mainIconColor = isTransfer ? 'hsl(var(--foreground))' : category?.color;

                          return (
                              <div key={transaction.id} className="flex items-center justify-between rounded-lg p-2">
                                  <div className="flex items-center gap-3">
                                      <MainIcon className="h-6 w-6" style={{color: mainIconColor}}/>
                                      <div className="flex flex-col">
                                          <span className="font-medium">{isTransfer ? "Transfer" : (category?.name ?? "Uncategorized")}</span>
                                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                            {isTransfer ? (
                                              <>
                                                  <span className="truncate max-w-[100px]">{fromAccount?.name ?? ''}</span>
                                                  <ArrowRightLeft className="h-3 w-3 mx-1" />
                                                  <span className="truncate max-w-[100px]">{toAccount?.name ?? ''}</span>
                                              </>
                                            ) : (
                                              <>
                                                <Landmark className="h-3 w-3" />
                                                <span className="mr-2">{account?.name ?? "No Account"}</span>
                                              </>
                                            )}
                                          </div>
                                          <span className="text-xs text-muted-foreground truncate max-w-[150px]">{transaction.description}</span>
                                      </div>
                                  </div>
                                  <div className="flex flex-col items-end">
                                      <span className={`font-bold ${transaction.transactionType === 'expense' ? 'text-destructive' : isTransfer ? '' : 'text-primary'}`}>
                                          {transaction.transactionType === 'expense' ? '-' : transaction.transactionType === 'income' ? '+' : ''}${transaction.amount.toFixed(2)}
                                      </span>
                                      <span className="text-xs text-muted-foreground">
                                          {new Date(transaction.date.seconds * 1000).toLocaleDateString()}
                                      </span>
                                      <DropdownMenu>
                                          <DropdownMenuTrigger asChild>
                                              <Button variant="ghost" size="icon" className="-mr-2 h-8 w-8">
                                                  <MoreHorizontal className="h-4 w-4" />
                                              </Button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent>
                                              <EditTransactionDialog 
                                                  transaction={transaction}
                                                  categories={safeCategories}
                                                  accounts={safeAccounts}
                                              />
                                              <DuplicateTransactionDialog
                                                  transaction={transaction}
                                                  categories={safeCategories}
                                                  accounts={safeAccounts}
                                              />
                                              <DeleteTransactionDialog transactionId={transaction.id} />
                                          </DropdownMenuContent>
                                      </DropdownMenu>
                                  </div>
                              </div>
                          )
                      })}
                     </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
    </main>
  );
}

export default function TransactionsPage() {
  return (
    <AppLayout>
      <TransactionsPageContent />
    </AppLayout>
  )
}
