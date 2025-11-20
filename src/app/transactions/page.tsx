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
import { getCategoryWithDescendants } from "@/lib/category-tree"
import { formatDateLabel, getUTCDateKey, dateFromKeyUTC } from "@/lib/date"

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
  const todayKey = getUTCDateKey(new Date());
  const yesterdayKey = getUTCDateKey(Date.now() - 86400000);

  if (dateStr === todayKey) return "Today";
  if (dateStr === yesterdayKey) return "Yesterday";

  const date = dateFromKeyUTC(dateStr);
  if (!date) return dateStr;
  return formatDateLabel(date, undefined, { month: "long", day: "numeric", year: "numeric" });
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

  const normalizeStart = React.useCallback((date?: Date) => {
    if (!date) return undefined;
    const copy = new Date(date);
    copy.setHours(0, 0, 0, 0);
    return copy.getTime();
  }, []);

  const normalizeEnd = React.useCallback((date?: Date) => {
    if (!date) return undefined;
    const copy = new Date(date);
    copy.setHours(23, 59, 59, 999);
    return copy.getTime();
  }, []);

  const startTimestamp = normalizeStart(dateRange?.from);
  const endTimestamp = normalizeEnd(dateRange?.to);

  const {
    transactions,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    loadMore,
  } = useTransactions({
    accountId: accountId !== "all" ? accountId : undefined,
    categoryIds:
      categoryId !== "all" && categoryId
        ? getCategoryWithDescendants(categoryId, safeCategories)
        : undefined,
    startDate: startTimestamp,
    endDate: endTimestamp,
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
      const dateKey = getUTCDateKey(transaction.date);
      if (!dateKey) return acc;
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(transaction);
      return acc;
    }, {} as Record<string, Transaction[]>);
  }, [filteredTransactions]);
  
  const sortedDateKeys = React.useMemo(() => {
    const keys = Object.keys(groupedTransactions);
    const getMillis = (key: string) => dateFromKeyUTC(key)?.getTime() ?? 0;
    if (sortOrder === 'asc') {
      return keys.sort((a, b) => getMillis(a) - getMillis(b));
    }
    return keys.sort((a, b) => getMillis(b) - getMillis(a));
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
                    <TableHead>Category</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                {isLoading ? (
                    <TableBody>
                        <TableRow>
                            <TableCell colSpan={5} className="text-center h-24">
                                <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                            </TableCell>
                        </TableRow>
                    </TableBody>
                ) : sortedDateKeys.length === 0 ? (
                  <TableBody>
                    <TableRow>
                      <TableCell colSpan={5} className="text-center h-24">
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
                      <TableRow className="!border-0">
                        <TableCell colSpan={5} className="pt-6">
                          <div className="flex items-center justify-between border-b border-border/60 pb-2 text-sm">
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-primary/70" />
                              <span className="tracking-wide uppercase text-xs font-semibold">
                                {formatDateHeader(date)}
                              </span>
                            </div>
                            {dailyTotal > 0 && (
                              <span className="rounded-full bg-amber-100/80 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-500/20 dark:text-amber-200">
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
                        const isTransfer = transaction.transactionType === 'transfer';
                        const IconComponent = isTransfer 
                          ? ArrowRightLeft 
                          : (category && (Icons as any)[category.icon]) || MoreHorizontal;
                        const iconColor = isTransfer 
                          ? 'hsl(var(--foreground))' 
                          : category?.color || 'hsl(var(--foreground))';
                        const isMultiCurrency = isTransfer && fromAccount?.currency !== toAccount?.currency;

                        return (
                          <TableRow
                            key={transaction.id}
                            className="!border-0 bg-transparent hover:bg-transparent [&>td]:py-3 [&>td]:px-3 [&>td:first-child]:pl-0 [&>td:last-child]:pr-0"
                          >
                            <TableCell className="align-top">
                              <div className="flex items-center gap-3">
                                <div
                                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-muted/40"
                                  style={{ color: iconColor }}
                                >
                                  <IconComponent className="h-5 w-5" />
                                </div>
                                <div className="flex flex-col">
                                  <span className="font-semibold leading-tight">
                                    {isTransfer
                                      ? "Transfer"
                                      : category?.name ?? "Uncategorized"}
                                  </span>
                                  {isTransfer && (
                                    <span className="text-xs text-muted-foreground">
                                      {fromAccount?.name ?? "N/A"} → {toAccount?.name ?? "N/A"}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="max-w-[280px] align-top">
                              {transaction.description ? (
                                <span className="text-sm text-foreground truncate">
                                  {transaction.description}
                                </span>
                              ) : (
                                <span className="text-sm italic text-muted-foreground">
                                  No description
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="align-top">
                              <Badge variant="outline" className="max-w-[180px] truncate">
                                {isTransfer
                                  ? `${fromAccount?.name ?? "N/A"} -> ${toAccount?.name ?? "N/A"}`
                                  : (account?.name ?? "No Account")}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right align-top">
                              {isTransfer ? (
                                isMultiCurrency ? (
                                  <div className="space-y-1 text-sm">
                                    <span className="block font-semibold text-emerald-600">
                                      +{new Intl.NumberFormat('en-US', { style: 'currency', currency: toAccount?.currency || mainCurrency }).format(transaction.amountReceived || 0)}
                                    </span>
                                    <span className="block font-semibold text-destructive">
                                      -{new Intl.NumberFormat('en-US', { style: 'currency', currency: fromAccount?.currency || mainCurrency }).format(transaction.amountSent || 0)}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="font-semibold text-muted-foreground">
                                    {new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)}
                                  </span>
                                )
                              ) : (
                                <span className={`font-semibold ${transaction.transactionType === 'expense' ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                  {transaction.transactionType === 'expense' ? '-' : '+'}
                                  {new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-right align-top">
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
