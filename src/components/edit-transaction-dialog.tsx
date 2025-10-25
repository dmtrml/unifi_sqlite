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
  expenseType: z.enum(["mandatory", "optional"]).optional(),
  incomeType: z.enum(["active", "passive"]).optional(),
}).refine(data => {
    if (data.transactionType === 'transfer') {
        return !!data.fromAccountId && !!data.toAccountId && data.fromAccountId !== data.toAccountId;
    }
    return true;
}, {
    message: "For transfers, 'From' and 'To' accounts must be selected and different.",
    path: ["fromAccountId"],
}).refine(data => {
    if (data.transactionType === 'expense' || data.transactionType === 'income') {
        return !!data.accountId && !!data.categoryId;
    }
    return true;
}, {
    message: "Account and Category are required for expenses and incomes.",
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
      expenseType: originalTransaction.expenseType || "optional",
      incomeType: originalTransaction.incomeType || "active",
    },
  })
  
  const transactionType = form.watch("transactionType");

  React.useEffect(() => {
    form.reset({
      ...originalTransaction,
      date: originalTransaction.date.toDate(),
      description: originalTransaction.description || "",
      expenseType: originalTransaction.expenseType || "optional",
      incomeType: originalTransaction.incomeType || "active",
    });
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

            // Step 1: READ all necessary documents first.
            const accountRefsToRead: { [key: string]: DocumentReference } = {};
            const accountData: { [key: string]: DocumentData } = {};

            // Collect refs for original transaction accounts
            if (originalData.transactionType === 'transfer') {
              if (originalData.fromAccountId) accountRefsToRead.originalFrom = doc(firestore, `users/${user.uid}/accounts/${originalData.fromAccountId}`);
              if (originalData.toAccountId) accountRefsToRead.originalTo = doc(firestore, `users/${user.uid}/accounts/${originalData.toAccountId}`);
            } else {
              if (originalData.accountId) accountRefsToRead.originalAccount = doc(firestore, `users/${user.uid}/accounts/${originalData.accountId}`);
            }

            // Collect refs for new transaction accounts
            if (newData.transactionType === 'transfer') {
              if (newData.fromAccountId) accountRefsToRead.newFrom = doc(firestore, `users/${user.uid}/accounts/${newData.fromAccountId}`);
              if (newData.toAccountId) accountRefsToRead.newTo = doc(firestore, `users/${user.uid}/accounts/${newData.toAccountId}`);
            } else {
              if (newData.accountId) accountRefsToRead.newAccount = doc(firestore, `users/${user.uid}/accounts/${newData.accountId}`);
            }
            
            // Execute all reads
            for (const key in accountRefsToRead) {
                const docSnap = await dbTransaction.get(accountRefsToRead[key]);
                if (!docSnap.exists()) {
                    throw new Error(`Account with ID ${accountRefsToRead[key].id} not found. Transaction cannot be completed.`);
                }
                accountData[key] = docSnap.data();
            }

            // Step 2: WRITE all changes
            const updates: { ref: DocumentReference, newBalance: number }[] = [];
            const balanceChanges: { [accountId: string]: number } = {};

            // Calculate balance changes from reverting the old transaction
            if (originalData.transactionType === 'transfer') {
              if (originalData.fromAccountId) balanceChanges[originalData.fromAccountId] = (balanceChanges[originalData.fromAccountId] || 0) + originalData.amount;
              if (originalData.toAccountId) balanceChanges[originalData.toAccountId] = (balanceChanges[originalData.toAccountId] || 0) - originalData.amount;
            } else {
              if (originalData.accountId) {
                const change = originalData.transactionType === 'expense' ? originalData.amount : -originalData.amount;
                balanceChanges[originalData.accountId] = (balanceChanges[originalData.accountId] || 0) + change;
              }
            }

            // Calculate balance changes from applying the new transaction
            if (newData.transactionType === 'transfer') {
              if (newData.fromAccountId) balanceChanges[newData.fromAccountId] = (balanceChanges[newData.fromAccountId] || 0) - newData.amount;
              if (newData.toAccountId) balanceChanges[newData.toAccountId] = (balanceChanges[newData.toAccountId] || 0) + newData.amount;
            } else {
              if (newData.accountId) {
                const change = newData.transactionType === 'expense' ? -newData.amount : newData.amount;
                balanceChanges[newData.accountId] = (balanceChanges[newData.accountId] || 0) + change;
              }
            }
            
            // Apply all balance updates
            for (const accountId in balanceChanges) {
                const accountRef = doc(firestore, `users/${user.uid}/accounts`, accountId);
                const initialBalance = (Object.values(accountRefsToRead).find(r => r.id === accountId)) 
                    ? (Object.values(accountData).find(d => d.id === accountId)?.balance)
                    : (await dbTransaction.get(accountRef)).data()?.balance;
                
                const accountDocSnap = await dbTransaction.get(accountRef);
                if (!accountDocSnap.exists()) throw new Error(`Account ${accountId} not found during update.`);

                const newBalance = accountDocSnap.data().balance + balanceChanges[accountId];
                dbTransaction.update(accountRef, { balance: newBalance });
            }

            // Finally, update the transaction document itself
            let finalData: any = { ...newData, userId: user.uid };
            if (newData.transactionType === 'transfer') {
                finalData = { ...finalData, accountId: null, categoryId: null, expenseType: null, incomeType: null };
            } else {
                finalData = { ...finalData, fromAccountId: null, toAccountId: null, ...(newData.transactionType === 'expense' ? { incomeType: null } : { expenseType: null }) };
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
                      form.setValue('categoryId', undefined);
                      form.setValue('accountId', undefined);
                      form.setValue('fromAccountId', undefined);
                      form.setValue('toAccountId', undefined);
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
                            <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value || undefined}>
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
