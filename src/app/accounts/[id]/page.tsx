
"use client"

import * as React from "react"
import { doc } from "firebase/firestore"
import { useDoc, useFirestore, useUser, useMemoFirebase } from "@/firebase"
import AppLayout from "@/components/layout"
import type { Account } from "@/lib/types"
import { Skeleton } from "@/components/ui/skeleton"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

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

  if (isLoading) {
    return (
        <div className="p-4 lg:p-6 space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-64 w-full" />
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
        <Link href="/accounts">
            <Button variant="outline" size="icon">
                <ArrowLeft className="h-4 w-4" />
            </Button>
        </Link>
        <h1 className="text-lg font-semibold md:text-2xl">{account.name}</h1>
      </div>
       <div>
        <p>This is the detail page for account: {account.name}</p>
        <p>More content will be added in the next steps.</p>
      </div>
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
