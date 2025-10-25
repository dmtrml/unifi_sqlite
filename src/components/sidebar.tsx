"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Home,
  LineChart,
  Repeat,
  DollarSign,
  Landmark,
  Shapes,
  Wallet,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { BudgetWiseLogo } from "./icons"
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card"
import { Button } from "./ui/button"

const navItems = [
    { href: "/", label: "Dashboard", icon: Home },
    { href: "/transactions", label: "Transactions", icon: Wallet },
    { href: "/accounts", label: "Accounts", icon: Landmark },
    { href: "/categories", label: "Categories", icon: Shapes },
    { href: "/budgets", label: "Budgets", icon: DollarSign },
    { href: "/recurring", label: "Recurring", icon: Repeat },
    { href: "#", label: "Reports", icon: LineChart },
]

export default function Sidebar() {
    const pathname = usePathname()

    return (
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
                        {navItems.map((item) => (
                            <Link
                                key={item.label}
                                href={item.href}
                                className={cn(
                                    "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary",
                                    pathname === item.href && "bg-muted text-primary"
                                )}
                            >
                                <item.icon className="h-4 w-4" />
                                {item.label}
                            </Link>
                        ))}
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
    )
}
