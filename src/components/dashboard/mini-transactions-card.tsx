"use client"

import * as React from "react"
import Link from "next/link"
import * as Icons from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { Transaction, Category, Account, Currency } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type MiniTransactionsCardProps = {
  transactions: Transaction[]
  categories: Category[]
  accounts: Account[]
  currency: Currency
}

export function MiniTransactionsCard({ transactions, categories, accounts, currency }: MiniTransactionsCardProps) {
  const formatter = new Intl.NumberFormat("en-US", { style: "currency", currency })
  const categoryMap = new Map(categories.map((c) => [c.id, c]))
  const accountMap = new Map(accounts.map((a) => [a.id, a]))
  const resolveIcon = React.useCallback((iconName: string): LucideIcon => {
    const IconComponent = Icons[iconName as keyof typeof Icons];
    return (IconComponent as LucideIcon) ?? Icons.Circle;
  }, [])
  const items = transactions.slice(0, 5)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between border-b border-border/60 pb-2">
        <CardTitle className="text-sm font-semibold">Recent Transactions</CardTitle>
        <Link href="/transactions" className="text-xs font-semibold text-primary hover:text-primary/80">
          View all
        </Link>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {items.length === 0 ? (
          <p className="text-muted-foreground">No transactions yet.</p>
        ) : (
          items.map((transaction) => {
            const category = transaction.categoryId ? categoryMap.get(transaction.categoryId) : null
            const account =
              transaction.accountId && accountMap.get(transaction.accountId)
                ? accountMap.get(transaction.accountId)
                : transaction.toAccountId
                ? accountMap.get(transaction.toAccountId)
                : null
            const iconName = category?.icon ?? "Circle"
            const IconComponent = resolveIcon(iconName)
            const amount = transaction.amount ?? transaction.amountReceived ?? transaction.amountSent ?? 0
            const isExpense = transaction.transactionType === "expense"

            return (
              <div key={transaction.id} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 overflow-hidden">
                  <IconComponent className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="flex flex-col overflow-hidden">
                    <span className="truncate font-medium">
                      {transaction.description || category?.name || "Untitled"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {category?.name ?? "Uncategorized"} · {account?.name ?? "No account"}
                    </span>
                  </div>
                </div>
                <span className={`shrink-0 font-semibold ${isExpense ? "text-destructive" : "text-emerald-500"}`}>
                  {isExpense ? "-" : "+"}
                  {formatter.format(amount)}
                </span>
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
