"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { CalendarIcon, Edit, ArrowRightLeft } from "lucide-react"
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { Calendar } from "@/components/ui/calendar"
import { useToast } from "@/hooks/use-toast"
import { useFirestore, useUser } from "@/firebase"
import type { Category, Account, Transaction } from "@/lib/types"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"

const editTransactionFormSchema = z.object({
  description: z.string().optional(),
  amount: z.coerce.number().positive("Amount must be positive."),
  accountId: z.string().optional(),
  categoryId: z.string().optional(),
  fromAccountId: z.string().optional(),
  toAccountId: z.string().optional(),
  date: z.date(),
  transactionType: z.enum(["expense", "income", "transfer"]),
}).refine(data => {
    if (data.transactionType === 'transfer') {
        return !!data.fromAccountId && !!data.toAccountId && data.fromAccountId !== data.toAccountId;
    }
    return !!data.accountId && !!data.categoryId;
}, {
    message: "Invalid account or category selection for transaction type.",
    path: ["accountId"],
});


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
      description: originalTransaction.description || "",
    },
  })
  
  const transactionType = form.watch("transactionType");

  const filteredCategories = React.useMemo(() => {
    if (transactionType === 'expense') {
      return categories.filter(c => c.type === 'expense' || !c.type);
    }
     if (transactionType === 'income') {
      return categories.filter(c => c.type === 'income');
    }
    return [];
  }, [categories, transactionType]);


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
        await runTransaction(firestore, async (dbTransaction) => {
            const originalDoc = await dbTransaction.get(transactionRef);
            if (!originalDoc.exists()) {
                throw new Error("Original transaction not found!");
            }
            const originalData = originalDoc.data() as Transaction;
            
            const newData = {
              ...data,
              description: data.description || ""
            }

            // Revert old transaction
            if (originalData.transactionType === 'transfer') {
                const fromAccRef = doc(firestore, `users/${user.uid}/accounts/${originalData.fromAccountId}`);
                const toAccRef = doc(firestore, `users/${user.uid}/accounts/${originalData.toAccountId}`);
                const fromAccDoc = await dbTransaction.get(fromAccRef);
                const toAccDoc = await dbTransaction.get(toAccRef);
                if (fromAccDoc.exists()) dbTransaction.update(fromAccRef, { balance: fromAccDoc.data().balance + originalData.amount });
                if (toAccDoc.exists()) dbTransaction.update(toAccRef, { balance: toAccDoc.data().balance - originalData.amount });
            } else {
                 const accRef = doc(firestore, `users/${user.uid}/accounts/${originalData.accountId}`);
                 const accDoc = await dbTransaction.get(accRef);
                 if (accDoc.exists()) {
                     const revertedBalance = originalData.transactionType === 'expense' ? accDoc.data().balance + originalData.amount : accDoc.data().balance - originalData.amount;
                     dbTransaction.update(accRef, { balance: revertedBalance });
                 }
            }

            // Apply new transaction
            if (newData.transactionType === 'transfer') {
                 const fromAccRef = doc(firestore, `users/${user.uid}/accounts/${newData.fromAccountId}`);
                 const toAccRef = doc(firestore, `users/${user.uid}/accounts/${newData.toAccountId}`);
                 const fromAccDoc = await dbTransaction.get(fromAccRef);
                 const toAccDoc = await dbTransaction.get(toAccRef);
                 if (!fromAccDoc.exists() || !toAccDoc.exists()) throw new Error("Account not found for transfer.");
                 
                 dbTransaction.update(fromAccRef, { balance: fromAccDoc.data().balance - newData.amount });
                 dbTransaction.update(toAccRef, { balance: toAccDoc.data().balance + newData.amount });
                 dbTransaction.update(transactionRef, {...newData, accountId: null, categoryId: null});
            } else {
                const accRef = doc(firestore, `users/${user.uid}/accounts/${newData.accountId}`);
                const accDoc = await dbTransaction.get(accRef);
                if (!accDoc.exists()) throw new Error("Account not found.");

                const newBalance = newData.transactionType === 'expense' ? accDoc.data().balance - newData.amount : accDoc.data().balance + newData.amount;
                dbTransaction.update(accRef, { balance: newBalance });
                dbTransaction.update(transactionRef, {...newData, fromAccountId: null, toAccountId: null});
            }
        });

        toast({
            title: "Transaction Updated",
            description: "Your transaction has been successfully updated.",
        });
        setOpen(false);
    } catch (error: any) {
        console.error("Transaction update failed: ", error);
        toast({
            variant: "destructive",
            title: "Error",
            description: error.message || "Failed to update transaction. Balances have not been changed.",
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
              <FormField
                control={form.control}
                name="transactionType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select onValueChange={(value) => {
                      field.onChange(value);
                      form.setValue('categoryId', '');
                      form.setValue('accountId', '');
                      form.setValue('fromAccountId', '');
                      form.setValue('toAccountId', '');
                    }} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select transaction type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="expense">Expense</SelectItem>
                        <SelectItem value="income">Income</SelectItem>
                        <SelectItem value="transfer">Transfer</SelectItem>
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

            {transactionType === 'transfer' ? (
                <div className="grid grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="fromAccountId"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>From</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                                <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                            </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="toAccountId"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>To</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                                <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                            </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="accountId"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Account</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                                <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
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
                            <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                            <FormControl>
                                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                {filteredCategories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                            </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                </div>
            )}
            
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
