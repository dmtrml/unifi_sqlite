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
import type { User } from "@/lib/types"

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

  React.useEffect(() => {
    if (userData?.theme) {
      setIsDarkTheme(userData.theme === 'dark')
    }
  }, [userData])

  const handleThemeChange = async (checked: boolean) => {
    if (!user || !firestore) {
      toast({ title: "Error", description: "You must be logged in.", variant: "destructive" });
      return
    }

    const newTheme = checked ? 'dark' : 'light'
    setIsDarkTheme(checked)
    
    try {
      const userRef = doc(firestore, "users", user.uid)
      // Use setDoc with merge to create the document if it doesn't exist, or update it if it does.
      await setDoc(userRef, { theme: newTheme, id: user.uid, email: user.email }, { merge: true })
      toast({
        title: "Theme Updated",
        description: `Theme changed to ${newTheme}.`,
      })
    } catch (error) {
      console.error("Error updating theme: ", error)
      toast({
        title: "Error",
        description: "Failed to update theme.",
        variant: "destructive",
      })
      // Revert UI change on error
      setIsDarkTheme(!checked)
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
        <CardContent>
          <div className="flex items-center space-x-2">
            <Switch 
              id="dark-theme" 
              checked={isDarkTheme}
              onCheckedChange={handleThemeChange}
            />
            <Label htmlFor="dark-theme">Dark Theme</Label>
          </div>
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
