"use client"

import * as React from "react"
import { doc, setDoc } from "firebase/firestore"
import { useDoc, useFirestore, useUser, useMemoFirebase } from "@/firebase"
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
import type { User, Currency } from "@/lib/types"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DeleteDataDialog } from "@/components/delete-data-dialog"

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
