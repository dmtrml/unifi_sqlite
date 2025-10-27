"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { CalendarIcon, Edit } from "lucide-react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { format } from "date-fns"
import { doc, runTransaction, DocumentReference, DocumentData } from "firebase/firestore"

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
import type { Category, Account, Transaction, Currency } from "@/lib/types"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { editTransactionFormSchema, type EditTransactionFormValues } from "@/lib/schemas"


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
  })
  
  const transactionType = form.watch("transactionType");
  const fromAccountId = form.watch("fromAccountId");
  const toAccountId = form.watch("toAccountId");

  const [isMultiCurrency, setIsMultiCurrency] = React.useState(false);
  const [fromCurrency, setFromCurrency] = React.useState<Currency | undefined>();
  const [toCurrency, setToCurrency] = React.useState<Currency | undefined>();

  React.useEffect(() => {
    if (open) {
      const defaultValues: EditTransactionFormValues = {
        ...originalTransaction,
        date: originalTransaction.date.toDate(),
        description: originalTransaction.description || "",
        amount: originalTransaction.amount ?? undefined,
        amountSent: originalTransaction.amountSent ?? undefined,
        amountReceived: originalTransaction.amountReceived ?? undefined,
      } as any; 

      if (defaultValues.transactionType === 'expense') {
        defaultValues.expenseType = originalTransaction.expenseType || "optional";
      } else if (defaultValues.transactionType === 'income') {
        defaultValues.incomeType = originalTransaction.incomeType || "active";
      }
      form.reset(defaultValues);
    }
  }, [open, originalTransaction, form]);

   React.useEffect(() => {
    if (transactionType === 'transfer' && fromAccountId && toAccountId) {
      const fromAccount = accounts.find(a => a.id === fromAccountId);
      const toAccount = accounts.find(a => a.id === toAccountId);
      if (fromAccount && toAccount) {
        const isMulti = fromAccount.currency !== toAccount.currency;
        setIsMultiCurrency(isMulti);
        setFromCurrency(fromAccount.currency);
        setToCurrency(toAccount.currency);

        if (isMulti && form.getValues('amount')) {
          form.setValue('amountSent', form.getValues('amount'));
          form.setValue('amountReceived', form.getValues('amount'));
          form.setValue('amount', undefined);
        } else if (!isMulti && (form.getValues('amountSent') || form.getValues('amountReceived'))) {
           form.setValue('amount', form.getValues('amountSent') || form.getValues('amountReceived'));
           form.setValue('amountSent', undefined);
           form.setValue('amountReceived', undefined);
        }

      }
    } else {
      setIsMultiCurrency(false);
    }
  }, [fromAccountId, toAccountId, transactionType, accounts, form]);


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

            const balanceChanges: { [accountId: string]: number } = {};

            // Revert original transaction
            const originalAmount = originalData.amount || 0;
            const originalAmountSent = originalData.amountSent || originalAmount;
            const originalAmountReceived = originalData.amountReceived || originalAmount;

            if (originalData.transactionType === 'transfer') {
              if (originalData.fromAccountId) balanceChanges[originalData.fromAccountId] = (balanceChanges[originalData.fromAccountId] || 0) + originalAmountSent;
              if (originalData.toAccountId) balanceChanges[originalData.toAccountId] = (balanceChanges[originalData.toAccountId] || 0) - originalAmountReceived;
            } else { 
              if (originalData.accountId) {
                const change = originalData.transactionType === 'expense' ? originalAmount : -originalAmount;
                balanceChanges[originalData.accountId] = (balanceChanges[originalData.accountId] || 0) + change;
              }
            }

            // Apply new transaction
            const newAmount = newData.amount || 0;
            const newAmountSent = newData.amountSent || newAmount;
            const newAmountReceived = newData.amountReceived || newAmount;

            if (newData.transactionType === 'transfer') {
              if (newData.fromAccountId) balanceChanges[newData.fromAccountId] = (balanceChanges[newData.fromAccountId] || 0) - newAmountSent;
              if (newData.toAccountId) balanceChanges[newData.toAccountId] = (balanceChanges[newData.toAccountId] || 0) + newAmountReceived;
            } else {
              if (newData.accountId) {
                const change = newData.transactionType === 'expense' ? -newAmount : newAmount;
                balanceChanges[newData.accountId] = (balanceChanges[newData.accountId] || 0) + change;
              }
            }
            
            for (const accountId in balanceChanges) {
                if (balanceChanges[accountId] !== 0) {
                    const accountRef = doc(firestore, `users/${user.uid}/accounts`, accountId);
                    const accountDocSnap = await dbTransaction.get(accountRef);
                    if (!accountDocSnap.exists()) throw new Error(`Account ${accountId} not found.`);
                    const currentBalance = accountDocSnap.data().balance;
                    dbTransaction.update(accountRef, { balance: currentBalance + balanceChanges[accountId] });
                }
            }
            
            let finalData: any;
             if (newData.transactionType === 'transfer') {
                const fromAccount = accounts.find(a => a.id === newData.fromAccountId);
                const toAccount = accounts.find(a => a.id === newData.toAccountId);
                const isMulti = fromAccount?.currency !== toAccount?.currency;
                finalData = {
                  userId: user.uid,
                  date: newData.date,
                  amount: !isMulti ? newData.amount : null,
                  amountSent: isMulti ? newData.amountSent : null,
                  amountReceived: isMulti ? newData.amountReceived : null,
                  description: newData.description,
                  transactionType: 'transfer',
                  fromAccountId: newData.fromAccountId,
                  toAccountId: newData.toAccountId,
                  accountId: null, categoryId: null, expenseType: null, incomeType: null,
                };
            } else {
                finalData = {
                  userId: user.uid,
                  date: newData.date,
                  amount: newData.amount,
                  description: newData.description,
                  transactionType: newData.transactionType,
                  accountId: newData.accountId,
                  categoryId: newData.categoryId,
                  ...(newData.transactionType === 'expense' 
                      ? { expenseType: newData.expenseType, incomeType: null } 
                      : { incomeType: newData.incomeType, expenseType: null }),
                  fromAccountId: null, toAccountId: null,
                  amountSent: null, amountReceived: null,
                };
            }
            dbTransaction.update(transactionRef, finalData);
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
                      const currentValues = form.getValues();
                      form.reset({
                        ...currentValues,
                        transactionType: value as 'expense' | 'income' | 'transfer',
                        // Reset dependent fields to avoid validation errors
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
                 <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="fromAccountId"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>From Account</FormLabel>
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
                                <FormLabel>To Account</FormLabel>
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
              <Button type="submit">Save Changes</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
