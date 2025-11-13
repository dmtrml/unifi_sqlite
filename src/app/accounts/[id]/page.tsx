"use client"

import * as React from "react"
import * as Icons from "lucide-react"
import { useUser } from "@/lib/auth-context"
import { useTransactions } from "@/hooks/use-transactions"
import { useCategories } from "@/hooks/use-categories"
import { useAccounts } from "@/hooks/use-accounts"
import { useUserProfile } from "@/hooks/use-user-profile"
import AppLayout from "@/components/layout"
import type { Account, Transaction, Category, Currency } from "@/lib/types"
import { Skeleton } from "@/components/ui/skeleton"
import Link from "next/link"
import { ArrowLeft, Edit, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { EditAccountDialog } from "@/components/edit-account-dialog"
import { DeleteAccountDialog } from "@/components/delete-account-dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AccountTransactionList } from "@/components/account-transaction-list"
import { IncomeExpenseChart } from "@/components/reports/IncomeExpenseChart"
import { CategorySpendingChart } from "@/components/dashboard/category-spending-chart"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { MoreVertical } from "lucide-react"

type AccountPageParams = {
  id: string;
};

function AccountPageContent({ accountId }: { accountId: string}) {
  const { user } = useUser()

  const { transactions: allTransactions, isLoading: isTransactionsLoading } = useTransactions({
    accountId,
  });

  const { categories, isLoading: isCategoriesLoading } = useCategories();

  const { accounts: allAccounts, isLoading: isAccountsLoading } = useAccounts();
  const { profile, isLoading: profileLoading } = useUserProfile();
  const account = React.useMemo(
    () => (allAccounts || []).find((a) => a.id === accountId) ?? null,
    [allAccounts, accountId]
  );
  
  const relatedTransactions = React.useMemo(() => {
    if (!allTransactions) return [];
    return allTransactions.filter(t => 
      t.accountId === accountId || 
      t.fromAccountId === accountId || 
      t.toAccountId === accountId
    );
  }, [allTransactions, accountId]);

  const isLoading = isAccountsLoading || isTransactionsLoading || isCategoriesLoading || profileLoading;
  const mainCurrency = (profile?.mainCurrency ?? "USD") as Currency;
  
  const IconComponent = account ? (Icons as any)[account.icon] || Icons.HelpCircle : Icons.HelpCircle;

  if (isLoading) {
    return (
        <div className="p-4 lg:p-6 space-y-6">
            <div className="flex items-center gap-4">
              <Link href="/accounts" passHref>
                  <Button variant="outline" size="icon" aria-label="Back to accounts">
                      <ArrowLeft className="h-4 w-4" />
                  </Button>
              </Link>
              <Skeleton className="h-8 w-48" />
            </div>
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-64 w-full" />
        </div>
    )
  }

  if (!account) {
    return (
        <div className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6 items-center justify-center">
            <h2 className="text-2xl font-bold">Account not found</h2>
            <p className="text-muted-foreground">The account you are looking for does not exist.</p>
            <Link href="/accounts">
                <Button variant="outline">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Accounts
                </Button>
            </Link>
        </div>
    )
  }

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
      <div className="flex items-center gap-4">
        <Link href="/accounts" passHref>
            <Button variant="outline" size="icon" aria-label="Back to accounts">
                <ArrowLeft className="h-4 w-4" />
            </Button>
        </Link>
        <h1 className="text-lg font-semibold md:text-2xl">{account.name}</h1>
      </div>
      
      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div className="flex items-center gap-4">
             <IconComponent className="h-10 w-10" style={{ color: account.color }} />
              <div>
                <CardTitle className="text-2xl">{account.name}</CardTitle>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline">{account.type}</Badge>
                  <Badge variant="secondary">{account.currency}</Badge>
                </div>
              </div>
          </div>
          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <EditAccountDialog account={account}>
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                </EditAccountDialog>
                <DeleteAccountDialog accountId={account.id}>
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DeleteAccountDialog>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent>
            <div className="text-4xl font-bold">
                {new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: account.currency || 'USD',
                }).format(account.balance)}
            </div>
            <CardDescription className="mt-1">Current balance</CardDescription>
        </CardContent>
      </Card>

      <Tabs defaultValue="transactions">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>
        <TabsContent value="transactions">
           <Card>
            <CardHeader>
              <CardTitle>Transactions</CardTitle>
              <CardDescription>A list of recent transactions for this account.</CardDescription>
            </CardHeader>
            <CardContent>
                <AccountTransactionList 
                    transactions={relatedTransactions}
                    categories={categories || []}
                    accounts={allAccounts || []}
                    currentAccountId={accountId}
                />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="analytics" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Income vs. Expense</CardTitle>
              <CardDescription>
                Your income and expenses for this account in {mainCurrency}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <IncomeExpenseChart
                transactions={relatedTransactions}
                accounts={allAccounts || []}
                mainCurrency={mainCurrency}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Spending by Category</CardTitle>
              <CardDescription>
                Spending breakdown for the current month in {mainCurrency}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CategorySpendingChart
                transactions={relatedTransactions}
                categories={categories || []}
                accounts={allAccounts || []}
                mainCurrency={mainCurrency}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </main>
  );
}


export default function AccountPage({ params }: { params: Promise<AccountPageParams> }) {
  const resolvedParams = React.use(params);
  return (
    <AppLayout>
      <AccountPageContent accountId={resolvedParams.id} />
    </AppLayout>
  )
}
