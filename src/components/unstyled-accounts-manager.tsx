"use client"

import * as React from "react"
import * as Icons from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { useUser } from "@/lib/auth-context"
import { useAccounts } from "@/hooks/use-accounts"
import type { Account, AccountType } from "@/lib/types"

const accountTypes: AccountType[] = ["Cash", "Card", "Bank Account", "Deposit", "Loan"];

const accountIconMap: Record<AccountType, string> = {
    "Cash": "Wallet",
    "Card": "CreditCard",
    "Bank Account": "Landmark",
    "Deposit": "PiggyBank",
    "Loan": "HandCoins"
};


interface UnstyledAccountsManagerProps {
  accounts: Account[];
}

export function UnstyledAccountsManager({ accounts }: UnstyledAccountsManagerProps) {
  const { toast } = useToast()
  const { user } = useUser()
  const { refresh } = useAccounts()

  const [accountStyles, setAccountStyles] = React.useState<Record<string, { type: AccountType }>>({})
  const [savingId, setSavingId] = React.useState<string | null>(null)

  React.useEffect(() => {
    const initialStyles = accounts.reduce((acc, account) => {
      acc[account.id] = { type: account.type }
      return acc
    }, {} as Record<string, { type: AccountType }>)
    setAccountStyles(initialStyles)
  }, [accounts])

  const handleStyleChange = (accountId: string, field: 'type', value: string) => {
    setAccountStyles(prev => ({
      ...prev,
      [accountId]: { ...prev[accountId], [field]: value as AccountType }
    }))
  }

  const handleSave = async (accountId: string) => {
    if (!user) {
      toast({ title: "Error", description: "You must be logged in.", variant: "destructive" })
      return
    }

    const styles = accountStyles[accountId]
    if (!styles) return

    const icon = accountIconMap[styles.type] || "Landmark";
    const accountToUpdate = accounts.find(a => a.id === accountId);
    if (!accountToUpdate) return;

    try {
      setSavingId(accountId)
      const response = await fetch(`/api/accounts/${accountId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-uid": user.uid,
        },
        body: JSON.stringify({
          type: styles.type,
          icon,
          color: accountToUpdate.color,
        }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload?.message || "Failed to update account.")
      }

      refresh()

      toast({
        title: "Account Styled",
        description: "The account has been successfully updated.",
      })
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error?.message || "Failed to update account.",
      })
    } finally {
      setSavingId(null)
    }
  }

  if (accounts.length === 0) {
      return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Style New Accounts</CardTitle>
        <CardDescription>
          New accounts were created during your last import. Please specify their type.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {accounts.map((account) => (
          <div key={account.id} className="flex items-center justify-between gap-2 md:gap-4 p-3 border rounded-lg">
            <div className="flex items-center gap-3">
               <div className="h-5 w-5 rounded-full" style={{ backgroundColor: account.color }} />
               <span className="font-medium">{account.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={accountStyles[account.id]?.type || account.type}
                onValueChange={(value) => handleStyleChange(account.id, 'type', value)}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {accountTypes.map(type => {
                    const IconComponent = (Icons as any)[accountIconMap[type]];
                    return (
                      <SelectItem key={type} value={type}>
                        <div className="flex items-center gap-2">
                          {IconComponent && <IconComponent className="h-4 w-4" />}
                          <span>{type}</span>
                        </div>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                onClick={() => handleSave(account.id)}
                disabled={savingId === account.id}
              >
                {savingId === account.id ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
