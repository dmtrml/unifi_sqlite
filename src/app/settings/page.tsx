

"use client"

import * as React from "react"
import Link from "next/link"
import { useUser } from "@/lib/auth-context"
import { useCategories } from "@/hooks/use-categories"
import { useAccounts } from "@/hooks/use-accounts"
import { useTransactions } from "@/hooks/use-transactions"
import { useUserProfile } from "@/hooks/use-user-profile"
import AppLayout from "@/components/layout"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import type { Currency, Transaction, Category, Account } from "@/lib/types"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DeleteDataDialog } from "@/components/delete-data-dialog"
import { format } from "date-fns"
import { Upload } from "lucide-react"

const currencies: Currency[] = ["USD", "EUR", "JPY", "GBP", "CHF", "CAD", "AUD", "CNY", "INR", "ARS", "RUB"];

function SettingsPageContent() {
  const { user } = useUser()
  const { toast } = useToast()
  const { profile, saveProfile, isLoading: profileLoading } = useUserProfile()

  const { transactions } = useTransactions({ sort: "desc" });
  const { categories } = useCategories();
  const { accounts } = useAccounts();

  const [mainCurrency, setMainCurrency] = React.useState<Currency>("USD")

  React.useEffect(() => {
    if (profile?.mainCurrency) {
      setMainCurrency(profile.mainCurrency)
    }
  }, [profile])

  const handleSaveSettings = async () => {
    if (!user) {
      toast({ title: "Error", description: "You must be logged in.", variant: "destructive" });
      return
    }

    try {
      await saveProfile({
        mainCurrency,
        email: user.email ?? profile?.email,
      })
      toast({
        title: "Settings Saved",
        description: "Your settings have been successfully updated.",
      })
    } catch (error) {
      console.error("Error updating settings: ", error)
      toast({
        title: "Error",
        description: "Failed to update settings.",
        variant: "destructive",
      })
    }
  }

   const handleExportTransactions = () => {
    if (!transactions || !categories || !accounts) {
      toast({
        title: "Error",
        description: "Data not loaded yet. Please try again in a moment.",
        variant: "destructive",
      });
      return;
    }

    const sortedTransactions = [...transactions].sort((a, b) => b.date.toDate().getTime() - a.date.toDate().getTime());

    const getAccount = (id?: string) => accounts.find(a => a.id === id);
    const getCategory = (id?: string) => categories.find(c => c.id === id);

    const headers = [
      "date", "categoryName", "comment", 
      "outcomeAccountName", "outcome", "outcomeCurrency",
      "incomeAccountName", "income", "incomeCurrency"
    ];

    const csvRows = [headers.join(",")];

    sortedTransactions.forEach(t => {
      const date = format(t.date.toDate(), "yyyy-MM-dd");
      const comment = t.description?.replace(/"/g, '""').trim() || '';
      
      let categoryName = '';
      let outcomeAccountName = '';
      let outcome = '';
      let outcomeCurrency = '';
      let incomeAccountName = '';
      let income = '';
      let incomeCurrency = '';

      if (t.transactionType === 'expense') {
        const acc = getAccount(t.accountId);
        const cat = getCategory(t.categoryId);
        categoryName = cat?.name || 'Uncategorized';
        outcomeAccountName = acc?.name || 'N/A';
        outcome = String(t.amount || 0);
        outcomeCurrency = acc?.currency || '';
      } else if (t.transactionType === 'income') {
        const acc = getAccount(t.accountId);
        const cat = getCategory(t.categoryId);
        categoryName = cat?.name || 'Uncategorized';
        incomeAccountName = acc?.name || 'N/A';
        income = String(t.amount || 0);
        incomeCurrency = acc?.currency || '';
      } else if (t.transactionType === 'transfer') {
        const fromAccount = getAccount(t.fromAccountId);
        const toAccount = getAccount(t.toAccountId);
        const isMultiCurrency = fromAccount?.currency !== toAccount?.currency;
        
        outcomeAccountName = fromAccount?.name || 'N/A';
        outcomeCurrency = fromAccount?.currency || '';
        incomeAccountName = toAccount?.name || 'N/A';
        incomeCurrency = toAccount?.currency || '';

        if (isMultiCurrency) {
            outcome = String(t.amountSent || 0);
            income = String(t.amountReceived || 0);
        } else {
            outcome = String(t.amount || 0);
            income = String(t.amount || 0);
        }
      }

      const row = [
        date, categoryName, comment,
        outcomeAccountName, outcome, outcomeCurrency,
        incomeAccountName, income, incomeCurrency
      ];
       const csvRow = row.map(val => {
            const strVal = String(val);
            // Add quotes only if the value contains a comma
            if (strVal.includes(',')) {
                return `"${strVal.replace(/"/g, '""')}"`;
            }
            return strVal;
        }).join(",");
      csvRows.push(csvRow);
    });

    const csvString = csvRows.join("\n");
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "transactions.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: "Export Successful",
      description: "Your transactions have been exported to transactions.csv.",
    });
  };

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
      <Card>
        <CardHeader>
          <CardTitle>Currency</CardTitle>
          <CardDescription>
            Set your main currency for reports and summaries.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="space-y-2">
                 <Label htmlFor="main-currency">Main Currency</Label>
                 <Select value={mainCurrency} onValueChange={(value) => setMainCurrency(value as Currency)}>
                    <SelectTrigger className="w-[180px]" id="main-currency">
                        <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                        {currencies.map(currency => (
                            <SelectItem key={currency} value={currency}>{currency}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </CardContent>
      </Card>
       <div className="flex justify-end">
          <Button onClick={handleSaveSettings} disabled={profileLoading}>
            {profileLoading ? "Loading..." : "Save Settings"}
          </Button>
        </div>

      <Card>
        <CardHeader>
          <CardTitle>Data Management</CardTitle>
          <CardDescription>
            Export your data or import new transactions.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button variant="outline" onClick={handleExportTransactions}>Export Transactions</Button>
          <Button variant="outline" asChild>
            <Link href="/import">
              <Upload className="mr-2 h-4 w-4" />
              Import Transactions
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Start Over</CardTitle>
          <CardDescription>
            Reset your application data. These actions are irreversible.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DeleteDataDialog />
        </CardContent>
      </Card>
    </main>
  )
}

export default function SettingsPage() {
  return (
    <AppLayout>
      <SettingsPageContent />
    </AppLayout>
  )
}
