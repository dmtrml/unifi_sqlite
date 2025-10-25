"use client"

import * as React from "react"
import { collection, query } from "firebase/firestore"
import { useCollection, useFirestore, useUser, useMemoFirebase } from "@/firebase"
import AppLayout from "@/components/layout"

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { AddAccountDialog } from "@/components/add-account-dialog"
import { EditAccountDialog } from "@/components/edit-account-dialog"
import { DeleteAccountDialog } from "@/components/delete-account-dialog"
import type { Account } from "@/lib/types"
import * as Icons from "lucide-react"
import { MoreHorizontal } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"


function AccountsPageContent() {
  const { user } = useUser()
  const firestore = useFirestore()

  const accountsQuery = useMemoFirebase(() =>
    user ? query(collection(firestore, "users", user.uid, "accounts")) : null,
    [user, firestore]
  );
  const { data: accounts } = useCollection<Account>(accountsQuery);
  const safeAccounts = accounts || [];

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
      <div className="flex items-center">
        <h1 className="text-lg font-semibold md:text-2xl">Accounts</h1>
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center">
          <div className="grid gap-2">
            <CardTitle>Accounts</CardTitle>
            <CardDescription>
              Manage your financial accounts.
            </CardDescription>
          </div>
          <AddAccountDialog />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {safeAccounts.map((account) => {
                 const IconComponent = (Icons as any)[account.icon] || Icons.MoreHorizontal;
                return (
                  <TableRow key={account.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                         <IconComponent className="h-5 w-5" style={{ color: account.color }} />
                        {account.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{account.type}</Badge>
                    </TableCell>
                    <TableCell>
                      {new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: account.currency || 'USD',
                      }).format(account.balance)}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <EditAccountDialog account={account} />
                          <DeleteAccountDialog accountId={account.id} />
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
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
