"use client"

import {
  File,
  ListFilter,
  MoreHorizontal,
  PlusCircle,
  Search,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"

import { budgets, categories, expenses, recurringExpenses } from "@/lib/data"
import type { Budget, Category, Expense, RecurringExpense } from "@/lib/types"

import { MonthlySpendingChart } from "./dashboard/monthly-spending-chart"
import { CategorySpendingChart } from "./dashboard/category-spending-chart"
import { SummaryCards } from "./dashboard/summary-cards"
import { Progress } from "./ui/progress"

export default function Dashboard() {
  const totalExpenses = expenses.reduce((acc, exp) => acc + exp.amount, 0)
  const totalBudget = budgets.reduce((acc, b) => acc + b.amount, 0)
  const remainingBudget = totalBudget - totalExpenses

  return (
    <Tabs defaultValue="dashboard">
      <div className="flex items-center">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="budgets">Budgets</TabsTrigger>
          <TabsTrigger value="recurring">Recurring</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="dashboard">
        <div className="grid gap-4 md:gap-8">
            <SummaryCards 
              totalBudget={totalBudget}
              totalExpenses={totalExpenses}
              remainingBudget={remainingBudget}
            />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <Card className="col-span-4">
              <CardHeader>
                <CardTitle>Monthly Spending</CardTitle>
              </CardHeader>
              <CardContent className="pl-2">
                <MonthlySpendingChart />
              </CardContent>
            </Card>
            <Card className="col-span-4 lg:col-span-3">
              <CardHeader>
                <CardTitle>Spending by Category</CardTitle>
                <CardDescription>
                  Spending breakdown for the current month.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CategorySpendingChart />
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Budget Status</CardTitle>
              <CardDescription>
                Your spending progress for each category budget.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6">
              {budgets.map(budget => {
                const category = categories.find(c => c.id === budget.categoryId)
                const spent = expenses
                  .filter(e => e.categoryId === budget.categoryId)
                  .reduce((acc, e) => acc + e.amount, 0)
                const progress = (spent / budget.amount) * 100
                return (
                  <div key={budget.categoryId} className="grid gap-2">
                    <div className="flex items-center justify-between">
                       <span className="font-medium">{category?.name}</span>
                       <span className="text-sm text-muted-foreground">
                        ${spent.toFixed(2)} / ${budget.amount.toFixed(2)}
                       </span>
                    </div>
                    <Progress value={progress} aria-label={`${category?.name} budget progress`} />
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </div>
      </TabsContent>
      <TabsContent value="transactions">
        <Card>
          <CardHeader>
            <CardTitle>Transactions</CardTitle>
            <CardDescription>
              A list of all your recorded expenses.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell className="font-medium">{expense.description}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {categories.find(c => c.id === expense.categoryId)?.name}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">${expense.amount.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{new Date(expense.date).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="budgets">
      <Card>
          <CardHeader>
            <CardTitle>Category Budgets</CardTitle>
            <CardDescription>
              Set and manage your monthly budget for each category.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
              {budgets.map(budget => {
                const category = categories.find(c => c.id === budget.categoryId);
                return (
                  <div key={budget.categoryId} className="flex items-center justify-between p-2 rounded-lg border">
                    <span className="font-medium text-sm">{category?.name}</span>
                    <div className="flex items-center gap-2">
                      <Input type="number" defaultValue={budget.amount} className="w-32 h-9" aria-label={`${category?.name} budget amount`} />
                      <Button size="sm" variant="outline">Save</Button>
                    </div>
                  </div>
                )
              })}
          </CardContent>
          <CardFooter className="border-t pt-6">
            <Button>Save All Budgets</Button>
          </CardFooter>
        </Card>
      </TabsContent>
      <TabsContent value="recurring">
        <Card>
          <CardHeader>
            <CardTitle>Recurring Expenses</CardTitle>
            <CardDescription>
              A list of your recurring expenses.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recurringExpenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell className="font-medium">{expense.description}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {categories.find(c => c.id === expense.categoryId)?.name}
                      </Badge>
                    </TableCell>
                    <TableCell className="capitalize">{expense.frequency}</TableCell>
                    <TableCell className="text-right">${expense.amount.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}
