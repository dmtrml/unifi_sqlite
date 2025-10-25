"use client"

import * as React from "react"
import { collection, query } from "firebase/firestore"
import { useCollection, useFirestore, useUser, useMemoFirebase } from "@/firebase"
import AppLayout from "@/components/layout"

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
import { AddCategoryDialog } from "@/components/add-category-dialog"
import { EditCategoryDialog } from "@/components/edit-category-dialog"
import { DeleteCategoryDialog } from "@/components/delete-category-dialog"

function CategoryTable({ title, categories }: { title: string, categories: Category[] }) {
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
  const firestore = useFirestore()

  const categoriesQuery = useMemoFirebase(() =>
    user ? query(collection(firestore, "users", user.uid, "categories")) : null,
    [user, firestore]
  );
  const { data: categories } = useCollection<Category>(categoriesQuery);
  
  const expenseCategories = React.useMemo(() => (categories || []).filter(c => !c.type || c.type === 'expense'), [categories]);
  const incomeCategories = React.useMemo(() => (categories || []).filter(c => c.type === 'income'), [categories]);

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
      <div className="flex items-center">
        <h1 className="text-lg font-semibold md:text-2xl">Categories</h1>
        <div className="ml-auto">
          <AddCategoryDialog />
        </div>
      </div>
      <div className="flex flex-col gap-6">
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
