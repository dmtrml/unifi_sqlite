"use client"

import * as React from "react"
import { useUser } from "@/lib/auth-context"
import { useCategories } from "@/hooks/use-categories"
import { useAccounts } from "@/hooks/use-accounts"
import { useTransactions } from "@/hooks/use-transactions"
import { useUserProfile } from "@/hooks/use-user-profile"
import AppLayout from "@/components/layout"
import {
  ArrowRightLeft,
  Loader2
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
import { convertAmount } from "@/lib/currency"
import { useToast } from "@/hooks/use-toast"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

const PAGE_SIZE = 25;

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
  const { toast } = useToast()
  const { profile } = useUserProfile()
  const [isFiltersOpen, setIsFiltersOpen] = React.useState(false)

  const [dateRange, setDateRange] = React.useState<DateRange | undefined>(undefined);
  const [accountId, setAccountId] = React.useState<string>("all");
  const [categoryId, setCategoryId] = React.useState<string>("all");
  const [searchQuery, setSearchQuery] = React.useState<string>("");
  const [sortOrder, setSortOrder] = React.useState<'desc' | 'asc'>('desc');
  React.useEffect(() => {
    const openHandler = () => setIsFiltersOpen(true);
    if (typeof window !== "undefined") {
      window.addEventListener("transactions:filters-open", openHandler);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("transactions:filters-open", openHandler);
      }
    };
  }, []);

  const mainCurrency = profile?.mainCurrency || "USD";

  const { categories } = useCategories();
  const { accounts } = useAccounts();
  const safeCategories = React.useMemo(() => categories ?? [], [categories]);
  const safeAccounts = React.useMemo(() => accounts ?? [], [accounts]);

  const {
    transactions,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    loadMore,
  } = useTransactions({
    accountId: accountId !== "all" ? accountId : undefined,
    categoryId: categoryId !== "all" ? categoryId : undefined,
    startDate: dateRange?.from ? dateRange.from.getTime() : undefined,
    endDate: dateRange?.to ? dateRange.to.getTime() : undefined,
    sort: sortOrder,
    search: searchQuery.trim() || undefined,
  });

  React.useEffect(() => {
    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message ?? "Failed to load transactions.",
      });
    }
  }, [error, toast]);

  const filteredTransactions = React.useMemo(() => {
    if (!searchQuery.trim()) {
      return transactions;
    }
    const lowerCasedSearch = searchQuery.toLowerCase();
    return transactions.filter((t) => {
      return (
        t.description?.toLowerCase().includes(lowerCasedSearch) ||
        getCategory(safeCategories, t.categoryId)?.name.toLowerCase().includes(lowerCasedSearch) ||
        getAccount(safeAccounts, t.accountId)?.name.toLowerCase().includes(lowerCasedSearch) ||
        getAccount(safeAccounts, t.fromAccountId)?.name.toLowerCase().includes(lowerCasedSearch) ||
        getAccount(safeAccounts, t.toAccountId)?.name.toLowerCase().includes(lowerCasedSearch)
      );
    });
  }, [transactions, searchQuery, safeCategories, safeAccounts]);


  const groupedTransactions = React.useMemo(() => {
    return filteredTransactions.reduce((acc, transaction) => {
      const jsDate = new Date(transaction.date.toMillis());
      const dateStr = format(jsDate, 'yyyy-MM-dd');
      
      if (!acc[dateStr]) {
        acc[dateStr] = [];
      }
      acc[dateStr].push(transaction);
      return acc;
    }, {} as Record<string, Transaction[]>);
  }, [filteredTransactions]);
  
  const sortedDateKeys = React.useMemo(() => {
    const keys = Object.keys(groupedTransactions);
    if (sortOrder === 'asc') {
        return keys.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    }
    return keys.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  }, [groupedTransactions, sortOrder]);

  const handleFiltersReset = () => {
    setDateRange(undefined);
    setAccountId("all");
    setCategoryId("all");
    setSearchQuery("");
    setSortOrder("desc");
  }
  
  const currencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: mainCurrency, minimumFractionDigits: 0, maximumFractionDigits: 0 });

  const getTransactionAmount = (t: Transaction) => {
    if (t.transactionType === 'transfer') {
        return t.amountSent || t.amount || 0;
    }
    return t.amount || 0;
  }

  const getTransactionCurrency = (t: Transaction) => {
     if (t.transactionType === 'transfer' && t.fromAccountId) {
        const fromAccount = getAccount(safeAccounts, t.fromAccountId);
        return fromAccount?.currency || mainCurrency;
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
                {isLoading ? (
                    <TableBody>
                        <TableRow>
                            <TableCell colSpan={7} className="text-center h-24">
                                <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                            </TableCell>
                        </TableRow>
                    </TableBody>
                ) : sortedDateKeys.length === 0 ? (
                  <TableBody>
                    <TableRow>
                      <TableCell colSpan={7} className="text-center h-24">
                        No transactions found for the selected filters.
                      </TableCell>
                    </TableRow>
                  </TableBody>
                ) : (
                  sortedDateKeys.map((date) => {
                    const transactionsInGroup = groupedTransactions[date];
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
                            <TableCell>{transaction.date.toDate().toLocaleDateString()}</TableCell>
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
              {isLoading ? (
                    <div className="text-center h-24 flex items-center justify-center text-muted-foreground">
                       <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                    </div>
              ) : sortedDateKeys.length === 0 ? (
                 <div className="text-center h-24 flex items-center justify-center text-muted-foreground">
                    No transactions found for the selected filters.
                  </div>
              ) : (
                sortedDateKeys.map((date) => {
                  const transactionsInGroup = groupedTransactions[date];
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
                          const category = getCategory(safeCategories, transaction.categoryId);
                          const account = getAccount(safeAccounts, transaction.accountId);
                          const fromAccount = getAccount(safeAccounts, transaction.fromAccountId);
                          const toAccount = getAccount(safeAccounts, transaction.toAccountId);
                          const isTransfer = transaction.transactionType === 'transfer';
                          
                          const IconComponent = isTransfer 
                            ? ArrowRightLeft 
                            : (category && (Icons as any)[category.icon]) || MoreHorizontal;
                          
                          const iconColor = isTransfer 
                            ? 'hsl(var(--foreground))' 
                            : category?.color || 'hsl(var(--foreground))';
                          
                          const amount = getTransactionAmount(transaction);
                          const currency = getTransactionCurrency(transaction);
                          
                          const isMultiCurrency = isTransfer && fromAccount?.currency !== toAccount?.currency;
                          
                          return (
                              <div key={transaction.id} className="p-2 flex items-start justify-between gap-2">
                                  <div className="flex items-center gap-3 flex-grow overflow-hidden">
                                      <IconComponent className="h-6 w-6 shrink-0" style={{color: iconColor}}/>
                                      <div className="flex flex-col space-y-1 overflow-hidden">
                                          <span className="font-medium truncate">
                                            {isTransfer 
                                              ? toAccount?.name ?? "N/A"
                                              : category?.name ?? "Uncategorized"}
                                          </span>
                                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                              <Landmark className="h-3 w-3" />
                                              <span className="truncate">
                                                {isTransfer 
                                                    ? fromAccount?.name ?? "N.A"
                                                    : account?.name ?? "No Account"}
                                              </span>
                                          </div>
                                          {transaction.description && <p className="text-sm text-muted-foreground truncate pr-2">{transaction.description}</p>}
                                      </div>
                                  </div>

                                  <div className="flex flex-col items-end shrink-0 text-right">
                                    {isTransfer ? (
                                      isMultiCurrency ? (
                                        <>
                                          <span className="font-bold">
                                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: toAccount?.currency || mainCurrency }).format(transaction.amountReceived || 0)}
                                          </span>
                                           <span className="font-bold text-muted-foreground">
                                            -{new Intl.NumberFormat('en-US', { style: 'currency', currency: fromAccount?.currency || mainCurrency }).format(transaction.amountSent || 0)}
                                          </span>
                                        </>
                                      ) : (
                                         <span className="font-bold">
                                          {new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)}
                                        </span>
                                      )
                                    ) : (
                                      <span className={`font-bold ${transaction.transactionType === 'expense' ? 'text-destructive' : 'text-primary'}`}>
                                          {transaction.transactionType === 'expense' ? '-' : '+'}
                                          {new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)}
                                      </span>
                                    )}
                                      
                                      <DropdownMenu>
                                          <DropdownMenuTrigger asChild>
                                              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 mt-1">
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
            {hasMore && (
              <div className="flex justify-center pt-4">
                <Button variant="outline" onClick={loadMore} disabled={isLoadingMore}>
                  {isLoadingMore ? "Loading..." : "Load more"}
                </Button>
              </div>
            )}
        </CardContent>
      </Card>
      <Sheet open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
        <SheetContent side="right" className="w-[min(420px,95vw)] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Filters</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-4">
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
              sortOrder={sortOrder}
              onSortOrderChange={setSortOrder}
              onReset={handleFiltersReset}
            />
            <div className="flex items-center justify-between pt-2">
              <Button variant="ghost" onClick={handleFiltersReset}>
                Reset
              </Button>
              <Button onClick={() => setIsFiltersOpen(false)}>Close</Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
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
