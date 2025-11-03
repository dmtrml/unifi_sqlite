"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Bell,
  CircleUser,
  Home,
  LineChart,
  Menu,
  Package,
  Package2,
  Search,
  ShoppingCart,
  Users,
  Landmark,
  Wallet,
  Repeat,
  DollarSign,
  Shapes,
  Settings,
  Upload,
  Banknote,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { BudgetWiseLogo } from "./icons"
import { AddTransactionDialog } from "./add-transaction-dialog"
import { useCollection, useFirestore, useUser, useMemoFirebase, useAuth } from "@/firebase"
import type { Category, Account } from "@/lib/types"
import { collection, query } from "firebase/firestore"
import { signOut } from "firebase/auth";
import { cn } from "@/lib/utils"


const navItems = [
    { href: "/", label: "Dashboard", icon: Home },
    { href: "/transactions", label: "Transactions", icon: Wallet },
    { href: "/accounts", label: "Accounts", icon: Landmark },
    { href: "/categories", label: "Categories", icon: Shapes },
    { href: "/budgets", label: "Budgets", icon: DollarSign },
    { href: "/recurring", label: "Recurring", icon: Repeat },
    { href: "/reports", label: "Reports", icon: LineChart },
    { href: "/import", label: "Import", icon: Upload },
    { href: "/mercado-pago", label: "Mercado Pago", icon: Banknote },
    { href: "/settings", label: "Settings", icon: Settings },
]

export default function AppHeader() {
  const { user } = useUser();
  const firestore = useFirestore();
  const auth = useAuth()
  const pathname = usePathname()

  const categoriesQuery = useMemoFirebase(() => 
    user ? query(collection(firestore, "users", user.uid, "categories")) : null,
    [user, firestore]
  )
  const { data: categories } = useCollection<Category>(categoriesQuery);

  const accountsQuery = useMemoFirebase(() =>
    user ? query(collection(firestore, "users", user.uid, "accounts")) : null,
    [user, firestore]
  );
  const { data: accounts } = useCollection<Account>(accountsQuery);

  const handleLogout = () => {
    if (!auth) return;
    signOut(auth);
  }

  return (
    <header className="flex h-14 items-center gap-4 border-b bg-muted/40 px-4 lg:h-[60px] lg:px-6">
        <Sheet>
            <SheetTrigger asChild>
                <Button
                    variant="outline"
                    size="icon"
                    className="shrink-0 md:hidden"
                >
                    <Menu className="h-5 w-5" />
                    <span className="sr-only">Toggle navigation menu</span>
                </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex flex-col">
                <SheetHeader>
                    <SheetTitle>
                        <Link
                            href="/"
                            className="flex items-center gap-2 text-lg font-semibold"
                        >
                            <BudgetWiseLogo className="h-6 w-6" />
                            <span>BudgetWise</span>
                        </Link>
                    </SheetTitle>
                </SheetHeader>
                <nav className="grid gap-2 text-lg font-medium">
                     {navItems.map((item) => (
                        <Link
                            key={item.label}
                            href={item.href}
                            className={cn(
                                "mx-[-0.65rem] flex items-center gap-4 rounded-xl px-3 py-2 text-muted-foreground hover:text-foreground",
                                pathname === item.href && "text-foreground bg-muted"
                            )}
                        >
                            <item.icon className="h-5 w-5" />
                            {item.label}
                        </Link>
                    ))}
                </nav>
            </SheetContent>
        </Sheet>
        <div className="w-full flex-1">
        </div>
        <div className="flex items-center gap-2">
            {user && categories && accounts && <AddTransactionDialog categories={categories} accounts={accounts} />}
        </div>
        {user && (
          <DropdownMenu>
              <DropdownMenuTrigger asChild>
                  <Button variant="secondary" size="icon" className="rounded-full">
                      <CircleUser className="h-5 w-5" />
                      <span className="sr-only">Toggle user menu</span>
                  </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                  <DropdownMenuLabel>{user.email || "My Account"}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/settings">Settings</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem>Support</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout}>Logout</DropdownMenuItem>
              </DropdownMenuContent>
          </DropdownMenu>
        )}
    </header>
  )
}
