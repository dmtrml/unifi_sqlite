"use client"

import * as React from "react"
import { useUser } from "@/firebase"
import AppLayout from "@/components/layout"
import { useCategories } from "@/hooks/use-categories"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Category } from "@/lib/types"
import * as Icons from "lucide-react"
import { MoreHorizontal } from "lucide-react"
import { EditCategoryDialog } from "@/components/edit-category-dialog"
import { DeleteCategoryDialog } from "@/components/delete-category-dialog"
import { UnstyledCategoriesManager } from "@/components/unstyled-categories-manager"

function CategoryTable({ title, categories }: { title: string, categories: Category[] }) {
  if (categories.length === 0) {
    return null;
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map((category) => {
              const IconComponent = (Icons as any)[category.icon] || Icons.MoreHorizontal;
              return (
                <TableRow key={category.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                      <IconComponent className="h-5 w-5" style={{ color: category.color }} />
                      {category.name}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <EditCategoryDialog category={category} />
                        <DeleteCategoryDialog categoryId={category.id} />
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function CategoriesPageContent() {
  const { user } = useUser()
  const { categories } = useCategories()
  
  const [styledCategories, unstyledCategories] = React.useMemo(() => {
    const allCategories = categories || [];
    const unstyled = allCategories.filter(c => c.icon === "MoreHorizontal" && c.color === "hsl(var(--muted-foreground))");
    const styled = allCategories.filter(c => !unstyled.some(uc => uc.id === c.id));
    return [styled, unstyled];
  }, [categories]);

  const expenseCategories = React.useMemo(() => styledCategories.filter(c => !c.type || c.type === 'expense'), [styledCategories]);
  const incomeCategories = React.useMemo(() => styledCategories.filter(c => c.type === 'income'), [styledCategories]);

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
      <div className="flex items-center">
        <h1 className="text-lg font-semibold md:text-2xl">Categories</h1>
        <div className="ml-auto">
        </div>
      </div>
      <div className="flex flex-col gap-6">
        {unstyledCategories.length > 0 && <UnstyledCategoriesManager categories={unstyledCategories} />}
        <CategoryTable title="Expense Categories" categories={expenseCategories} />
        <CategoryTable title="Income Categories" categories={incomeCategories} />
      </div>
    </main>
  );
}

export default function CategoriesPage() {
  return (
    <AppLayout>
      <CategoriesPageContent />
    </AppLayout>
  )
}
