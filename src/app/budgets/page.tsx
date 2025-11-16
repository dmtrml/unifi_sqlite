"use client"

import * as React from "react"
import * as Icons from "lucide-react"
import { useUser } from "@/lib/auth-context"
import { useBudgets } from "@/hooks/use-budgets"
import { useCategories } from "@/hooks/use-categories"
import { useUserProfile } from "@/hooks/use-user-profile"
import AppLayout from "@/components/layout"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import type { Currency } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"

function BudgetsPageContent() {
  const { user } = useUser()
  const { toast } = useToast()
  const { budgets, saveBudget, isLoading: budgetsLoading } = useBudgets()
  const { categories, isLoading: categoriesLoading } = useCategories()
  const { profile, isLoading: profileLoading } = useUserProfile()
  const [inputValues, setInputValues] = React.useState<Record<string, string>>({})
  const [savingCategoryId, setSavingCategoryId] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!budgets.length) {
      setInputValues({})
      return
    }

    const nextValues = budgets.reduce((acc, budget) => {
      acc[budget.categoryId] = String(budget.amount)
      return acc
    }, {} as Record<string, string>)
    setInputValues(nextValues)
  }, [budgets])

  const expenseCategories = React.useMemo(
    () => (categories || []).filter((category) => category.type === "expense" || !category.type),
    [categories],
  )

  const mainCurrency = (profile?.mainCurrency ?? "USD") as Currency
  const isLoading = budgetsLoading || categoriesLoading || profileLoading

  const handleInputChange = (categoryId: string, value: string) => {
    setInputValues((prev) => ({ ...prev, [categoryId]: value }))
  }

  const handleSaveBudget = async (categoryId: string) => {
    if (!user) {
      toast({ title: "Error", description: "You must be logged in.", variant: "destructive" })
      return
    }

    const rawValue = inputValues[categoryId]
    if (rawValue == null) return

    const amount = parseFloat(rawValue)
    if (Number.isNaN(amount) || amount < 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid positive number.",
        variant: "destructive",
      })
      return
    }

    const existingBudget = budgets.find((budget) => budget.categoryId === categoryId)
    const currency = existingBudget?.currency || mainCurrency

    try {
      setSavingCategoryId(categoryId)
      await saveBudget({ categoryId, amount, currency })
      toast({
        title: existingBudget ? "Budget updated" : "Budget saved",
        description: "Your budget has been saved successfully.",
      })
    } catch (error) {
      console.error("Error saving budget:", error)
      toast({
        title: "Error saving budget",
        description: "Failed to save the budget amount. Please try again.",
        variant: "destructive",
      })
    } finally {
      setSavingCategoryId(null)
    }
  }

  if (!user) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-muted-foreground">
        Please sign in to manage budgets.
      </div>
    )
  }

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
      <Card>
        <CardHeader>
          <CardTitle>Manage Budgets</CardTitle>
          <CardDescription>
            Set and manage your monthly budgets. New budgets are saved in your main currency ({mainCurrency}).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading budgets...</div>
          ) : (
            <div className="space-y-4">
              {expenseCategories.map((category) => {
                const IconComponent = (Icons as any)[category.icon] || Icons.MoreHorizontal
                const existingBudget = budgets.find((budget) => budget.categoryId === category.id)
                const currencySymbol = existingBudget?.currency || mainCurrency
                const inputValue = inputValues[category.id] ?? ""

                return (
                  <div
                    key={category.id}
                    className="flex items-center justify-between gap-4 rounded-lg border p-3 md:p-4"
                  >
                    <div className="flex items-center gap-3">
                      <IconComponent className="h-5 w-5" style={{ color: category.color }} />
                      <span className="font-medium">{category.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                          {currencySymbol}
                        </span>
                        <Input
                          type="number"
                          value={inputValue}
                          onChange={(event) => handleInputChange(category.id, event.target.value)}
                          placeholder="0.00"
                          className="w-32 pl-10"
                          aria-label={`${category.name} budget amount`}
                          disabled={savingCategoryId === category.id}
                        />
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSaveBudget(category.id)}
                        disabled={savingCategoryId === category.id}
                      >
                        {savingCategoryId === category.id ? "Saving..." : "Save"}
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  )
}

export default function BudgetsPage() {
  return (
    <AppLayout>
      <BudgetsPageContent />
    </AppLayout>
  )
}
