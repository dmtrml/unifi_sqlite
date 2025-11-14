
"use client"

import * as React from "react"
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, addMonths, subMonths, addYears, subYears, addWeeks, subWeeks, isSameDay } from "date-fns"
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react"
import { DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

type PeriodType = "week" | "month" | "year" | "all" | "custom";

type PresetOption = {
  name: string;
  label: string;
  period: PeriodType;
  getDateRange: () => DateRange | undefined;
};

interface DateRangePickerProps {
  dateRange?: DateRange;
  onDateChange: (dateRange: DateRange | undefined) => void;
  className?: string;
}

const detectPeriod = (range?: DateRange): PeriodType => {
  if (!range?.from || !range?.to) return 'all';
  const base = range.from;
  if (isSameDay(range.from, startOfWeek(base)) && isSameDay(range.to, endOfWeek(base))) {
    return 'week';
  }
  if (isSameDay(range.from, startOfMonth(base)) && isSameDay(range.to, endOfMonth(base))) {
    return 'month';
  }
  if (isSameDay(range.from, startOfYear(base)) && isSameDay(range.to, endOfYear(base))) {
    return 'year';
  }
  return 'custom';
};

export function DateRangePicker({ dateRange, onDateChange, className }: DateRangePickerProps) {
  const [periodType, setPeriodType] = React.useState<PeriodType>(() => detectPeriod(dateRange) || 'year');
  const [displayDate, setDisplayDate] = React.useState(dateRange?.from || new Date());
  const [isOpen, setIsOpen] = React.useState(false);

  React.useEffect(() => {
    const detected = detectPeriod(dateRange);
    setPeriodType(detected);
    if (dateRange?.from) {
      setDisplayDate(dateRange.from);
    }
  }, [dateRange]);

  const presets: PresetOption[] = [
    { name: "thisWeek", label: "This Week", period: "week", getDateRange: () => ({ from: startOfWeek(new Date()), to: endOfWeek(new Date()) }) },
    { name: "thisMonth", label: "This Month", period: "month", getDateRange: () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }) },
    { name: "thisYear", label: "This Year", period: "year", getDateRange: () => ({ from: startOfYear(new Date()), to: endOfYear(new Date()) }) },
    { name: "allTime", label: "All time", period: "all", getDateRange: () => undefined },
  ];

  const handlePresetSelect = (preset: PresetOption) => {
    setPeriodType(preset.period);
    const newRange = preset.getDateRange();
    onDateChange(newRange);
    if (newRange?.from) {
      setDisplayDate(newRange.from);
    }
    setIsOpen(false);
  }

  const handleDateSelect = (newRange: DateRange | undefined) => {
    if (newRange) {
        setPeriodType("custom");
        onDateChange(newRange);
        setDisplayDate(newRange.from || new Date());
    }
    // Close popover only if a full range is selected
    if (newRange?.from && newRange?.to) {
      setIsOpen(false);
    }
  }
  
  const handlePeriodNavigation = (direction: 'prev' | 'next') => {
    let newDisplayDate: Date;
    let newRange: DateRange | undefined;
    
    switch (periodType) {
      case 'week':
        newDisplayDate = direction === 'prev' ? subWeeks(displayDate, 1) : addWeeks(displayDate, 1);
        newRange = { from: startOfWeek(newDisplayDate), to: endOfWeek(newDisplayDate) };
        break;
      case 'month':
        newDisplayDate = direction === 'prev' ? subMonths(displayDate, 1) : addMonths(displayDate, 1);
        newRange = { from: startOfMonth(newDisplayDate), to: endOfMonth(newDisplayDate) };
        break;
      case 'year':
        newDisplayDate = direction === 'prev' ? subYears(displayDate, 1) : addYears(displayDate, 1);
        newRange = { from: startOfYear(newDisplayDate), to: endOfYear(newDisplayDate) };
        break;
      default:
        return; // Arrows do nothing for "all" or "custom"
    }

    setDisplayDate(newDisplayDate);
    onDateChange(newRange);
  };
  
  const formatDisplayDate = () => {
    if (!dateRange?.from) return "All time";

    const { from, to } = dateRange;

    switch (periodType) {
      case 'week':
        return `${format(from, "LLL dd")} - ${to ? format(to, "LLL dd, y") : ""}`;
      case 'month':
        return format(from, "MMMM yyyy");
      case 'year':
        return format(from, "yyyy");
      case 'custom':
         if (to && !isSameDay(from, to)) {
            return `${format(from, "LLL dd, y")} - ${format(to, "LLL dd, y")}`;
         }
         return format(from, "LLL dd, y");
      default:
         return "All time";
    }
  }

  return (
    <div className={cn("flex items-center justify-center gap-2", className)}>
        <Button
            variant="outline"
            size="icon"
            onClick={() => handlePeriodNavigation('prev')}
            disabled={periodType === 'all' || periodType === 'custom'}
        >
            <ChevronLeft className="h-4 w-4" />
        </Button>

        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button
                variant={"outline"}
                className={cn(
                    "w-full md:w-auto justify-center text-center font-normal",
                    !dateRange && "text-muted-foreground"
                )}
                >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {formatDisplayDate()}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 flex" align="center">
                <div className="flex flex-col space-y-2 p-3 pr-2 border-r">
                {presets.map(({ name, label, getDateRange, period }) => (
                    <Button
                    key={name}
                    variant={periodType === period ? "default" : "ghost"}
                    className="justify-start"
                    onClick={() => handlePresetSelect({ name, label, getDateRange, period })}
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
                    onSelect={handleDateSelect}
                    numberOfMonths={1}
                />
            </PopoverContent>
        </Popover>
        
        <Button
            variant="outline"
            size="icon"
            onClick={() => handlePeriodNavigation('next')}
            disabled={periodType === 'all' || periodType === 'custom'}
        >
            <ChevronRight className="h-4 w-4" />
        </Button>
    </div>
  );
}
