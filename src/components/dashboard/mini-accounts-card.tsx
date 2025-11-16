"use client"

import Link from "next/link"
import * as Icons from "lucide-react"
import type { Account, Currency, Transaction } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = Icons as any

type MiniAccountsCardProps = {
  accounts: Account[]
  transactions: Transaction[]
}

export function MiniAccountsCard({ accounts, transactions }: MiniAccountsCardProps) {
  const usageMap = new Map<string, number>()
  transactions.forEach((tx) => {
    if (tx.accountId) usageMap.set(tx.accountId, (usageMap.get(tx.accountId) ?? 0) + 1)
    if (tx.fromAccountId) usageMap.set(tx.fromAccountId, (usageMap.get(tx.fromAccountId) ?? 0) + 1)
    if (tx.toAccountId) usageMap.set(tx.toAccountId, (usageMap.get(tx.toAccountId) ?? 0) + 1)
  })

  const sorted = [...accounts].sort((a, b) => {
    const usageDiff = (usageMap.get(b.id) ?? 0) - (usageMap.get(a.id) ?? 0)
    if (usageDiff !== 0) return usageDiff
    return b.balance - a.balance
  })

  const items = sorted.slice(0, 4)

  const getFormatter = (currency: Currency) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency })

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between border-b border-border/60 pb-2">
        <CardTitle className="text-sm font-semibold">Popular Accounts</CardTitle>
        <Link href="/accounts" className="text-xs font-semibold text-primary hover:text-primary/80">
          View all
        </Link>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {items.length === 0 ? (
          <p className="text-muted-foreground">No accounts found.</p>
        ) : (
          items.map((account) => {
            const IconComponent = iconMap[account.icon] ?? Icons.Wallet
            return (
              <div key={account.id} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <IconComponent className="h-4 w-4 text-muted-foreground" />
                  <div className="flex flex-col">
                    <span className="font-medium">{account.name}</span>
                    <span className="text-xs text-muted-foreground">{account.type}</span>
                  </div>
                </div>
                <span className="shrink-0 font-semibold">
                  {getFormatter(account.currency).format(account.balance)}
                </span>
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
