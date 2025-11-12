"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { PlusCircle } from "lucide-react"
import { useForm } from "react-hook-form"
import { z } from "zod"

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
import { useToast } from "@/hooks/use-toast"
import { useUser } from "@/firebase"
import { useCategories } from "@/hooks/use-categories"
import * as Icons from "lucide-react"
import { colorOptions } from "@/lib/colors"
import { ScrollArea } from "./ui/scroll-area"

const expenseIconNames = [
  "Home", "ShoppingCart", "UtensilsCrossed", "HeartPulse", "Car", 
  "Ticket", "Lightbulb", "ShoppingBag", "Gift", "Book", "Film", 
  "Briefcase", "Plane", "Wrench", "MoreHorizontal"
];

const incomeIconNames = [
    "TrendingUp", "CircleDollarSign", "Award", "Briefcase", "Gift", "MoreHorizontal"
]

const categoryFormSchema = z.object({
  name: z.string().min(1, "Category name is required."),
  color: z.string().min(1, "Color is required."),
  icon: z.string().min(1, "Icon is required."),
  type: z.enum(["expense", "income"]).default("expense"),
})

type CategoryFormValues = z.infer<typeof categoryFormSchema>

export function AddCategoryDialog() {
  const [open, setOpen] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const { toast } = useToast()
  const { user } = useUser()
  const { refresh } = useCategories()

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      name: "",
      color: "hsl(var(--custom-color-1))",
      icon: "MoreHorizontal",
      type: "expense"
    },
  })
  
  const categoryType = form.watch("type");

  async function onSubmit(data: CategoryFormValues) {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "You must be logged in to add a category.",
      })
      return
    }

    try {
      setIsSubmitting(true)
      const response = await fetch("/api/categories", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-uid": user.uid,
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload?.message || "Failed to add category.")
      }

      refresh()

      toast({
        title: "Category Added",
        description: `Successfully added category: ${data.name}.`,
      })

      setOpen(false)
      form.reset()
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error?.message || "Failed to add category.",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const iconNames = categoryType === 'expense' ? expenseIconNames : incomeIconNames;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="relative ml-auto">
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Category
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Add Category</DialogTitle>
          <DialogDescription>
            Create a new category for your transactions.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
             <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category Type</FormLabel>
                     <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
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
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Groceries" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Color</FormLabel>
                     <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a color" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <ScrollArea className="h-60">
                          {colorOptions.map(opt => (
                              <SelectItem key={opt.value} value={opt.value}>
                                <div className="flex items-center gap-2">
                                  <div className="h-4 w-4 rounded-full" style={{ backgroundColor: opt.value }} />
                                  {opt.label}
                                </div>
                              </SelectItem>
                          ))}
                        </ScrollArea>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="icon"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Icon</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                       <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select an icon" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="max-h-60">
                        {iconNames.map(iconName => {
                          const IconComponent = (Icons as any)[iconName];
                          return (
                            <SelectItem key={iconName} value={iconName}>
                               <div className="flex items-center gap-2">
                                {IconComponent && <IconComponent className="h-4 w-4" />}
                                <span>{iconName}</span>
                               </div>
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Adding..." : "Add Category"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
