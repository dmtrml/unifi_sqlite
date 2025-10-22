"use client"

import * as React from "react"
import { doc, runTransaction } from "firebase/firestore"
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
import { useFirestore, useUser, useDoc } from "@/firebase"
import { DropdownMenuItem } from "./ui/dropdown-menu"
import type { Transaction } from "@/lib/types"

interface DeleteTransactionDialogProps {
  transactionId: string;
}

export function DeleteTransactionDialog({ transactionId }: DeleteTransactionDialogProps) {
  const { toast } = useToast()
  const firestore = useFirestore()
  const { user } = useUser()

  const handleDelete = async () => {
    if (!user || !firestore) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "You must be logged in to delete a transaction.",
      })
      return
    }

    const transactionRef = doc(firestore, `users/${user.uid}/transactions/${transactionId}`);
    
    try {
        await runTransaction(firestore, async (transaction) => {
            const transactionDoc = await transaction.get(transactionRef);
            if (!transactionDoc.exists()) {
                throw "Transaction not found!";
            }
            const transactionData = transactionDoc.data() as Transaction;
            const accountRef = doc(firestore, `users/${user.uid}/accounts/${transactionData.accountId}`);
            const accountDoc = await transaction.get(accountRef);

            if (!accountDoc.exists()) {
                // If account doesn't exist, just delete the transaction
                transaction.delete(transactionRef);
                return;
            }

            const currentBalance = accountDoc.data().balance;
            // Reverse the transaction amount
            const newBalance = transactionData.transactionType === 'expense'
                ? currentBalance + transactionData.amount
                : currentBalance - transactionData.amount;

            transaction.update(accountRef, { balance: newBalance });
            transaction.delete(transactionRef);
        });

        toast({
            title: "Transaction Deleted",
            description: "The transaction has been successfully deleted.",
        });

    } catch (error) {
        console.error("Delete transaction failed: ", error);
        toast({
            variant: "destructive",
            title: "Error",
            description: "Failed to delete transaction.",
        });
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
            transaction and update the associated account balance.
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
