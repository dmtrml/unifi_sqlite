

"use client"

import * as React from "react"
import { doc } from "firebase/firestore"
import * as Icons from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
import { colorOptions } from "@/lib/colors"
import { ScrollArea } from "./ui/scroll-area"

const iconNames = [
  "Home", "ShoppingCart", "UtensilsCrossed", "HeartPulse", "Car", 
  "Ticket", "Lightbulb", "ShoppingBag", "Gift", "Book", "Film", 
  "Briefcase", "Plane", "Wrench", "TrendingUp", "CircleDollarSign", 
  "Award", "MoreHorizontal"
];

interface UnstyledCategoriesManagerProps {
  categories: Category[];
}

export function UnstyledCategoriesManager({ categories }: UnstyledCategoriesManagerProps) {
  const { toast } = useToast()
  const firestore = useFirestore()
  const { user } = useUser()

  const [categoryStyles, setCategoryStyles] = React.useState<Record<string, { icon: string }>>({})

  React.useEffect(() => {
    const initialStyles = categories.reduce((acc, category) => {
      acc[category.id] = { icon: category.icon }
      return acc
    }, {} as Record<string, { icon: string }>)
    setCategoryStyles(initialStyles)
  }, [categories])

  const handleStyleChange = (categoryId: string, field: 'icon', value: string) => {
    setCategoryStyles(prev => ({
      ...prev,
      [categoryId]: { ...prev[categoryId], [field]: value }
    }))
  }

  const handleSave = (categoryId: string) => {
    if (!user || !firestore) {
      toast({ title: "Error", description: "You must be logged in.", variant: "destructive" })
      return
    }

    const styles = categoryStyles[categoryId]
    if (!styles) return

    const categoryRef = doc(firestore, `users/${user.uid}/categories/${categoryId}`)
    updateDocumentNonBlocking(categoryRef, {
      icon: styles.icon,
    })

    toast({
      title: "Category Styled",
      description: "The category has been successfully updated.",
    })
  }
  
  if (categories.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Style New Categories</CardTitle>
        <CardDescription>
          New categories were created during your last import. Customize their appearance below.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {categories.map((category) => (
          <div key={category.id} className="flex items-center justify-between gap-2 md:gap-4 p-3 border rounded-lg">
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 rounded-full" style={{ backgroundColor: category.color }} />
              <span className="font-medium">{category.name}</span>
            </div>

            <div className="flex items-center gap-2">
              <Select
                value={categoryStyles[category.id]?.icon || category.icon}
                onValueChange={(value) => handleStyleChange(category.id, 'icon', value)}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Select icon" />
                </SelectTrigger>
                <SelectContent>
                  <ScrollArea className="h-60">
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
                  </ScrollArea>
                </SelectContent>
              </Select>
              <Button size="sm" onClick={() => handleSave(category.id)}>Save</Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
