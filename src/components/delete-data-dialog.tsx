"use client"

import * as React from "react"
import { collection, getDocs, writeBatch } from "firebase/firestore"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useToast } from "@/hooks/use-toast"
import { useFirestore, useUser } from "@/firebase"

type DeletionOption = "transactions" | "all"

export function DeleteDataDialog() {
  const [open, setOpen] = React.useState(false)
  const [deletionOption, setDeletionOption] = React.useState<DeletionOption | null>(null)
  const [confirmationText, setConfirmationText] = React.useState("")
  const [isDeleting, setIsDeleting] = React.useState(false);
  const { toast } = useToast()
  const { user } = useUser()
  const firestore = useFirestore()

  const CONFIRMATION_KEYWORD = "DELETE"
  const isDeleteButtonDisabled = deletionOption === null || confirmationText !== CONFIRMATION_KEYWORD || isDeleting

  const handleDelete = async () => {
    if (!user || !firestore || !deletionOption) {
      toast({ title: "Error", description: "An unexpected error occurred.", variant: "destructive" });
      return;
    }

    setIsDeleting(true);

    const collectionsToDelete: string[] = [];
    if (deletionOption === "transactions") {
      collectionsToDelete.push("transactions");
    } else if (deletionOption === "all") {
      collectionsToDelete.push("transactions", "accounts", "categories", "budgets", "recurringTransactions");
    }

    try {
      for (const collectionName of collectionsToDelete) {
        const collectionRef = collection(firestore, `users/${user.uid}/${collectionName}`);
        const querySnapshot = await getDocs(collectionRef);
        const BATCH_SIZE = 400; // Leave some room under the 500 limit

        for (let i = 0; i < querySnapshot.docs.length; i += BATCH_SIZE) {
          const batch = writeBatch(firestore);
          const chunk = querySnapshot.docs.slice(i, i + BATCH_SIZE);
          chunk.forEach((doc) => {
            batch.delete(doc.ref);
          });
          await batch.commit();
        }
      }

      toast({
        title: "Data Deleted",
        description: "Your selected data has been permanently deleted.",
      });

    } catch (error) {
      console.error("Error deleting data:", error);
      toast({
        title: "Error Deleting Data",
        description: "An error occurred while deleting your data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setOpen(false);
    }
  }
  
  React.useEffect(() => {
    if (!open) {
      setDeletionOption(null)
      setConfirmationText("")
      setIsDeleting(false);
    }
  }, [open])

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive">Delete Data</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action is irreversible. Please review your selection carefully before proceeding.
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div className="space-y-6 py-2">
          <RadioGroup value={deletionOption || ""} onValueChange={(value) => setDeletionOption(value as DeletionOption)}>
            <div className="flex items-center space-x-2 rounded-md border p-4">
              <RadioGroupItem value="transactions" id="r1" />
              <Label htmlFor="r1" className="flex flex-col space-y-1">
                <span>Delete all transactions</span>
                <span className="font-normal text-muted-foreground">
                  This will permanently delete all your expense, income, and transfer records. Your accounts and categories will remain.
                </span>
              </Label>
            </div>
            <div className="flex items-center space-x-2 rounded-md border p-4">
              <RadioGroupItem value="all" id="r2" />
              <Label htmlFor="r2" className="flex flex-col space-y-1">
                <span>Delete all data</span>
                <span className="font-normal text-muted-foreground">
                  This will permanently delete everything: transactions, accounts, categories, budgets, and recurring templates.
                </span>
              </Label>
            </div>
          </RadioGroup>

          <div>
            <Label htmlFor="confirmation" className="font-medium text-destructive">
              To confirm, please type '{CONFIRMATION_KEYWORD}' below:
            </Label>
            <Input
              id="confirmation"
              type="text"
              value={confirmationText}
              onChange={(e) => setConfirmationText(e.target.value)}
              placeholder={CONFIRMATION_KEYWORD}
              className="mt-2"
              autoComplete="off"
            />
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleteButtonDisabled}
          >
            {isDeleting ? "Deleting..." : "Delete Data"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
