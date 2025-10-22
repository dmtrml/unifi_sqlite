"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { PlusCircle, Palette, Smile } from "lucide-react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { collection, serverTimestamp } from "firebase/firestore"

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
import { addDocumentNonBlocking } from "@/firebase/non-blocking-updates"
import * as Icons from "lucide-react"

const iconNames = [
  "Home", "ShoppingCart", "UtensilsCrossed", "HeartPulse", "Car", 
  "Ticket", "Lightbulb", "ShoppingBag", "Gift", "Book", "Film", 
  "Briefcase", "Plane", "Wrench", "MoreHorizontal"
];

const categoryFormSchema = z.object({
  name: z.string().min(1, "Category name is required."),
  color: z.string().min(1, "Color is required."),
  icon: z.string().min(1, "Icon is required."),
})

type CategoryFormValues = z.infer<typeof categoryFormSchema>

export function AddCategoryDialog() {
  const [open, setOpen] = React.useState(false)
  const { toast } = useToast()
  const firestore = useFirestore()
  const { user } = useUser()

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      name: "",
      color: "hsl(var(--chart-1))",
      icon: "MoreHorizontal",
    },
  })

  async function onSubmit(data: CategoryFormValues) {
    if (!user || !firestore) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "You must be logged in to add a category.",
      })
      return
    }

    const categoryRef = collection(firestore, `users/${user.uid}/categories`);
    addDocumentNonBlocking(categoryRef, {
      ...data,
      userId: user.uid,
      createdAt: serverTimestamp(),
    });

    toast({
      title: "Category Added",
      description: `Successfully added category: ${data.name}.`,
    })

    setOpen(false)
    form.reset()
  }

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
                                <IconComponent className="h-4 w-4" />
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
              <Button type="submit">Add Category</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
