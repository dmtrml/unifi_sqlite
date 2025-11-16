"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import AppLayout from "@/components/layout"
import { useAccounts } from "@/hooks/use-accounts"
import { useUserProfile } from "@/hooks/use-user-profile"

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
import * as Icons from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { UnstyledAccountsManager } from "@/components/unstyled-accounts-manager"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { convertAmount } from "@/lib/currency"
import type { Currency } from "@/lib/types"


function AccountsPageContent() {
  const router = useRouter();
  const { accounts = [] } = useAccounts();
  const { profile } = useUserProfile()
  const mainCurrency = profile?.mainCurrency || "USD"

  const [styledAccounts, unstyledAccounts] = React.useMemo(() => {
    const allAccounts = accounts || [];
    const unstyled = allAccounts.filter(a => a.icon === "Landmark" && a.color === "hsl(var(--muted-foreground))");
    const styled = allAccounts.filter(a => !unstyled.some(ua => ua.id === a.id));
    return [styled, unstyled];
  }, [accounts]);

  const handleRowClick = (accountId: string) => {
    router.push(`/accounts/${accountId}`);
  };

  const groupedAccounts = React.useMemo(() => {
    const map = new Map<
      string,
      { type: string; accounts: typeof styledAccounts; total: number; icon?: string; iconColor?: string }
    >()

    styledAccounts.forEach((account) => {
      const type = account.type || "Other"
      if (!map.has(type)) {
        map.set(type, { type, accounts: [], total: 0 })
      }
      const fromCurrency = (account.currency as Currency) || (mainCurrency as Currency)
      const convertedBalance = convertAmount(account.balance || 0, fromCurrency, mainCurrency as Currency)
      const entry = map.get(type)!
      entry.accounts.push(account)
      entry.total += convertedBalance
      if (!entry.icon) {
        entry.icon = account.icon
        entry.iconColor = account.color
      }
    })

    return Array.from(map.values()).sort((a, b) => a.type.localeCompare(b.type))
  }, [styledAccounts, mainCurrency])

  const formatMainCurrency = React.useMemo(() => {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: mainCurrency })
  }, [mainCurrency])

  const formatAccountBalance = React.useCallback((account: (typeof styledAccounts)[number]) => {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: account.currency || "USD" }).format(account.balance)
  }, [])

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">

      <div className="flex flex-col gap-6">
        <UnstyledAccountsManager accounts={unstyledAccounts} />
        
        <Card>
          <CardHeader className="flex flex-row items-center">
            <div className="grid gap-2">
              <CardTitle>Your Accounts</CardTitle>
              <CardDescription>
                Manage your financial accounts. Click on an account to see details.
              </CardDescription>
            </div>
              </CardHeader>
              <CardContent>
                {groupedAccounts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No styled accounts yet.</p>
                ) : (
              <Accordion type="multiple" className="space-y-4">
                {groupedAccounts.map((group) => {
                  const totalFormatted = formatMainCurrency.format(group.total)
                  return (
                    <AccordionItem
                      key={group.type}
                      value={group.type}
                      className="rounded-lg border border-border px-4"
                    >
                      <AccordionTrigger className="py-3 text-left">
                        <div className="flex w-full items-center justify-between gap-4">
                          <div className="flex items-center gap-3 text-left">
                            <div className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-muted/60 text-muted-foreground">
                              {
                                React.createElement(
                                  (Icons as any)[group.icon || "Wallet"],
                                  { className: "h-5 w-5" }
                                )
                              }
                            </div>
                            <div className="flex flex-col">
                              <span className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                                {group.type}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {group.accounts.length} {group.accounts.length === 1 ? "account" : "accounts"}
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-semibold text-foreground">{totalFormatted}</span>
                            <p className="text-xs text-muted-foreground">Total ({mainCurrency})</p>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pb-4 pt-2">
                        <div className="hidden md:block">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Account</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Balance</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {group.accounts.map((account) => {
                                return (
                                  <TableRow
                                    key={account.id}
                                    onClick={() => handleRowClick(account.id)}
                                    className="cursor-pointer"
                                  >
                                    <TableCell className="font-medium">
                                      <div className="flex items-center gap-3 truncate">
                                        <span
                                          className="h-2.5 w-2.5 rounded-full"
                                          style={{ backgroundColor: account.color }}
                                        />
                                        <span className="truncate">{account.name}</span>
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant="outline">{account.type}</Badge>
                                    </TableCell>
                                    <TableCell>{formatAccountBalance(account)}</TableCell>
                                  </TableRow>
                                )
                              })}
                            </TableBody>
                          </Table>
                        </div>
                        <div className="space-y-3 md:hidden">
                          {group.accounts.map((account) => {
                            return (
                              <div
                                key={account.id}
                                className="flex items-start justify-between gap-3 rounded-lg border border-border/70 bg-card/60 p-3"
                                onClick={() => handleRowClick(account.id)}
                              >
                                <div className="flex flex-1 items-center gap-3">
                                  <span
                                    className="h-2.5 w-2.5 rounded-full"
                                    style={{ backgroundColor: account.color, minWidth: "10px" }}
                                  />
                                  <div className="flex flex-col">
                                    <span className="font-semibold">{account.name}</span>
                                    <span className="text-xs text-muted-foreground">{account.type}</span>
                                  </div>
                                </div>
                                <div className="flex flex-col items-end text-right">
                                  <span className="text-sm font-semibold">{formatAccountBalance(account)}</span>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  )
                })}
              </Accordion>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

export default function AccountsPage() {
  return (
    <AppLayout>
      <AccountsPageContent />
    </AppLayout>
  )
}
