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
import { DropdownMenuItem } from "./ui/dropdown-menu"
import { useToast } from "@/hooks/use-toast"
import { useUser } from "@/firebase"
import { mutate } from "swr"
import { recurringApi, recurringKey } from "@/hooks/use-recurring-transactions"


interface DeleteRecurringTransactionDialogProps {
  recurringTransactionId: string;
}

export function DeleteRecurringTransactionDialog({ recurringTransactionId }: DeleteRecurringTransactionDialogProps) {
  const { toast } = useToast()
  const { user } = useUser()
  const [isDeleting, setIsDeleting] = React.useState(false)

  const handleDelete = async () => {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "You must be logged in to delete a recurring transaction.",
      })
      return
    }

    try {
      setIsDeleting(true)
      await recurringApi.remove(user.uid, recurringTransactionId)
      mutate(recurringKey(user.uid))
      toast({
        title: "Recurring Transaction Deleted",
        description: "The recurring transaction template has been successfully deleted.",
      })
    } catch (error) {
      console.error("Error deleting recurring transaction", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete recurring transaction.",
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
            recurring transaction template.
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
