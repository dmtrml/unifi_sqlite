"use client"

import * as React from "react"
import { useUser } from "@/lib/auth-context"
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

const CategoryActions = ({ category }: { category: Category }) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="icon">
        <MoreHorizontal className="h-4 w-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <EditCategoryDialog category={category} />
      <DeleteCategoryDialog categoryId={category.id} />
    </DropdownMenuContent>
  </DropdownMenu>
);

function CategoryTable({ title, categories }: { title: string; categories: Category[] }) {
  const categoryMap = React.useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const childMap = React.useMemo(() => {
    const map = new Map<string, Category[]>();
    categories.forEach((category) => {
      if (category.parentId && categoryMap.has(category.parentId)) {
        const bucket = map.get(category.parentId) ?? [];
        bucket.push(category);
        map.set(category.parentId, bucket);
      }
    });
    Array.from(map.values()).forEach((items) => items.sort((a, b) => a.name.localeCompare(b.name)));
    return map;
  }, [categories, categoryMap]);

  const topLevel = React.useMemo(() => {
    const roots = categories.filter((category) => !category.parentId || !categoryMap.has(category.parentId));
    return roots.sort((a, b) => a.name.localeCompare(b.name));
  }, [categories, categoryMap]);

  if (categories.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topLevel.map((category) => {
                const IconComponent = (Icons as any)[category.icon] || Icons.MoreHorizontal;
                const children = childMap.get(category.id) ?? [];
                return (
                  <React.Fragment key={category.id}>
                    <TableRow className="bg-muted/50">
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-3">
                          <IconComponent className="h-5 w-5" style={{ color: category.color }} />
                          <div className="flex flex-col">
                            <span>{category.name}</span>
                            {children.length > 0 && (
                              <span className="text-xs text-muted-foreground">
                                {children.length} {children.length === 1 ? "subcategory" : "subcategories"}
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <CategoryActions category={category} />
                      </TableCell>
                    </TableRow>
                    {children.map((child) => {
                      const ChildIcon = (Icons as any)[child.icon] || Icons.MoreHorizontal;
                      return (
                        <TableRow key={child.id} className="border-0">
                          <TableCell>
                            <div className="flex items-center gap-3 pl-10">
                              <ChildIcon className="h-4 w-4" style={{ color: child.color }} />
                              <span className="text-sm">{child.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <CategoryActions category={child} />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <div className="space-y-3 md:hidden">
          {topLevel.map((category) => {
            const IconComponent = (Icons as any)[category.icon] || Icons.MoreHorizontal;
            const children = childMap.get(category.id) ?? [];
            return (
              <div key={category.id} className="rounded-lg border border-border/70 bg-card/70 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <IconComponent className="h-5 w-5" style={{ color: category.color }} />
                    <div className="flex flex-col">
                      <span className="font-semibold">{category.name}</span>
                      {children.length > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {children.length} {children.length === 1 ? "subcategory" : "subcategories"}
                        </span>
                      )}
                    </div>
                  </div>
                  <CategoryActions category={category} />
                </div>
                {children.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {children.map((child) => {
                      const ChildIcon = (Icons as any)[child.icon] || Icons.MoreHorizontal;
                      return (
                        <div
                          key={child.id}
                          className="flex items-center justify-between rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-sm"
                        >
                          <div className="flex items-center gap-2">
                            <ChildIcon className="h-4 w-4" style={{ color: child.color }} />
                            <span>{child.name}</span>
                          </div>
                          <CategoryActions category={child} />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
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
