"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Edit } from "lucide-react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { doc } from "firebase/firestore"
import * as Icons from "lucide-react"

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
import { useFirestore, useUser } from "@/firebase"
import { updateDocumentNonBlocking } from "@/firebase/non-blocking-updates"
import type { Category } from "@/lib/types"
import { DropdownMenuItem } from "./ui/dropdown-menu"

const expenseIconNames = [
  "Home", "ShoppingCart", "UtensilsCrossed", "HeartPulse", "Car", 
  "Ticket", "Lightbulb", "ShoppingBag", "Gift", "Book", "Film", 
  "Briefcase", "Plane", "Wrench", "MoreHorizontal"
];

const incomeIconNames = [
    "TrendingUp", "CircleDollarSign", "Award", "Briefcase", "Gift", "MoreHorizontal"
]

const editCategoryFormSchema = z.object({
  name: z.string().min(1, "Category name is required."),
  color: z.string().min(1, "Color is required."),
  icon: z.string().min(1, "Icon is required."),
  type: z.enum(["expense", "income"]),
})

type EditCategoryFormValues = z.infer<typeof editCategoryFormSchema>

interface EditCategoryDialogProps {
  category: Category;
}

export function EditCategoryDialog({ category }: EditCategoryDialogProps) {
  const [open, setOpen] = React.useState(false)
  const { toast } = useToast()
  const firestore = useFirestore()
  const { user } = useUser()

  const form = useForm<EditCategoryFormValues>({
    resolver: zodResolver(editCategoryFormSchema),
    defaultValues: category,
  })
  
  const categoryType = form.watch("type");

  async function onSubmit(data: EditCategoryFormValues) {
    if (!user || !firestore) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "You must be logged in to edit a category.",
      })
      return
    }

    const categoryRef = doc(firestore, `users/${user.uid}/categories/${category.id}`);
    updateDocumentNonBlocking(categoryRef, data);

    toast({
      title: "Category Updated",
      description: "Your category has been successfully updated.",
    })

    setOpen(false)
  }

  const iconNames = categoryType === 'expense' ? expenseIconNames : incomeIconNames;

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
          <DialogTitle>Edit Category</DialogTitle>
          <DialogDescription>
            Update the details of your category.
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
                        <SelectItem value="hsl(var(--chart-1))">Teal</SelectItem>
                        <SelectItem value="hsl(var(--chart-2))">Blue</SelectItem>
                        <SelectItem value="hsl(var(--chart-3))">Green</SelectItem>
                        <SelectItem value="hsl(var(--chart-4))">Purple</SelectItem>
                        <SelectItem value="hsl(var(--chart-5))">Indigo</SelectItem>
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
              <Button type="submit">Save Changes</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
