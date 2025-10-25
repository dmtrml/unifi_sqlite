"use client"

import * as React from "react"
import { Edit } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { DropdownMenuItem } from "./ui/dropdown-menu"
import type { RecurringTransaction, Category, Account } from "@/lib/types"

interface EditRecurringTransactionDialogProps {
  recurringTransaction: RecurringTransaction;
  categories: Category[];
  accounts: Account[];
}


export function EditRecurringTransactionDialog({ recurringTransaction, categories, accounts }: EditRecurringTransactionDialogProps) {
  const [open, setOpen] = React.useState(false)
  
  // TODO: Implement the form and logic
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
          <Edit className="mr-2 h-4 w-4" />
          Edit
        </DropdownMenuItem>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Edit Recurring Transaction</DialogTitle>
          <DialogDescription>
            Update the details of your recurring transaction template.
          </DialogDescription>
        </DialogHeader>
        <div className="py-8 text-center text-muted-foreground">
            <p>Form coming soon...</p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
