"use client"

import * as React from "react"
import { collection, query, orderBy, doc } from "firebase/firestore"
import { useCollection, useFirestore, useUser, useMemoFirebase, useDoc } from "@/firebase"
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
import type { Account, Category, Transaction, User } from "@/lib/types"
import { MoreHorizontal, Landmark } from "lucide-react"
import { EditTransactionDialog } from "@/components/edit-transaction-dialog"
import { DeleteTransactionDialog } from "@/components/delete-transaction-dialog"
import * as Icons from "lucide-react"
import type { DateRange } from "react-day-picker"
import { TransactionFilters } from "@/components/transaction-filters"
import { DuplicateTransactionDialog } from "@/components/duplicate-transaction-dialog"
import { convertAmount } from "@/lib/currency"

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

  const userDocRef = useMemoFirebase(
    () => (user ? doc(firestore, "users", user.uid) : null),
    [user, firestore]
  )
  const { data: userData } = useDoc<User>(userDocRef);
  const mainCurrency = userData?.mainCurrency || "USD";

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
  
  const currencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: mainCurrency, minimumFractionDigits: 0, maximumFractionDigits: 0 });

  const getTransactionAmount = (t: Transaction) => {
    if (t.transactionType === 'transfer') {
        return t.amountSent || t.amount || 0;
    }
    return t.amount || 0;
  }

  const getTransactionCurrency = (t: Transaction) => {
     if (t.transactionType === 'transfer') {
        if (t.fromAccountId) {
            const fromAccount = getAccount(safeAccounts, t.fromAccountId);
            return fromAccount?.currency || mainCurrency;
        }
     } else if (t.accountId) {
       const account = getAccount(safeAccounts, t.accountId);
       return account?.currency || mainCurrency;
     }
     return mainCurrency;
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
                  Object.entries(groupedTransactions).map(([date, transactionsInGroup]) => {
                    const dailyTotal = transactionsInGroup.reduce((sum, t) => {
                      if (t.transactionType === 'expense') {
                         const amount = t.amount || 0;
                         const fromCurrency = getTransactionCurrency(t);
                         return sum + convertAmount(amount, fromCurrency, mainCurrency);
                      }
                      return sum;
                    }, 0);
                    return (
                    <TableBody key={date}>
                      <TableRow>
                        <TableCell colSpan={7} className="font-semibold text-muted-foreground pt-6">
                          <div className="flex justify-between items-center">
                              <span>{formatDateHeader(date)}</span>
                              {dailyTotal > 0 && (
                                <span className="text-destructive font-bold">
                                  -{currencyFormatter.format(dailyTotal)}
                                </span>
                              )}
                          </div>
                        </TableCell>
                      </TableRow>
                      {transactionsInGroup.map((transaction) => {
                        const category = getCategory(safeCategories, transaction.categoryId);
                        const account = getAccount(safeAccounts, transaction.accountId);
                        const fromAccount = getAccount(safeAccounts, transaction.fromAccountId);
                        const toAccount = getAccount(safeAccounts, transaction.toAccountId);
                        const amount = getTransactionAmount(transaction);
                        const currency = getTransactionCurrency(transaction);

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
                              {category ? (
                                <Badge variant="outline">
                                  {category.name}
                                </Badge>
                              ) : transaction.transactionType !== 'transfer' ? (
                                <Badge variant="outline">Uncategorized</Badge>
                              ) : null}
                            </TableCell>
                            <TableCell>
                              <Badge variant={transaction.transactionType === 'expense' ? 'destructive' : transaction.transactionType === 'income' ? 'default' : 'secondary'}>
                                {transaction.transactionType}
                              </Badge>
                            </TableCell>
                            <TableCell>{new Date(transaction.date.seconds * 1000).toLocaleDateString()}</TableCell>
                            <TableCell className="text-right">
                              {new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)}
                            </TableCell>
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
                  )})
                )}
              </Table>
            </div>
            
            {/* Mobile List */}
            <div className="md:hidden">
              {Object.keys(groupedTransactions).length === 0 ? (
                 <div className="text-center h-24 flex items-center justify-center text-muted-foreground">
                    No transactions found for the selected filters.
                  </div>
              ) : (
                Object.entries(groupedTransactions).map(([date, transactionsInGroup]) => {
                  const dailyTotal = transactionsInGroup.reduce((sum, t) => {
                      if (t.transactionType === 'expense') {
                         const amount = t.amount || 0;
                         const fromCurrency = getTransactionCurrency(t);
                         return sum + convertAmount(amount, fromCurrency, mainCurrency);
                      }
                      return sum;
                    }, 0);
                  return (
                  <div key={date}>
                     <div className="flex justify-between items-baseline bg-muted/50 rounded-md px-2 py-1 my-2">
                        <h3 className="font-semibold text-muted-foreground">{formatDateHeader(date)}</h3>
                        {dailyTotal > 0 && (
                          <span className="text-sm font-bold text-destructive">
                            -{currencyFormatter.format(dailyTotal)}
                          </span>
                        )}
                      </div>
                     <div className="divide-y">
                      {transactionsInGroup.map((transaction) => {
                          const isTransfer = transaction.transactionType === 'transfer';

                          if (isTransfer) {
                            const fromAccount = getAccount(safeAccounts, transaction.fromAccountId);
                            const toAccount = getAccount(safeAccounts, transaction.toAccountId);
                            const isMultiCurrency = fromAccount?.currency !== toAccount?.currency;
                            
                            const amountSent = transaction.amountSent ?? transaction.amount ?? 0;
                            const currencySent = fromAccount?.currency ?? mainCurrency;

                            const amountReceived = transaction.amountReceived ?? transaction.amount ?? 0;
                            const currencyReceived = toAccount?.currency ?? mainCurrency;

                            return (
                                <div key={transaction.id} className="p-2 space-y-1">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-3">
                                            <ArrowRightLeft className="h-6 w-6 shrink-0" />
                                            <div className="flex flex-col overflow-hidden">
                                                <span className="font-medium truncate">{toAccount?.name ?? 'N/A'}</span>
                                                <span className="text-xs text-muted-foreground truncate">from {fromAccount?.name ?? 'N/A'}</span>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end shrink-0">
                                            <span className="font-bold">
                                                + {new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyReceived }).format(amountReceived)}
                                            </span>
                                            <span className="font-bold">
                                                - {new Intl.NumberFormat('en-US', { style: 'currency', currency: currencySent }).format(amountSent)}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between pl-9">
                                        {transaction.description && <p className="text-sm text-muted-foreground truncate flex-grow">{transaction.description}</p>}
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="-mr-2 h-8 w-8 shrink-0">
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
                          }

                          // Logic for Income/Expense
                          const category = getCategory(safeCategories, transaction.categoryId);
                          const account = getAccount(safeAccounts, transaction.accountId);
                          const MainIcon = (category && (Icons as any)[category.icon]) || MoreHorizontal;
                          const mainIconColor = category?.color || 'hsl(var(--foreground))';

                          return (
                              <div key={transaction.id} className="p-2 space-y-1">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <MainIcon className="h-6 w-6 shrink-0" style={{color: mainIconColor}}/>
                                        <div className="flex flex-col overflow-hidden">
                                            <span className="font-medium truncate">{category?.name ?? "Uncategorized"}</span>
                                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                <Landmark className="h-3 w-3" />
                                                <span className="truncate">{account?.name ?? "No Account"}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <span className={`font-bold shrink-0 ${transaction.transactionType === 'expense' ? 'text-destructive' : 'text-primary'}`}>
                                        {transaction.transactionType === 'expense' ? '-' : '+'}
                                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: getTransactionCurrency(transaction) }).format(transaction.amount || 0)}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between pl-9">
                                    {transaction.description && <p className="text-sm text-muted-foreground truncate flex-grow">{transaction.description}</p>}
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="-mr-2 h-8 w-8 shrink-0">
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
                )})
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
