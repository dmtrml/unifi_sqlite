"use client"

import * as React from "react"
import Link from "next/link"
import { collection, query, where, getDocs, doc } from "firebase/firestore"
import { useCollection, useFirestore, useUser, useMemoFirebase } from "@/firebase"
import * as Icons from "lucide-react"

import {
  Home,
  LineChart,
  Repeat,
  DollarSign,
  Landmark,
  Wallet,
  Shapes,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import AppHeader from "@/components/header"
import { BudgetWiseLogo } from "@/components/icons"
import type { Category, Budget } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"
import { addDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase/non-blocking-updates"

function BudgetsPageContent() {
  const { user } = useUser()
  const firestore = useFirestore()
  const { toast } = useToast()
  const [budgetAmounts, setBudgetAmounts] = React.useState<Record<string, number | string>>({})

  const categoriesQuery = useMemoFirebase(() =>
    user ? query(collection(firestore, "users", user.uid, "categories")) : null,
    [user, firestore]
  );
  const { data: categories } = useCollection<Category>(categoriesQuery);

  const budgetsQuery = useMemoFirebase(() =>
    user ? query(collection(firestore, "users", user.uid, "budgets")) : null,
    [user, firestore]
  );
  const { data: budgets } = useCollection<Budget>(budgetsQuery);

  const expenseCategories = React.useMemo(() => 
    (categories || []).filter(c => c.type === 'expense' || !c.type), 
    [categories]
  );

  React.useEffect(() => {
    if (budgets) {
      const amounts = budgets.reduce((acc, budget) => {
        acc[budget.categoryId] = budget.amount;
        return acc;
      }, {} as Record<string, number>);
      setBudgetAmounts(amounts);
    }
  }, [budgets]);
  
  const handleAmountChange = (categoryId: string, value: string) => {
    setBudgetAmounts(prev => ({ ...prev, [categoryId]: value }));
  }
  
  const handleSaveBudget = async (categoryId: string) => {
    if (!user || !firestore) {
      toast({ title: "Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }
    const amount = parseFloat(String(budgetAmounts[categoryId]));
    if (isNaN(amount) || amount < 0) {
      toast({ title: "Invalid Amount", description: "Please enter a valid positive number.", variant: "destructive" });
      return;
    }

    const budgetsRef = collection(firestore, `users/${user.uid}/budgets`);
    const q = query(budgetsRef, where("categoryId", "==", categoryId));
    
    try {
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) {
        // Create new budget
        addDocumentNonBlocking(budgetsRef, {
          userId: user.uid,
          categoryId: categoryId,
          amount: amount,
        });
        toast({ title: "Budget Saved", description: "Your new budget has been saved." });
      } else {
        // Update existing budget
        const budgetDoc = querySnapshot.docs[0];
        const budgetRef = doc(firestore, `users/${user.uid}/budgets/${budgetDoc.id}`);
        updateDocumentNonBlocking(budgetRef, { amount: amount });
        toast({ title: "Budget Updated", description: "Your budget has been successfully updated." });
      }
    } catch (error) {
       console.error("Error saving budget: ", error);
       toast({ title: "Error", description: "Failed to save budget.", variant: "destructive" });
    }
  }


  return (
    <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
      <div className="flex items-center">
        <h1 className="text-lg font-semibold md:text-2xl">Budgets</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Manage Budgets</CardTitle>
          <CardDescription>
            Set and manage your monthly budgets for each category.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {expenseCategories.map((category) => {
               const IconComponent = (Icons as any)[category.icon] || Icons.MoreHorizontal;
               const currentAmount = budgetAmounts[category.id] ?? '';
               return (
                <div key={category.id} className="flex items-center justify-between gap-4 rounded-lg border p-3 md:p-4">
                  <div className="flex items-center gap-3">
                    <IconComponent className="h-5 w-5" style={{ color: category.color }} />
                    <span className="font-medium">{category.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                       <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">$</span>
                       <Input 
                         type="number"
                         value={currentAmount}
                         onChange={(e) => handleAmountChange(category.id, e.target.value)}
                         placeholder="0.00"
                         className="w-32 pl-7" 
                         aria-label={`${category.name} budget amount`} 
                       />
                    </div>
                    <Button size="sm" variant="outline" onClick={() => handleSaveBudget(category.id)}>Save</Button>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

export default function BudgetsPage() {
  return (
    <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
      <aside className="hidden border-r bg-muted/40 md:block">
        <div className="flex h-full max-h-screen flex-col gap-2">
          <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <BudgetWiseLogo className="h-6 w-6" />
              <span className="">BudgetWise</span>
            </Link>
          </div>
          <div className="flex-1">
            <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
              <Link
                href="/"
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary"
              >
                <Home className="h-4 w-4" />
                Dashboard
              </Link>
              <Link
                href="/transactions"
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary"
              >
                <Wallet className="h-4 w-4" />
                Transactions
              </Link>
              <Link
                href="/accounts"
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary"
              >
                <Landmark className="h-4 w-4" />
                Accounts
              </Link>
              <Link
                href="/categories"
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary"
              >
                <Shapes className="h-4 w-4" />
                Categories
              </Link>
              <Link
                href="/budgets"
                className="flex items-center gap-3 rounded-lg bg-muted px-3 py-2 text-primary transition-all hover:text-primary"
              >
                <DollarSign className="h-4 w-4" />
                Budgets
              </Link>
              <Link
                href="/recurring"
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary"
              >
                <Repeat className="h-4 w-4" />
                Recurring
              </Link>
              <Link
                href="#"
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary"
              >
                <LineChart className="h-4 w-4" />
                Reports
              </Link>
            </nav>
          </div>
          <div className="mt-auto p-4">
            <Card>
              <CardHeader className="p-2 pt-0 md:p-4">
                <CardTitle>Upgrade to Pro</CardTitle>
              </CardHeader>
              <CardContent className="p-2 pt-0 md:p-4 md:pt-0">
                <Button size="sm" className="w-full">
                  Upgrade
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </aside>
      <div className="flex flex-col">
        <AppHeader />
        <BudgetsPageContent />
      </div>
    </div>
  )
}
