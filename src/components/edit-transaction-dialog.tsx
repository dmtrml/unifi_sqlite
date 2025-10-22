"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { CalendarIcon, Edit } from "lucide-react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { format } from "date-fns"
import { doc, runTransaction } from "firebase/firestore"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover"
import { cn } from "@/lib/utils"
import { Calendar } from "./ui/calendar"
import { useToast } from "@/hooks/use-toast"
import { useFirestore, useUser } from "@/firebase"
import type { Category, Account, Transaction } from "@/lib/types"
import { DropdownMenuItem } from "./ui/dropdown-menu"

const editTransactionFormSchema = z.object({
  description: z.string().min(1, "Description is required."),
  amount: z.coerce.number().positive("Amount must be positive."),
  accountId: z.string().min(1, "Account is required."),
  categoryId: z.string().min(1, "Category is required."),
  date: z.date(),
  transactionType: z.enum(["expense", "income"]),
})

type EditTransactionFormValues = z.infer<typeof editTransactionFormSchema>

interface EditTransactionDialogProps {
  transaction: Transaction;
  categories: Category[];
  accounts: Account[];
}

export function EditTransactionDialog({ transaction: originalTransaction, categories, accounts }: EditTransactionDialogProps) {
  const [open, setOpen] = React.useState(false)
  const { toast } = useToast()
  const firestore = useFirestore()
  const { user } = useUser()

  const form = useForm<EditTransactionFormValues>({
    resolver: zodResolver(editTransactionFormSchema),
    defaultValues: {
      ...originalTransaction,
      date: originalTransaction.date.toDate(),
    },
  })

  async function onSubmit(data: EditTransactionFormValues) {
    if (!user || !firestore) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "You must be logged in to edit a transaction.",
      })
      return
    }

    const transactionRef = doc(firestore, `users/${user.uid}/transactions/${originalTransaction.id}`);
    
    try {
        await runTransaction(firestore, async (transaction) => {
            // 1. Get original transaction data from the server for consistency
            const originalDoc = await transaction.get(transactionRef);
            if (!originalDoc.exists()) {
                throw "Original transaction not found!";
            }
            const originalData = originalDoc.data() as Transaction;
            
            // 2. Revert old transaction from the original account
            const originalAccountRef = doc(firestore, `users/${user.uid}/accounts/${originalData.accountId}`);
            const originalAccountDoc = await transaction.get(originalAccountRef);
            if (originalAccountDoc.exists()) {
                const originalBalance = originalAccountDoc.data().balance;
                const revertedBalance = originalData.transactionType === 'expense'
                    ? originalBalance + originalData.amount
                    : originalBalance - originalData.amount;
                transaction.update(originalAccountRef, { balance: revertedBalance });
            }

            // 3. Apply new transaction to the new/updated account
            const newAccountRef = doc(firestore, `users/${user.uid}/accounts/${data.accountId}`);
            const newAccountDoc = await transaction.get(newAccountRef);
            if (!newAccountDoc.exists()) {
                throw "New account not found!";
            }
            const newBalance = newAccountDoc.data().balance;
            const updatedBalance = data.transactionType === 'expense'
                ? newBalance - data.amount
                : newBalance + data.amount;
            transaction.update(newAccountRef, { balance: updatedBalance });

            // 4. Update the transaction document itself
            transaction.update(transactionRef, data);
        });

        toast({
            title: "Transaction Updated",
            description: "Your transaction and account balances have been successfully updated.",
        });

        setOpen(false)

    } catch (error) {
        console.error("Transaction update failed: ", error);
        toast({
            variant: "destructive",
            title: "Error",
            description: "Failed to update transaction. Balances have been reverted.",
        });
    }
  }

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
          <DialogTitle>Edit Transaction</DialogTitle>
          <DialogDescription>
            Update the details of your transaction.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
               <FormField
                control={form.control}
                name="transactionType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select transaction type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="expense">Expense</SelectItem>
                        <SelectItem value="income">Income</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="$0.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
             <div className="grid grid-cols-2 gap-4">
                <FormField
                    control={form.control}
                    name="accountId"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Account</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                            <SelectTrigger>
                            <SelectValue placeholder="Select an account" />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            {accounts.map((account) => (
                            <SelectItem key={account.id} value={account.id}>
                                {account.name}
                            </SelectItem>
                            ))}
                        </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="categoryId"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                            <SelectTrigger>
                            <SelectValue placeholder="Select a category" />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            {categories.map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                                {category.name}
                            </SelectItem>
                            ))}
                        </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                    )}
                />
             </div>
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea placeholder="e.g., Groceries from Walmart" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Date of transaction</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP")
                          ) : (
                            <span>Pick a date</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit">Save Changes</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
