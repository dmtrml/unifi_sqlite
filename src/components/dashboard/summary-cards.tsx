"use client"

import { DollarSign, PiggyBank, Wallet } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"

type SummaryCardsProps = {
    totalBudget: number;
    totalExpenses: number;
    totalIncome: number;
}

export function SummaryCards({ totalBudget, totalExpenses, totalIncome }: SummaryCardsProps) {
    const remainingBudget = totalBudget - totalExpenses;
    const cards = [
        {
            title: "Total Income",
            amount: totalIncome,
            icon: PiggyBank,
        },
        {
            title: "Total Spent",
            amount: totalExpenses,
            icon: Wallet,
        },
        {
            title: "Remaining Budget",
            amount: remainingBudget,
            icon: DollarSign,
        },
    ]

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {cards.map(card => (
                <Card key={card.title}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            {card.title}
                        </CardTitle>
                        <card.icon className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">${card.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    </CardContent>
                </Card>
            ))}
        </div>
    )
}
