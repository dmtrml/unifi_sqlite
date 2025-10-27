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
import { Textarea } from "@/components/ui/textarea"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { Calendar } from "@/components/ui/calendar"
import { useToast } from "@/hooks/use-toast"
import { useFirestore, useUser } from "@/firebase"
import type { Category, Account, Currency } from "@/lib/types"
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
      date: new Date(),
      transactionType: "expense",
      expenseType: "optional",
      amount: undefined,
      amountSent: undefined,
      amountReceived: undefined,
    },
  })

  const transactionType = form.watch("transactionType")
  const fromAccountId = form.watch("fromAccountId");
  const toAccountId = form.watch("toAccountId");

  const [isMultiCurrency, setIsMultiCurrency] = React.useState(false);
  const [fromCurrency, setFromCurrency] = React.useState<Currency | undefined>();
  const [toCurrency, setToCurrency] = React.useState<Currency | undefined>();

  React.useEffect(() => {
    // Reset form when dialog opens/closes or type changes
    form.reset({
      description: "",
      date: new Date(),
      transactionType: "expense",
      expenseType: "optional",
      amount: undefined,
      amountSent: undefined,
      amountReceived: undefined,
    });
  }, [open, form]);

  React.useEffect(() => {
    if (transactionType === 'transfer' && fromAccountId && toAccountId) {
      const fromAccount = accounts.find(a => a.id === fromAccountId);
      const toAccount = accounts.find(a => a.id === toAccountId);
      if (fromAccount && toAccount) {
        setIsMultiCurrency(fromAccount.currency !== toAccount.currency);
        setFromCurrency(fromAccount.currency);
        setToCurrency(toAccount.currency);
      }
    } else {
      setIsMultiCurrency(false);
    }
  }, [fromAccountId, toAccountId, transactionType, accounts]);

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
             const { ...transactionData } = data;
             
             const finalTransactionData = {
                ...transactionData,
                description: transactionData.description || ""
             };

            if (finalTransactionData.transactionType === 'transfer') {
                 const fromAccountRef = doc(firestore, `users/${user.uid}/accounts`, finalTransactionData.fromAccountId!);
                 const toAccountRef = doc(firestore, `users/${user.uid}/accounts`, finalTransactionData.toAccountId!);
                 const fromAccountDoc = await transaction.get(fromAccountRef);
                 const toAccountDoc = await transaction.get(toAccountRef);
                 if (!fromAccountDoc.exists() || !toAccountDoc.exists()) throw new Error("Account not found for transfer.");

                 const fromAccountData = fromAccountDoc.data() as Account;
                 const toAccountData = toAccountDoc.data() as Account;

                 let amountSent = 0;
                 let amountReceived = 0;

                 if (fromAccountData.currency === toAccountData.currency) {
                    if (!finalTransactionData.amount || finalTransactionData.amount <= 0) throw new Error("A positive amount is required.");
                    amountSent = finalTransactionData.amount;
                    amountReceived = finalTransactionData.amount;
                 } else {
                    if (!finalTransactionData.amountSent || finalTransactionData.amountSent <= 0) throw new Error("A positive sent amount is required.");
                    if (!finalTransactionData.amountReceived || finalTransactionData.amountReceived <= 0) throw new Error("A positive received amount is required.");
                    amountSent = finalTransactionData.amountSent;
                    amountReceived = finalTransactionData.amountReceived;
                 }
                 
                 transaction.update(fromAccountRef, { balance: fromAccountDoc.data().balance - amountSent });
                 transaction.update(toAccountRef, { balance: toAccountDoc.data().balance + amountReceived });

                transaction.set(doc(transactionsRef), {
                    userId: user.uid,
                    createdAt: serverTimestamp(),
                    date: finalTransactionData.date,
                    amount: fromAccountData.currency === toAccountData.currency ? finalTransactionData.amount : null,
                    amountSent: fromAccountData.currency !== toAccountData.currency ? finalTransactionData.amountSent : null,
                    amountReceived: fromAccountData.currency !== toAccountData.currency ? finalTransactionData.amountReceived : null,
                    description: finalTransactionData.description,
                    transactionType: 'transfer',
                    fromAccountId: finalTransactionData.fromAccountId,
                    toAccountId: finalTransactionData.toAccountId,
                    accountId: null, categoryId: null, incomeType: null, expenseType: null,
                });

            } else { // Expense or Income
                if (!finalTransactionData.amount || finalTransactionData.amount <= 0) throw new Error("A positive amount is required.");

                const accountRef = doc(firestore, `users/${user.uid}/accounts`, finalTransactionData.accountId!);
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
                        form.reset({
                          description: "",
                          date: new Date(),
                          transactionType: value as any,
                          amount: undefined,
                          amountSent: undefined,
                          amountReceived: undefined,
                        });
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
            
            {(transactionType === 'expense' || transactionType === 'income') && (
                <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Amount</FormLabel>
                        <FormControl>
                        <Input type="number" placeholder="$0.00" {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
            )}

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

            {transactionType === 'transfer' && (
                <div className="space-y-4">
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
                    {isMultiCurrency ? (
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="amountSent"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Amount Sent ({fromCurrency})</FormLabel>
                                        <FormControl>
                                            <Input type="number" placeholder="0.00" {...field} value={field.value ?? ""} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="amountReceived"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Amount Received ({toCurrency})</FormLabel>
                                        <FormControl>
                                            <Input type="number" placeholder="0.00" {...field} value={field.value ?? ""} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    ) : (
                        <FormField
                            control={form.control}
                            name="amount"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Amount</FormLabel>
                                <FormControl>
                                <Input type="number" placeholder="0.00" {...field} value={field.value ?? ""} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                    )}
                </div>
            )}

            {(transactionType === 'expense' || transactionType === 'income') && (
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
            <DialogFooter>
              <Button type="submit">Add Transaction</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
