"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { CalendarIcon, Copy } from "lucide-react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { format } from "date-fns"
import { doc, runTransaction, collection, serverTimestamp } from "firebase/firestore"

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
import { transactionFormSchema, type TransactionFormValues } from "@/lib/schemas"

interface DuplicateTransactionDialogProps {
  transaction: Transaction;
  categories: Category[];
  accounts: Account[];
}

export function DuplicateTransactionDialog({ transaction: originalTransaction, categories, accounts }: DuplicateTransactionDialogProps) {
  const [open, setOpen] = React.useState(false)
  const { toast } = useToast()
  const firestore = useFirestore()
  const { user } = useUser()

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
  })
  
  const transactionType = form.watch("transactionType");

  React.useEffect(() => {
    if (open) {
      const defaultValues: Partial<TransactionFormValues> = {
        ...originalTransaction,
        date: new Date(), // Set to today's date
        description: originalTransaction.description || "",
      };
      
      if (defaultValues.transactionType === 'expense') {
        defaultValues.expenseType = originalTransaction.expenseType || "optional";
      } else if (defaultValues.transactionType === 'income') {
        defaultValues.incomeType = originalTransaction.incomeType || "active";
      }
      
      form.reset(defaultValues as TransactionFormValues);
    }
  }, [open, originalTransaction, form]);


  const filteredCategories = React.useMemo(() => {
    if (transactionType === 'expense') {
      return categories.filter(c => c.type === 'expense' || !c.type);
    }
     if (transactionType === 'income') {
      return categories.filter(c => c.type === 'income');
    }
    return [];
  }, [categories, transactionType]);


  async function onSubmit(data: TransactionFormValues) {
    if (!user || !firestore) {
        toast({
            variant: "destructive",
            title: "Error",
            description: "You must be logged in to add a transaction.",
        })
        return;
    }
    
    const transactionsRef = collection(firestore, `users/${user.uid}/transactions`);

    try {
        await runTransaction(firestore, async (transaction) => {
             const { isRecurring, ...transactionData } = data;
             
             const finalTransactionData = {
                ...transactionData,
                description: transactionData.description || ""
             };

            if (finalTransactionData.transactionType === 'transfer') {
                 const fromAccountRef = doc(firestore, `users/${user.uid}/accounts`, finalTransactionData.fromAccountId);
                 const toAccountRef = doc(firestore, `users/${user.uid}/accounts`, finalTransactionData.toAccountId);
                 const fromAccountDoc = await transaction.get(fromAccountRef);
                 const toAccountDoc = await transaction.get(toAccountRef);
                 if (!fromAccountDoc.exists() || !toAccountDoc.exists()) throw new Error("Account not found for transfer.");
                 
                 transaction.update(fromAccountRef, { balance: fromAccountDoc.data().balance - finalTransactionData.amount });
                 transaction.update(toAccountRef, { balance: toAccountDoc.data().balance + finalTransactionData.amount });

                 transaction.set(doc(transactionsRef), {
                    userId: user.uid,
                    createdAt: serverTimestamp(),
                    date: finalTransactionData.date,
                    amount: finalTransactionData.amount,
                    description: finalTransactionData.description,
                    transactionType: 'transfer',
                    fromAccountId: finalTransactionData.fromAccountId,
                    toAccountId: finalTransactionData.toAccountId,
                    accountId: null, categoryId: null, incomeType: null, expenseType: null,
                });

            } else { // Expense or Income
                const accountRef = doc(firestore, `users/${user.uid}/accounts`, finalTransactionData.accountId);
                const accountDoc = await transaction.get(accountRef);
                if (!accountDoc.exists()) {
                    throw "Account not found!";
                }

                const currentBalance = accountDoc.data().balance;
                const newBalance = finalTransactionData.transactionType === 'expense'
                    ? currentBalance - finalTransactionData.amount
                    : currentBalance + finalTransactionData.amount;

                transaction.update(accountRef, { balance: newBalance });

                transaction.set(doc(transactionsRef), {
                    userId: user.uid,
                    createdAt: serverTimestamp(),
                    date: finalTransactionData.date,
                    amount: finalTransactionData.amount,
                    description: finalTransactionData.description,
                    transactionType: finalTransactionData.transactionType,
                    accountId: finalTransactionData.accountId,
                    categoryId: finalTransactionData.categoryId,
                    ...(finalTransactionData.transactionType === 'expense' 
                        ? { expenseType: finalTransactionData.expenseType, incomeType: null } 
                        : { incomeType: finalTransactionData.incomeType, expenseType: null }),
                    fromAccountId: null, toAccountId: null,
                });
            }
        });
        
         toast({
            title: "Transaction Duplicated",
            description: `Successfully created a new transaction.`,
        });
        setOpen(false);

    } catch (error) {
        console.error("Transaction failed: ", error);
        toast({
            variant: "destructive",
            title: "Error",
            description: "Failed to duplicate transaction.",
        });
    }

  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
          <Copy className="mr-2 h-4 w-4" />
          Duplicate
        </DropdownMenuItem>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Duplicate Transaction</DialogTitle>
          <DialogDescription>
            Create a new transaction based on this one.
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
                      const currentValues = form.getValues();
                      form.reset({
                        ...currentValues,
                        transactionType: value as 'expense' | 'income' | 'transfer',
                        accountId: undefined,
                        categoryId: undefined,
                        fromAccountId: undefined,
                        toAccountId: undefined,
                        incomeType: currentValues.transactionType === 'income' ? currentValues.incomeType : undefined,
                        expenseType: currentValues.transactionType === 'expense' ? currentValues.expenseType : 'optional',
                      });
                    }} value={field.value}>
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

            {transactionType === 'expense' && (
              <FormField
                control={form.control}
                name="expenseType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expense Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select expense type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="optional">Optional</SelectItem>
                        <SelectItem value="mandatory">Mandatory</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {transactionType === 'income' && (
              <FormField
                control={form.control}
                name="incomeType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Income Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select income type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="passive">Passive</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
              
            {transactionType === 'transfer' ? (
                <div className="grid grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="fromAccountId"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>From</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
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
                            <Select onValueChange={field.onChange} value={field.value}>
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
                            <Select onValueChange={field.onChange} value={field.value}>
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
                            <Select onValueChange={field.onChange} value={field.value || undefined}>
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
              <Button type="submit">Create Transaction</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
