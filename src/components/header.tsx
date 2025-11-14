"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Banknote,
  DollarSign,
  Moon,
  Filter,
  Home,
  Landmark,
  LineChart,
  Menu,
  Repeat,
  Settings,
  Shapes,
  Upload,
  Sun,
  Wallet,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { BudgetWiseLogo } from "@/components/icons"
import { cn } from "@/lib/utils"
import { useUser } from "@/lib/auth-context"
import { useAccounts } from "@/hooks/use-accounts"
import { useCategories } from "@/hooks/use-categories"
import { AddTransactionDialog } from "@/components/add-transaction-dialog"
import { AddAccountDialog } from "@/components/add-account-dialog"
import { AddCategoryDialog } from "@/components/add-category-dialog"
import { AddRecurringTransactionDialog } from "@/components/add-recurring-transaction-dialog"
import { useThemePreference } from "@/components/theme-provider"

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
  const pathname = usePathname()
  const { user } = useUser()
  const { categories } = useCategories()
  const { accounts } = useAccounts()

  const headerActions = React.useMemo(() => {
    if (!user) return []
    const nodes: React.ReactNode[] = []

    if (pathname === "/" || pathname?.startsWith("/transactions")) {
      if (categories && accounts) {
        nodes.push(<AddTransactionDialog key="add-transaction" categories={categories} accounts={accounts} />)
      }
      if (pathname?.startsWith("/transactions")) {
        nodes.push(<TransactionsFilterButton key="filters" />)
      }
      return nodes
    }

    if (pathname?.startsWith("/accounts")) {
      nodes.push(<AddAccountDialog key="add-account" />)
      return nodes
    }

    if (pathname?.startsWith("/categories")) {
      nodes.push(<AddCategoryDialog key="add-category" />)
      return nodes
    }

    if (pathname?.startsWith("/recurring") && categories && accounts) {
      nodes.push(<AddRecurringTransactionDialog key="add-recurring" categories={categories} accounts={accounts} />)
      return nodes
    }

    if (pathname?.startsWith("/settings")) {
      nodes.push(<ThemeToggleButton key="theme-toggle" />)
      return nodes
    }

    return nodes
  }, [user, pathname, categories, accounts])

  return (
    <header className="flex h-14 items-center gap-4 border-b bg-muted/40 px-4 lg:h-[60px] lg:px-6">
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon" className="shrink-0 md:hidden">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle navigation menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="flex flex-col">
          <SheetHeader>
            <SheetTitle>
              <Link href="/" className="flex items-center gap-2 text-lg font-semibold">
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
                  pathname === item.href && "bg-muted text-foreground",
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            ))}
          </nav>
        </SheetContent>
      </Sheet>
      <div className="w-full flex-1" />
      <div className="flex items-center gap-2">{headerActions}</div>
    </header>
  )
}

const TransactionsFilterButton = () => {
  const handleOpen = React.useCallback(() => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("transactions:filters-open"))
    }
  }, [])

  return (
    <Button variant="outline" onClick={handleOpen}>
      <Filter className="mr-2 h-4 w-4" />
      Filters
    </Button>
  )
}

const ThemeToggleButton = () => {
  const { theme, setTheme } = useThemePreference()
  const isDark = theme === 'dark'
  const toggleTheme = () => setTheme(isDark ? 'light' : 'dark')

  return (
    <Button variant="outline" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  )
}
