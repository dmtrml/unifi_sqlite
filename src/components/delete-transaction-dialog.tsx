"use client"

import * as React from "react"
import { Trash2 } from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import { useUser } from "@/lib/auth-context"
import { useAccounts } from "@/hooks/use-accounts"
import { notifyTransactionsChanged } from "@/lib/transactions-events"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
interface DeleteTransactionDialogProps {
  transactionId: string;
}

export function DeleteTransactionDialog({ transactionId }: DeleteTransactionDialogProps) {
  const { toast } = useToast()
  const { user } = useUser()
  const { refresh: refreshAccounts } = useAccounts()
  const [isDeleting, setIsDeleting] = React.useState(false)

  const handleDelete = async () => {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "You must be logged in to delete a transaction.",
      })
      return
    }

    try {
      setIsDeleting(true)
      const response = await fetch(`/api/transactions/${transactionId}`, {
        method: "DELETE",
        headers: {
          "x-uid": user.uid,
        },
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload?.message || "Failed to delete transaction.")
      }

      refreshAccounts()
      notifyTransactionsChanged()

      toast({
        title: "Transaction Deleted",
        description: "The transaction has been successfully deleted.",
      })
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error?.message || "Failed to delete transaction.",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
         <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive">
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete this
            transaction and update the associated account balance(s).
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? "Deleting..." : "Continue"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
