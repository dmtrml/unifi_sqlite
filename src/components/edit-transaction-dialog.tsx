"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { CalendarIcon, Edit } from "lucide-react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { format } from "date-fns"
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
import { useUser } from "@/firebase"
import { useAccounts } from "@/hooks/use-accounts"
import { notifyTransactionsChanged } from "@/lib/transactions-events"
import type { Category, Account, Transaction, Currency } from "@/lib/types"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { editTransactionFormSchema, type EditTransactionFormInput } from "@/lib/schemas"
import { convertAmount } from "@/lib/currency"
import { buildEditTransactionPayload } from "@/lib/transaction-payload"


interface EditTransactionDialogProps {
  transaction: Transaction;
  categories: Category[];
  accounts: Account[];
}

export function EditTransactionDialog({ transaction: originalTransaction, categories, accounts }: EditTransactionDialogProps) {
  const [open, setOpen] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const { toast } = useToast()
  const { user } = useUser()
  const { refresh: refreshAccounts } = useAccounts()

  const form = useForm<EditTransactionFormInput>({
    resolver: zodResolver(editTransactionFormSchema),
  })
  
  const transactionType = form.watch("transactionType");
  const fromAccountId = form.watch("fromAccountId");
  const toAccountId = form.watch("toAccountId");
  const amountSent = form.watch("amountSent");

  const [isMultiCurrency, setIsMultiCurrency] = React.useState(false);
  const [fromCurrency, setFromCurrency] = React.useState<Currency | undefined>();
  const [toCurrency, setToCurrency] = React.useState<Currency | undefined>();

  React.useEffect(() => {
    if (open) {
      const defaultValues: EditTransactionFormInput = {
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

  React.useEffect(() => {
    if (isMultiCurrency && amountSent && amountSent > 0 && fromCurrency && toCurrency) {
      const converted = convertAmount(amountSent, fromCurrency, toCurrency);
      form.setValue("amountReceived", parseFloat(converted.toFixed(2)));
    }
  }, [amountSent, isMultiCurrency, fromCurrency, toCurrency, form]);


  const filteredCategories = React.useMemo(() => {
    if (transactionType === 'expense') {
      return categories.filter(c => c.type === 'expense' || !c.type);
    }
     if (transactionType === 'income') {
      return categories.filter(c => c.type === 'income');
    }
    return [];
  }, [categories, transactionType]);


  async function onSubmit(data: EditTransactionFormInput) {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "You must be logged in to edit a transaction.",
      })
      return
    }

    const payload = buildEditTransactionPayload(data);

    try {
      setIsSubmitting(true)
      const response = await fetch(`/api/transactions/${originalTransaction.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-uid": user.uid,
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const result = await response.json().catch(() => ({}))
        throw new Error(result?.message || "Failed to update transaction.")
      }

      refreshAccounts()
      notifyTransactionsChanged()

      toast({
        title: "Transaction Updated",
        description: "Your transaction has been successfully updated.",
      })
      setOpen(false)
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update transaction.",
      })
    } finally {
      setIsSubmitting(false)
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
                        transactionType: value as EditTransactionFormInput['transactionType'],
                        // Reset dependent fields to avoid validation errors
                        accountId: undefined,
                        categoryId: undefined,
                        fromAccountId: undefined,
                        toAccountId: undefined,
                        incomeType: currentValues.transactionType === 'income' ? currentValues.incomeType : undefined,
                        expenseType: currentValues.transactionType === 'expense' ? currentValues.expenseType : 'optional',
                      } as Partial<EditTransactionFormInput>);
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
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

