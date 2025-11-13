"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { CalendarIcon, PlusCircle } from "lucide-react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { useUser } from "@/lib/auth-context"
import { mutate } from "swr"
import { recurringApi, recurringKey } from "@/hooks/use-recurring-transactions"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { Category, Account } from "@/lib/types"
import { recurringTransactionFormSchema } from "@/lib/schemas"

type RecurringTransactionFormValues = z.infer<typeof recurringTransactionFormSchema>;

interface AddRecurringTransactionDialogProps {
    categories: Category[];
    accounts: Account[];
}

export function AddRecurringTransactionDialog({ categories, accounts }: AddRecurringTransactionDialogProps) {
  const [open, setOpen] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const { toast } = useToast()
  const { user } = useUser()

  const form = useForm<RecurringTransactionFormValues>({
    resolver: zodResolver(recurringTransactionFormSchema),
    defaultValues: {
      description: "",
      amount: 0,
      frequency: "monthly",
      startDate: new Date(),
    },
  })
  
  async function onSubmit(data: RecurringTransactionFormValues) {
     if (!user) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "You must be logged in to add a transaction.",
      })
      return
    }

    try {
      setIsSubmitting(true)
      await recurringApi.create(user.uid, {
        accountId: data.accountId,
        categoryId: data.categoryId,
        description: data.description,
        frequency: data.frequency,
        amount: data.amount,
        startDate: data.startDate?.getTime() ?? Date.now(),
      })
      mutate(recurringKey(user.uid))
      toast({
        title: "Recurring Transaction Added",
        description: `Successfully added: ${data.description}.`,
      })
      setOpen(false)
      form.reset()
    } catch (error) {
      console.error("Error creating recurring transaction", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create recurring transaction.",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

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
            Create a new template for recurring transactions.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea placeholder="e.g., Monthly Rent" {...field} />
                  </FormControl>
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
            
            <div className="grid grid-cols-2 gap-4">
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

                <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                        <FormItem className="flex flex-col">
                        <FormLabel>Start Date</FormLabel>
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
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Add Template"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
