"use client"

import * as React from "react"
import { doc, runTransaction, getDoc } from "firebase/firestore"
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
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
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
        await runTransaction(firestore, async (dbTransaction) => {
            const transactionDoc = await dbTransaction.get(transactionRef);
            if (!transactionDoc.exists()) {
                throw new Error("Transaction not found!");
            }
            const transactionData = transactionDoc.data() as Transaction;

            if (transactionData.transactionType === 'transfer') {
                const fromAccountRef = doc(firestore, `users/${user.uid}/accounts/${transactionData.fromAccountId}`);
                const toAccountRef = doc(firestore, `users/${user.uid}/accounts/${transactionData.toAccountId}`);
                const fromAccountDoc = await dbTransaction.get(fromAccountRef);
                const toAccountDoc = await dbTransaction.get(toAccountRef);
                // Revert balances
                if (fromAccountDoc.exists()) {
                  dbTransaction.update(fromAccountRef, { balance: fromAccountDoc.data().balance + transactionData.amount });
                }
                if (toAccountDoc.exists()) {
                  dbTransaction.update(toAccountRef, { balance: toAccountDoc.data().balance - transactionData.amount });
                }
            } else {
                const accountRef = doc(firestore, `users/${user.uid}/accounts/${transactionData.accountId}`);
                const accountDoc = await dbTransaction.get(accountRef);
                 if (accountDoc.exists()) {
                    const currentBalance = accountDoc.data().balance;
                    // Reverse the transaction amount
                    const newBalance = transactionData.transactionType === 'expense'
                        ? currentBalance + transactionData.amount
                        : currentBalance - transactionData.amount;
                    dbTransaction.update(accountRef, { balance: newBalance });
                }
            }

            dbTransaction.delete(transactionRef);
        });

        toast({
            title: "Transaction Deleted",
            description: "The transaction has been successfully deleted.",
        });

    } catch (error: any) {
        console.error("Delete transaction failed: ", error);
        toast({
            variant: "destructive",
            title: "Error",
            description: error.message || "Failed to delete transaction.",
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
            transaction and update the associated account balance(s).
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
