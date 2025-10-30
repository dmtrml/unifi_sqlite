"use client"

import * as React from "react"
import { collection, query } from "firebase/firestore"
import { useCollection, useFirestore, useUser, useMemoFirebase } from "@/firebase"
import AppLayout from "@/components/layout"
import { useRouter } from "next/navigation"

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
  DropdownMenuItem,
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
import { UnstyledAccountsManager } from "@/components/unstyled-accounts-manager"


function AccountsPageContent() {
  const { user } = useUser()
  const firestore = useFirestore()
  const router = useRouter();

  const accountsQuery = useMemoFirebase(() =>
    user ? query(collection(firestore, "users", user.uid, "accounts")) : null,
    [user, firestore]
  );
  const { data: accounts } = useCollection<Account>(accountsQuery);

  const [styledAccounts, unstyledAccounts] = React.useMemo(() => {
    const allAccounts = accounts || [];
    const unstyled = allAccounts.filter(a => a.icon === "Landmark" && a.color === "hsl(var(--muted-foreground))");
    const styled = allAccounts.filter(a => !unstyled.some(ua => ua.id === a.id));
    return [styled, unstyled];
  }, [accounts]);

  const handleRowClick = (accountId: string) => {
    router.push(`/accounts/${accountId}`);
  };

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
      <div className="flex items-center">
        <h1 className="text-lg font-semibold md:text-2xl">Accounts</h1>
      </div>

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
            <div className="ml-auto">
                <AddAccountDialog />
            </div>
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
                {styledAccounts.map((account) => {
                  const IconComponent = (Icons as any)[account.icon] || Icons.MoreHorizontal;
                  return (
                    <TableRow key={account.id} onClick={() => handleRowClick(account.id)} className="cursor-pointer">
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
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <EditAccountDialog account={account}>
                               <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                    <Icons.Edit className="mr-2 h-4 w-4" />
                                    Edit
                                </DropdownMenuItem>
                            </EditAccountDialog>
                            <DeleteAccountDialog accountId={account.id}>
                                <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive">
                                    <Icons.Trash2 className="mr-2 h-4 w-4" />
                                    Delete
                                </DropdownMenuItem>
                            </DeleteAccountDialog>
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
