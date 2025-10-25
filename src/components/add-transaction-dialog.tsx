"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { CalendarIcon, PlusCircle } from "lucide-react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { format } from "date-fns"
import { collection, serverTimestamp, doc, runTransaction } from "firebase/firestore"

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
  FormDescription,
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
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { Calendar } from "@/components/ui/calendar"
import { useToast } from "@/hooks/use-toast"
import { useFirestore, useUser } from "@/firebase"
import type { Category, Account } from "@/lib/types"
import { transactionFormSchema, type TransactionFormValues } from "@/lib/schemas"

interface AddTransactionDialogProps {
  categories: Category[];
  accounts: Account[];
}

export function AddTransactionDialog({ categories, accounts }: AddTransactionDialogProps) {
  const [open, setOpen] = React.useState(false)
  const { toast } = useToast()
  const firestore = useFirestore()
  const { user } = useUser()

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: {
      description: "",
      amount: 0,
      date: new Date(),
      isRecurring: false,
      transactionType: "expense",
      expenseType: "optional",
    },
  })

  const isRecurring = form.watch("isRecurring")
  const transactionType = form.watch("transactionType")

  React.useEffect(() => {
    // Reset form when dialog opens/closes or type changes
    form.reset({
      description: "",
      amount: 0,
      date: new Date(),
      isRecurring: false,
      transactionType: "expense",
      expenseType: "optional",
    });
  }, [open, form]);

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
             const { isRecurring, frequency, ...transactionData } = data;
             
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

                 // Create a new document in the transactions collection
                transaction.set(doc(transactionsRef), {
                    // Fields common to all types
                    userId: user.uid,
                    createdAt: serverTimestamp(),
                    date: finalTransactionData.date,
                    amount: finalTransactionData.amount,
                    description: finalTransactionData.description,
                    transactionType: 'transfer',
                    // Transfer-specific fields
                    fromAccountId: finalTransactionData.fromAccountId,
                    toAccountId: finalTransactionData.toAccountId,
                    // Nullify fields not applicable to transfers
                    accountId: null,
                    categoryId: null,
                    incomeType: null,
                    expenseType: null,
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

                // Create a new document in the transactions collection
                transaction.set(doc(transactionsRef), {
                    // Fields common to all types
                    userId: user.uid,
                    createdAt: serverTimestamp(),
                    date: finalTransactionData.date,
                    amount: finalTransactionData.amount,
                    description: finalTransactionData.description,
                    transactionType: finalTransactionData.transactionType,
                    // Expense/Income-specific fields
                    accountId: finalTransactionData.accountId,
                    categoryId: finalTransactionData.categoryId,
                    ...(finalTransactionData.transactionType === 'expense' 
                        ? { expenseType: finalTransactionData.expenseType, incomeType: null } 
                        : { incomeType: finalTransactionData.incomeType, expenseType: null }),
                    // Nullify fields not applicable to expense/income
                    fromAccountId: null,
                    toAccountId: null,
                });
            }
        });
        
         toast({
            title: "Transaction Added",
            description: `Successfully added transaction.`,
        });

    } catch (error) {
        console.error("Transaction failed: ", error);
        toast({
            variant: "destructive",
            title: "Error",
            description: "Failed to add transaction.",
        });
    }

    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="relative">
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Transaction
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Add Transaction</DialogTitle>
          <DialogDescription>
            Record a new transaction. Fill in the details below.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="transactionType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Transaction Type</FormLabel>
                     <Select onValueChange={(value) => {
                        field.onChange(value)
                        // Reset dependent fields
                        form.setValue('accountId', undefined);
                        form.setValue('categoryId', undefined);
                        form.setValue('fromAccountId', undefined);
                        form.setValue('toAccountId', undefined);
                        form.setValue('incomeType', undefined);
                        form.setValue('expenseType', 'optional');
                     }} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
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
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                            <FormLabel>From Account</FormLabel>
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
                            <FormLabel>To Account</FormLabel>
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
                <>
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
                                <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                                <FormControl>
                                    <SelectTrigger>
                                    <SelectValue placeholder="Select a category" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {filteredCategories.map((category) => (
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
                </>
            )}
             
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea placeholder={transactionType === 'transfer' ? "e.g., Savings transfer" : "e.g., Groceries from Walmart"} {...field} />
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
             {/* Not available for transfers */}
             {transactionType !== 'transfer' && 
                <FormField
                    control={form.control}
                    name="isRecurring"
                    render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                        <div className="space-y-0.5">
                        <FormLabel>Recurring Transaction</FormLabel>
                        <FormDescription>
                            Is this a recurring transaction?
                        </FormDescription>
                        </div>
                        <FormControl>
                        <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                        />
                        </FormControl>
                    </FormItem>
                    )}
                />
             }
              {isRecurring && transactionType !== 'transfer' && (
                <FormField
                  control={form.control}
                  name="frequency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Frequency</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select frequency" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="bi-weekly">Bi-weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            <DialogFooter>
              <Button type="submit">Add Transaction</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
