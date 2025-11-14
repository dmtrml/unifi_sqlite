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
  Settings,
  Upload,
  Banknote,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { BudgetWiseLogo } from "./icons"
import { useUserProfile } from "@/hooks/use-user-profile"
import { useUser } from "@/lib/auth-context"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

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

export default function Sidebar() {
    const pathname = usePathname()
    const { profile } = useUserProfile()
    const { user } = useUser()
    const displayName = profile?.name || user?.displayName || "User"
    const email = profile?.email || user?.email || ""
    const initials = displayName
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase()

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
                <div className="border-t px-4 py-3">
                    <Link
                      href="/settings"
                      className="flex items-center gap-3 rounded-md border bg-background p-3 transition hover:bg-muted/60"
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarFallback>{initials || "BW"}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{displayName}</span>
                        {email && (
                          <span className="text-xs text-muted-foreground">{email}</span>
                        )}
                      </div>
                    </Link>
                </div>
            </div>
        </aside>
    )
}
