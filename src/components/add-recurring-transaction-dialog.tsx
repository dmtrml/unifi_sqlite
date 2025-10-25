"use client"

import * as React from "react"
import { PlusCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"


export function AddRecurringTransactionDialog() {
  const [open, setOpen] = React.useState(false)
  
  // TODO: Implement the form and logic
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="relative ml-auto">
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Recurring Transaction
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Add Recurring Transaction</DialogTitle>
          <DialogDescription>
            Create a new template for recurring transactions. This will not create a transaction immediately.
          </DialogDescription>
        </DialogHeader>
        <div className="py-8 text-center text-muted-foreground">
            <p>Form coming soon...</p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
