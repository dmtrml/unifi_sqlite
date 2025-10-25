"use client"

import * as React from "react"
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns"
import { Calendar as CalendarIcon, FilterX, Search } from "lucide-react"
import { DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Account, Category } from "@/lib/types"
import { Separator } from "./ui/separator"
import { Input } from "./ui/input"

interface TransactionFiltersProps {
  dateRange: DateRange | undefined;
  onDateChange: (date: DateRange | undefined) => void;
  accounts: Account[];
  selectedAccount: string;
  onAccountChange: (accountId: string) => void;
  categories: Category[];
  selectedCategory: string;
  onCategoryChange: (categoryId: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onReset: () => void;
}

export function TransactionFilters({
  dateRange,
  onDateChange,
  accounts,
  selectedAccount,
  onAccountChange,
  categories,
  selectedCategory,
  onCategoryChange,
  searchQuery,
  onSearchChange,
  onReset,
}: TransactionFiltersProps) {

  const presets = [
    {
      name: "today",
      label: "Today",
      getDateRange: () => ({ from: new Date(), to: new Date() }),
    },
    {
      name: "yesterday",
      label: "Yesterday",
      getDateRange: () => ({
        from: subDays(new Date(), 1),
        to: subDays(new Date(), 1),
      }),
    },
    {
      name: "last7",
      label: "Last 7 days",
      getDateRange: () => ({ from: subDays(new Date(), 6), to: new Date() }),
    },
    {
      name: "thisMonth",
      label: "This month",
      getDateRange: () => ({
        from: startOfMonth(new Date()),
        to: endOfMonth(new Date()),
      }),
    },
    {
      name: "last30",
      label: "Last 30 days",
      getDateRange: () => ({ from: subDays(new Date(), 29), to: new Date() }),
    },
    {
      name: "thisYear",
      label: "This year",
      getDateRange: () => ({
        from: startOfYear(new Date()),
        to: endOfYear(new Date()),
      }),
    },
  ]


  return (
    <div className="flex flex-col gap-2 mb-4">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search by description..."
          className="w-full appearance-none bg-background pl-8 shadow-none"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      <div className="flex flex-col md:flex-row gap-2 md:items-center">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              id="date"
              variant={"outline"}
              className={cn(
                "w-full md:w-[300px] justify-start text-left font-normal",
                !dateRange && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateRange?.from ? (
                dateRange.to ? (
                  <>
                    {format(dateRange.from, "LLL dd, y")} -{" "}
                    {format(dateRange.to, "LLL dd, y")}
                  </>
                ) : (
                  format(dateRange.from, "LLL dd, y")
                )
              ) : (
                <span>Pick a date</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 flex" align="start">
            <div className="flex flex-col space-y-2 p-3 pr-2 border-r">
              {presets.map(({ name, label, getDateRange }) => (
                <Button
                  key={name}
                  variant="ghost"
                  className="justify-start"
                  onClick={() => onDateChange(getDateRange())}
                >
                  {label}
                </Button>
              ))}
            </div>
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={dateRange?.from}
              selected={dateRange}
              onSelect={onDateChange}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>

        <Select value={selectedAccount} onValueChange={onAccountChange}>
          <SelectTrigger className="w-full md:w-[180px]">
            <SelectValue placeholder="All Accounts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Accounts</SelectItem>
            {accounts.map((account) => (
              <SelectItem key={account.id} value={account.id}>
                {account.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedCategory} onValueChange={onCategoryChange}>
          <SelectTrigger className="w-full md:w-[180px]">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <Button onClick={onReset} variant="ghost" size="icon" className="md:ml-2">
          <FilterX className="h-4 w-4" />
          <span className="sr-only">Reset Filters</span>
        </Button>
      </div>
    </div>
  )
}

    