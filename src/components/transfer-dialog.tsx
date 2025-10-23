"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { CalendarIcon, ArrowRightLeft } from "lucide-react"
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
import type { Account } from "@/lib/types"

const transferFormSchema = z.object({
  fromAccountId: z.string().min(1, "Source account is required."),
  toAccountId: z.string().min(1, "Destination account is required."),
  amount: z.coerce.number().positive("Amount must be positive."),
  description: z.string().optional(),
  date: z.date(),
}).refine(data => data.fromAccountId !== data.toAccountId, {
  message: "Source and destination accounts cannot be the same.",
  path: ["toAccountId"],
});

type TransferFormValues = z.infer<typeof transferFormSchema>

interface TransferDialogProps {
  accounts: Account[];
}

export function TransferDialog({ accounts }: TransferDialogProps) {
  const [open, setOpen] = React.useState(false)
  const { toast } = useToast()
  const firestore = useFirestore()
  const { user } = useUser()

  const form = useForm<TransferFormValues>({
    resolver: zodResolver(transferFormSchema),
    defaultValues: {
      amount: 0,
      date: new Date(),
    },
  })

  async function onSubmit(data: TransferFormValues) {
    if (!user || !firestore) {
        toast({
            variant: "destructive",
            title: "Error",
            description: "You must be logged in to perform a transfer.",
        })
        return;
    }

    const fromAccountRef = doc(firestore, `users/${user.uid}/accounts`, data.fromAccountId);
    const toAccountRef = doc(firestore, `users/${user.uid}/accounts`, data.toAccountId);
    const transactionRef = collection(firestore, `users/${user.uid}/transactions`);

    try {
        await runTransaction(firestore, async (transaction) => {
            const fromAccountDoc = await transaction.get(fromAccountRef);
            const toAccountDoc = await transaction.get(toAccountRef);

            if (!fromAccountDoc.exists() || !toAccountDoc.exists()) {
                throw new Error("One or both accounts not found.");
            }

            const fromAccountData = fromAccountDoc.data();
            const toAccountData = toAccountDoc.data();

            const newFromBalance = fromAccountData.balance - data.amount;
            const newToBalance = toAccountData.balance + data.amount;

            transaction.update(fromAccountRef, { balance: newFromBalance });
            transaction.update(toAccountRef, { balance: newToBalance });

            transaction.set(doc(transactionRef), {
                ...data,
                userId: user.uid,
                transactionType: 'transfer',
                createdAt: serverTimestamp(),
            });
        });

        toast({
            title: "Transfer Successful",
            description: `Successfully transferred funds.`,
        });
        setOpen(false);
        form.reset();

    } catch (error: any) {
        console.error("Transfer failed: ", error);
        toast({
            variant: "destructive",
            title: "Error",
            description: error.message || "Failed to complete transfer.",
        });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="relative">
          <ArrowRightLeft className="mr-2 h-4 w-4" />
          Transfer
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Transfer Funds</DialogTitle>
          <DialogDescription>
            Move money between your accounts.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="fromAccountId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>From</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select account" />
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
                name="toAccountId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>To</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select account" />
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
            </div>
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
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="e.g., Savings transfer" {...field} />
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
                  <FormLabel>Date of transfer</FormLabel>
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
              <Button type="submit">Confirm Transfer</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
