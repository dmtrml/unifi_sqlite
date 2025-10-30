
"use client"

import * as React from "react"
import Link from "next/link"
import { doc, setDoc, collection, query } from "firebase/firestore"
import { useDoc, useFirestore, useUser, useMemoFirebase, useCollection } from "@/firebase"
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
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import type { User, Currency, Transaction, Category, Account } from "@/lib/types"
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
  const firestore = useFirestore()
  const { toast } = useToast()

  const userDocRef = useMemoFirebase(
    () => (user ? doc(firestore, "users", user.uid) : null),
    [user, firestore]
  )
  const { data: userData } = useDoc<User>(userDocRef)

  const transactionsQuery = useMemoFirebase(() => 
    user ? query(collection(firestore, "users", user.uid, "transactions")) : null, 
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

  const [isDarkTheme, setIsDarkTheme] = React.useState(false)
  const [mainCurrency, setMainCurrency] = React.useState<Currency>("USD")

  React.useEffect(() => {
    if (userData) {
      setIsDarkTheme(userData.theme === 'dark')
      if (userData.mainCurrency) {
        setMainCurrency(userData.mainCurrency)
      }
    }
  }, [userData])

  const handleSaveSettings = async () => {
    if (!user || !firestore) {
      toast({ title: "Error", description: "You must be logged in.", variant: "destructive" });
      return
    }

    const newTheme = isDarkTheme ? 'dark' : 'light'
    
    try {
      const userRef = doc(firestore, "users", user.uid)
      const dataToSave: Partial<User> = {
        theme: newTheme,
        mainCurrency: mainCurrency,
        id: user.uid,
        email: user.email,
      };

      await setDoc(userRef, dataToSave, { merge: true })
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

    const getAccount = (id?: string) => accounts.find(a => a.id === id);
    const getCategory = (id?: string) => categories.find(c => c.id === id);

    const headers = [
      "Date", "Description", "Type", "Amount", "Currency", "Category", 
      "Account", "From Account", "To Account", "Amount Sent", "Amount Received"
    ];

    const csvRows = [headers.join(",")];

    transactions.forEach(t => {
      const date = format(t.date.toDate(), "yyyy-MM-dd");
      const description = `"${t.description?.replace(/"/g, '""') || ''}"`;
      const type = t.transactionType;
      
      let row: (string | number | undefined)[] = [date, description, type];

      if (type === 'transfer') {
        const fromAccount = getAccount(t.fromAccountId);
        const toAccount = getAccount(t.toAccountId);
        row.push(
          '', // Amount
          '', // Currency
          '', // Category
          '', // Account
          fromAccount?.name || 'N/A',
          toAccount?.name || 'N/A',
          t.amountSent,
          t.amountReceived
        );
      } else {
        const account = getAccount(t.accountId);
        const category = getCategory(t.categoryId);
        row.push(
          t.amount,
          account?.currency || '',
          category?.name || 'Uncategorized',
          account?.name || 'N/A',
          '', // From Account
          '', // To Account
          '', // Amount Sent
          ''  // Amount Received
        );
      }
      csvRows.push(row.join(","));
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
      <div className="flex items-center">
        <h1 className="text-lg font-semibold md:text-2xl">Settings</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>
            Customize the look and feel of the application.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center space-x-2">
            <Switch 
              id="dark-theme" 
              checked={isDarkTheme}
              onCheckedChange={setIsDarkTheme}
            />
            <Label htmlFor="dark-theme">Dark Theme</Label>
          </div>
        </CardContent>
      </Card>
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
          <Button onClick={handleSaveSettings}>Save Settings</Button>
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
