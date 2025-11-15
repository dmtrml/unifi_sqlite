"use client"

import * as React from "react"
import { format, subDays, startOfMonth, endOfMonth, startOfYear, endOfYear, startOfDay, endOfDay, isSameDay } from "date-fns"
import { Calendar as CalendarIcon, FilterX, Search } from "lucide-react"
import { DateRange } from "react-day-picker"
import { DateRange as RangePicker } from "react-date-range"
import type { RangeKeyDict } from "react-date-range"
import "react-date-range/dist/styles.css"
import "react-date-range/dist/theme/default.css"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
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
import { useIsMobile } from "@/hooks/use-mobile"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { buildCategoryChildrenMap } from "@/lib/category-tree"

interface TransactionFiltersProps {
  dateRange?: DateRange | undefined;
  onDateChange: (date: DateRange | undefined) => void;
  accounts?: Account[];
  selectedAccount: string;
  onAccountChange: (accountId: string) => void;
  categories?: Category[];
  selectedCategory: string;
  onCategoryChange: (categoryId: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortOrder: 'desc' | 'asc';
  onSortOrderChange: (order: 'desc' | 'asc') => void;
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
  sortOrder,
  onSortOrderChange,
  onReset,
}: TransactionFiltersProps) {
  const isMobile = useIsMobile();
  const [isDatePickerOpen, setIsDatePickerOpen] = React.useState(false);
  const [pendingRange, setPendingRange] = React.useState<DateRange | undefined>(dateRange);
  const flattenedCategories = React.useMemo(() => {
    if (!categories?.length) return [];
    const childMap = buildCategoryChildrenMap(categories);
    const byId = new Map(categories.map((category) => [category.id, category]));
    const roots = categories
      .filter((category) => !category.parentId || !byId.has(category.parentId))
      .sort((a, b) => a.name.localeCompare(b.name));
    const options: { id: string; label: string; depth: number }[] = [];
    const visit = (category: Category, depth: number) => {
      options.push({
        id: category.id,
        label: category.name,
        depth,
      });
      const children = (childMap.get(category.id) ?? []).slice().sort((a, b) => a.name.localeCompare(b.name));
      children.forEach((child) => visit(child as Category, depth + 1));
    };
    roots.forEach((root) => visit(root, 0));
    return options;
  }, [categories]);

  React.useEffect(() => {
    if (!isDatePickerOpen) {
      setPendingRange(dateRange);
    }
  }, [dateRange, isDatePickerOpen]);

  const normalizeRange = (range?: DateRange) => {
    if (!range?.from) return undefined;
    const from = startOfDay(range.from);
    const to = startOfDay(range.to ?? range.from);
    return { from, to: endOfDay(to) };
  };

  const handleApplyRange = () => {
    const normalized = normalizeRange(pendingRange);
    onDateChange(normalized);
    setIsDatePickerOpen(false);
  };

  const handleClearRange = () => {
    setPendingRange(undefined);
    onDateChange(undefined);
    setIsDatePickerOpen(false);
  };

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


  const isPresetActive = (range: DateRange) => {
    if (!dateRange?.from || !dateRange?.to) return false;
    return (
      isSameDay(dateRange.from, range.from!) &&
      isSameDay(dateRange.to, range.to ?? range.from!)
    );
  };

  const [rangeSelection, setRangeSelection] = React.useState(() => ({
    startDate: pendingRange?.from ?? new Date(),
    endDate: pendingRange?.to ?? pendingRange?.from ?? new Date(),
    key: "selection" as const,
  }));

  React.useEffect(() => {
    setRangeSelection({
      startDate: pendingRange?.from ?? new Date(),
      endDate: pendingRange?.to ?? pendingRange?.from ?? new Date(),
      key: "selection",
    });
  }, [pendingRange]);

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
        {isMobile ? (
          <Sheet open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
            <SheetTrigger asChild>
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
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[90vh] overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Select date range</SheetTitle>
              </SheetHeader>
              <div className="flex flex-col gap-3 py-4">
                <div className="flex flex-wrap gap-2">
                  {presets.map(({ name, label, getDateRange }) => (
                    <Button
                      key={name}
                      size="sm"
                      variant={isPresetActive(getDateRange()) ? "secondary" : "ghost"}
                      className="justify-start"
                      onClick={() => {
                        const range = getDateRange();
                        setPendingRange(range);
                        onDateChange(normalizeRange(range));
                        setIsDatePickerOpen(false);
                      }}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
                <RangePicker
                  onChange={(item: RangeKeyDict) => {
                    const selection = item.selection;
                    setRangeSelection(selection as typeof rangeSelection);
                    setPendingRange({
                      from: selection.startDate ?? undefined,
                      to: selection.endDate ?? selection.startDate ?? undefined,
                    });
                  }}
                  ranges={[rangeSelection]}
                  moveRangeOnFirstSelection={false}
                  months={1}
                  direction="vertical"
                  showDateDisplay={false}
                />
                <div className="flex gap-2 justify-end border-t pt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleClearRange}
                  >
                    Clear
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleApplyRange}
                    disabled={!pendingRange?.from}
                  >
                    Apply
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        ) : (
          <Popover open={isDatePickerOpen} onOpenChange={(open) => setIsDatePickerOpen(open)}>
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
            <PopoverContent className="w-auto max-w-full p-3" align="start">
              <div className="flex w-full flex-col gap-3">
                <div className="flex flex-wrap gap-2">
                  {presets.map(({ name, label, getDateRange }) => (
                    <Button
                      key={name}
                      size="sm"
                      variant={isPresetActive(getDateRange()) ? "secondary" : "ghost"}
                      className="justify-start"
                      onClick={() => {
                        const range = getDateRange();
                        setPendingRange(range);
                        onDateChange(normalizeRange(range));
                        setIsDatePickerOpen(false);
                      }}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
                <RangePicker
                  onChange={(item: RangeKeyDict) => {
                    const selection = item.selection;
                    setRangeSelection(selection as typeof rangeSelection);
                    setPendingRange({
                      from: selection.startDate ?? undefined,
                      to: selection.endDate ?? selection.startDate ?? undefined,
                    });
                  }}
                  ranges={[rangeSelection]}
                  moveRangeOnFirstSelection={false}
                  months={2}
                  direction="horizontal"
                  showDateDisplay={false}
                />
                <div className="flex gap-2 justify-end border-t pt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleClearRange}
                  >
                    Clear
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleApplyRange}
                    disabled={!pendingRange?.from}
                  >
                    Apply
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        )}

        <Select value={selectedAccount} onValueChange={onAccountChange}>
          <SelectTrigger className="w-full md:w-[180px]">
            <SelectValue placeholder="All Accounts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Accounts</SelectItem>
            {accounts && accounts.map((account) => (
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
            {flattenedCategories.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                <span
                  className={cn(
                    "block",
                    option.depth > 0 && "pl-4 text-sm text-muted-foreground",
                  )}
                >
                  {option.depth > 0 ? `↳ ${option.label}` : option.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <Select value={sortOrder} onValueChange={(value) => onSortOrderChange(value as 'desc' | 'asc')}>
          <SelectTrigger className="w-full md:w-[180px]">
            <SelectValue placeholder="Sort by date" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="desc">Newest first</SelectItem>
            <SelectItem value="asc">Oldest first</SelectItem>
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
