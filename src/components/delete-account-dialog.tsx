"use client"

import * as React from "react"
import { doc } from "firebase/firestore"
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
import { useFirestore, useUser } from "@/firebase"
import { deleteDocumentNonBlocking } from "@/firebase/non-blocking-updates"

interface DeleteAccountDialogProps {
  accountId: string;
  children: React.ReactNode;
}

export function DeleteAccountDialog({ accountId, children }: DeleteAccountDialogProps) {
  const { toast } = useToast()
  const firestore = useFirestore()
  const { user } = useUser()

  const handleDelete = async () => {
    if (!user || !firestore) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "You must be logged in to delete an account.",
      })
      return
    }

    const accountRef = doc(firestore, `users/${user.uid}/accounts/${accountId}`);
    deleteDocumentNonBlocking(accountRef);

    toast({
      title: "Account Deleted",
      description: "The account has been successfully deleted.",
    })
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        {children}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete this
            account and all of its associated transactions.
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
