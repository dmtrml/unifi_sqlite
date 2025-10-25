"use client"

import * as React from "react"
import { Trash2 } from "lucide-react"
import { doc } from "firebase/firestore"

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
import { DropdownMenuItem } from "./ui/dropdown-menu"
import { useToast } from "@/hooks/use-toast"
import { useFirestore, useUser } from "@/firebase"
import { deleteDocumentNonBlocking } from "@/firebase/non-blocking-updates"


interface DeleteRecurringTransactionDialogProps {
  recurringTransactionId: string;
}

export function DeleteRecurringTransactionDialog({ recurringTransactionId }: DeleteRecurringTransactionDialogProps) {
  const { toast } = useToast()
  const firestore = useFirestore()
  const { user } = useUser()

  const handleDelete = async () => {
    if (!user || !firestore) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "You must be logged in to delete a recurring transaction.",
      })
      return
    }

    const recurringRef = doc(firestore, `users/${user.uid}/recurringTransactions/${recurringTransactionId}`);
    deleteDocumentNonBlocking(recurringRef);

    toast({
      title: "Recurring Transaction Deleted",
      description: "The recurring transaction template has been successfully deleted.",
    })
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
            recurring transaction template.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete}>Continue</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
