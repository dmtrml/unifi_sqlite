"use client"

import * as React from "react"
import { format } from 'date-fns'
import * as Icons from "lucide-react"
import { ArrowRightLeft, Landmark } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Transaction, Category, Account, Currency } from "@/lib/types"

interface AccountTransactionListProps {
  transactions: Transaction[];
  categories: Category[];
  accounts: Account[];
  currentAccountId: string;
}

export function AccountTransactionList({ transactions, categories, accounts, currentAccountId }: AccountTransactionListProps) {
  
  if (transactions.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No transactions found for this account.
      </div>
    )
  }
  
  const getCategory = (categoryId?: string) => categories.find(c => c.id === categoryId);
  const getAccount = (accountId?: string) => accounts.find(a => a.id === accountId);

  const groupedTransactions = transactions.reduce((acc, transaction) => {
    const dateStr = format(new Date(transaction.date.seconds * 1000), 'yyyy-MM-dd');
    if (!acc[dateStr]) {
      acc[dateStr] = [];
    }
    acc[dateStr].push(transaction);
    return acc;
  }, {} as Record<string, Transaction[]>);

  const formatDateHeader = (dateStr: string) => {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const todayStr = format(today, 'yyyy-MM-dd');
    const yesterdayStr = format(yesterday, 'yyyy-MM-dd');
    
    if (dateStr === todayStr) return "Today";
    if (dateStr === yesterdayStr) return "Yesterday";
    
    const date = new Date(dateStr);
    const zonedDate = new Date(date.valueOf() + date.getTimezoneOffset() * 60 * 1000);
    return format(zonedDate, "MMMM d, yyyy");
  }

  return (
    <div className="space-y-4">
      {Object.entries(groupedTransactions).map(([date, transactionsInGroup]) => (
        <div key={date}>
          <h3 className="font-semibold text-muted-foreground bg-muted/50 rounded-md px-2 py-1 my-2">{formatDateHeader(date)}</h3>
          <div className="divide-y">
            {transactionsInGroup.map((transaction) => {
              const isTransfer = transaction.transactionType === 'transfer';
              const isExpense = transaction.transactionType === 'expense';
              const isIncome = transaction.transactionType === 'income';

              let category, account, otherAccount;
              let IconComponent = Icons.MoreHorizontal;
              let iconColor = 'hsl(var(--foreground))';
              let title = transaction.description || "Uncategorized";
              let subtitle: string | null = null;
              let amountDisplay: React.ReactNode;

              if (isTransfer) {
                const fromAccount = getAccount(transaction.fromAccountId);
                const toAccount = getAccount(transaction.toAccountId);
                IconComponent = ArrowRightLeft;
                
                if (transaction.fromAccountId === currentAccountId) { // This is an outgoing transfer
                  otherAccount = toAccount;
                  title = `Transfer to ${otherAccount?.name || 'another account'}`;
                  subtitle = fromAccount?.name || null;
                  const amount = transaction.amountSent || transaction.amount || 0;
                  const currency = fromAccount?.currency || 'USD';
                  amountDisplay = (
                    <span className="font-bold text-destructive">
                      - {new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)}
                    </span>
                  );
                } else { // This is an incoming transfer
                  otherAccount = fromAccount;
                  title = `Transfer from ${otherAccount?.name || 'another account'}`;
                  subtitle = toAccount?.name || null;
                  const amount = transaction.amountReceived || transaction.amount || 0;
                  const currency = toAccount?.currency || 'USD';
                  amountDisplay = (
                     <span className="font-bold text-primary">
                      + {new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)}
                    </span>
                  )
                }
              } else { // Expense or Income
                category = getCategory(transaction.categoryId);
                account = getAccount(transaction.accountId);
                
                if (category) {
                  IconComponent = (Icons as any)[category.icon] || Icons.HelpCircle;
                  iconColor = category.color;
                  title = category.name;
                }
                subtitle = transaction.description;

                const amount = transaction.amount || 0;
                const currency = account?.currency || 'USD';
                const formattedAmount = new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

                amountDisplay = (
                  <span className={cn("font-bold", isExpense ? 'text-destructive' : 'text-primary')}>
                    {isExpense ? '- ' : '+ '}
                    {formattedAmount}
                  </span>
                )
              }

              return (
                <div key={transaction.id} className="p-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <IconComponent className="h-6 w-6 shrink-0" style={{ color: iconColor }} />
                    <div className="flex flex-col space-y-0.5 overflow-hidden">
                      <span className="font-medium truncate">{title}</span>
                      {subtitle && <p className="text-sm text-muted-foreground truncate">{subtitle}</p>}
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    {amountDisplay}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
