"use client"

import * as React from "react"
import { doc } from "firebase/firestore"
import * as Icons from "lucide-react"
import { useDoc, useFirestore, useUser, useMemoFirebase } from "@/firebase"
import AppLayout from "@/components/layout"
import type { Account } from "@/lib/types"
import { Skeleton } from "@/components/ui/skeleton"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
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

interface AccountPageParams {
    params: {
        id: string
    }
}

function AccountPageContent({ accountId }: { accountId: string}) {
  const { user } = useUser()
  const firestore = useFirestore()

  const accountDocRef = useMemoFirebase(
    () => (user ? doc(firestore, "users", user.uid, "accounts", accountId) : null),
    [user, firestore, accountId]
  )
  const { data: account, isLoading } = useDoc<Account>(accountDocRef)
  
  const IconComponent = account ? (Icons as any)[account.icon] || Icons.HelpCircle : Icons.HelpCircle;

  if (isLoading) {
    return (
        <div className="p-4 lg:p-6 space-y-6">
            <div className="flex items-center gap-4">
              <Skeleton className="h-10 w-10" />
              <Skeleton className="h-8 w-48" />
            </div>
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-12 w-full" />
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
            <Button variant="outline" size="icon">
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
            <EditAccountDialog account={account} />
            <DeleteAccountDialog accountId={account.id} />
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
              <p>Transaction list will be implemented in the next step.</p>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="analytics">
          <Card>
            <CardHeader>
              <CardTitle>Analytics</CardTitle>
              <CardDescription>Visual insights into this account's activity.</CardDescription>
            </CardHeader>
            <CardContent>
              <p>Analytics charts will be implemented in a future step.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </main>
  );
}


export default function AccountPage({ params }: AccountPageParams) {
  return (
    <AppLayout>
      <AccountPageContent accountId={params.id} />
    </AppLayout>
  )
}
