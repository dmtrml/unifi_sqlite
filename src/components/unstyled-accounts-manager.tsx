"use client"

import * as React from "react"
import { doc } from "firebase/firestore"
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
import { useFirestore, useUser } from "@/firebase"
import { updateDocumentNonBlocking } from "@/firebase/non-blocking-updates"
import type { Account, AccountType } from "@/lib/types"

const accountTypes: AccountType[] = ["Cash", "Card", "Bank Account", "Deposit", "Loan"];

const accountIconMap: Record<AccountType, string> = {
    "Cash": "Wallet",
    "Card": "CreditCard",
    "Bank Account": "Landmark",
    "Deposit": "PiggyBank",
    "Loan": "HandCoins"
};

const colorOptions = [
    { value: "hsl(var(--chart-1))", label: "Teal" },
    { value: "hsl(var(--chart-2))", label: "Blue" },
    { value: "hsl(var(--chart-3))", label: "Green" },
    { value: "hsl(var(--chart-4))", label: "Purple" },
    { value: "hsl(var(--chart-5))", label: "Indigo" },
];

interface UnstyledAccountsManagerProps {
  accounts: Account[];
}

export function UnstyledAccountsManager({ accounts }: UnstyledAccountsManagerProps) {
  const { toast } = useToast()
  const firestore = useFirestore()
  const { user } = useUser()

  const [accountStyles, setAccountStyles] = React.useState<Record<string, { type: AccountType; color: string }>>({})

  React.useEffect(() => {
    const initialStyles = accounts.reduce((acc, account) => {
      acc[account.id] = { type: account.type, color: account.color }
      return acc
    }, {} as Record<string, { type: AccountType; color: string }>)
    setAccountStyles(initialStyles)
  }, [accounts])

  const handleStyleChange = (accountId: string, field: 'type' | 'color', value: string) => {
    setAccountStyles(prev => ({
      ...prev,
      [accountId]: { ...prev[accountId], [field]: value as AccountType }
    }))
  }

  const handleSave = (accountId: string) => {
    if (!user || !firestore) {
      toast({ title: "Error", description: "You must be logged in.", variant: "destructive" })
      return
    }

    const styles = accountStyles[accountId]
    if (!styles) return

    const icon = accountIconMap[styles.type] || "Landmark";

    const accountRef = doc(firestore, `users/${user.uid}/accounts/${accountId}`)
    updateDocumentNonBlocking(accountRef, {
      type: styles.type,
      icon: icon,
      color: styles.color,
    })

    toast({
      title: "Account Styled",
      description: "The account has been successfully updated.",
    })
  }

  if (accounts.length === 0) {
      return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Style New Accounts</CardTitle>
        <CardDescription>
          New accounts were created during your last import. Customize their appearance below.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {accounts.map((account) => (
          <div key={account.id} className="flex items-center justify-between gap-2 md:gap-4 p-3 border rounded-lg">
            <div className="font-medium">{account.name}</div>
            <div className="flex items-center gap-2">
              <Select
                value={accountStyles[account.id]?.type || account.type}
                onValueChange={(value) => handleStyleChange(account.id, 'type', value)}
              >
                <SelectTrigger className="w-[150px]">
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
              <Select
                value={accountStyles[account.id]?.color || account.color}
                onValueChange={(value) => handleStyleChange(account.id, 'color', value)}
              >
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Select color" />
                </SelectTrigger>
                <SelectContent>
                  {colorOptions.map(opt => (
                     <SelectItem key={opt.value} value={opt.value}>
                        <div className="flex items-center gap-2">
                            <div className="h-4 w-4 rounded-full" style={{ backgroundColor: opt.value }} />
                            {opt.label}
                        </div>
                     </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={() => handleSave(account.id)}>Save</Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
