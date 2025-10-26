"use client"

import * as React from "react"
import { collection, query, where, getDocs, doc } from "firebase/firestore"
import { useCollection, useFirestore, useUser, useMemoFirebase, useDoc } from "@/firebase"
import * as Icons from "lucide-react"
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
import type { Category, Budget, User } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"
import { addDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase/non-blocking-updates"

function BudgetsPageContent() {
  const { user } = useUser()
  const firestore = useFirestore()
  const { toast } = useToast()
  // This state will now hold the string value from the input fields
  const [inputValues, setInputValues] = React.useState<Record<string, string>>({})
  
  const userDocRef = useMemoFirebase(
    () => (user ? doc(firestore, "users", user.uid) : null),
    [user, firestore]
  )
  const { data: userData } = useDoc<User>(userDocRef)

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

  // Effect to populate the input fields with the original budget amounts
  React.useEffect(() => {
    if (budgets) {
      const values = budgets.reduce((acc, budget) => {
        acc[budget.categoryId] = String(budget.amount);
        return acc;
      }, {} as Record<string, string>);
      setInputValues(values);
    }
  }, [budgets]);
  
  const handleInputChange = (categoryId: string, value: string) => {
    setInputValues(prev => ({ ...prev, [categoryId]: value }));
  }
  
  const handleSaveBudget = async (categoryId: string) => {
    if (!user || !firestore || !userData) {
      toast({ title: "Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }
    
    // Get the raw string value from the input
    const inputValue = inputValues[categoryId];
    if (inputValue === undefined || inputValue === null) return; // Nothing to save

    const amount = parseFloat(inputValue);
    if (isNaN(amount) || amount < 0) {
      toast({ title: "Invalid Amount", description: "Please enter a valid positive number.", variant: "destructive" });
      return;
    }

    const budgetsRef = collection(firestore, `users/${user.uid}/budgets`);
    const q = query(budgetsRef, where("categoryId", "==", categoryId));
    
    try {
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) {
        // CREATE NEW: Use the user's current main currency
        addDocumentNonBlocking(budgetsRef, {
          userId: user.uid,
          categoryId: categoryId,
          amount: amount,
          currency: userData.mainCurrency || 'USD',
        });
        toast({ title: "Budget Saved", description: "Your new budget has been saved." });
      } else {
        // UPDATE EXISTING: Only update the amount, keep the original currency
        const budgetDoc = querySnapshot.docs[0];
        const budgetRef = doc(firestore, `users/${user.uid}/budgets/${budgetDoc.id}`);
        updateDocumentNonBlocking(budgetRef, { 
            amount: amount,
        });
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
            Set and manage your monthly budgets. New budgets are created in your main currency ({userData?.mainCurrency || 'USD'}).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {expenseCategories.map((category) => {
               const IconComponent = (Icons as any)[category.icon] || Icons.MoreHorizontal;
               const existingBudget = budgets?.find(b => b.categoryId === category.id);
               // The currency is determined by the existing budget, or defaults to the main currency for new ones.
               const currencySymbol = existingBudget?.currency || userData?.mainCurrency || 'USD';
               // The value is the raw string from state, or an empty string.
               const inputValue = inputValues[category.id] ?? '';

               return (
                <div key={category.id} className="flex items-center justify-between gap-4 rounded-lg border p-3 md:p-4">
                  <div className="flex items-center gap-3">
                    <IconComponent className="h-5 w-5" style={{ color: category.color }} />
                    <span className="font-medium">{category.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                       {/* This span now shows the definitive currency of the budget */}
                       <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">{currencySymbol}</span>
                       <Input 
                         type="number"
                         value={inputValue}
                         onChange={(e) => handleInputChange(category.id, e.target.value)}
                         placeholder="0.00"
                         className="w-32 pl-10" 
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
    <AppLayout>
        <BudgetsPageContent />
    </AppLayout>
  )
}
