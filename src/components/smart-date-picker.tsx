"use client"

import * as React from "react"
import DatePicker from "react-datepicker"
import { CalendarIcon } from "lucide-react"
import { parse, isValid } from "date-fns"

import { Input } from "@/components/ui/input"

import "react-datepicker/dist/react-datepicker.css"
import "@/styles/react-datepicker.css"

const PRIMARY_FORMAT = "yyyy-MM-dd"
const FALLBACK_FORMATS = ["dd.MM.yyyy", "MM/dd/yyyy", "dd/MM/yyyy"]

type SmartDatePickerProps = {
  value?: Date | null
  onChange: (date: Date | undefined) => void
  fromYear?: number
  toYear?: number
}

type CustomInputProps = {
  value?: string
  onClick?: () => void
  onChange?: React.ChangeEventHandler<HTMLInputElement>
  onBlur?: React.FocusEventHandler<HTMLInputElement>
  placeholder?: string
}

const DateInput = React.forwardRef<HTMLInputElement, CustomInputProps>(
  ({ value, onClick, onChange, onBlur, placeholder }, ref) => (
    <div className="relative">
      <Input
        ref={ref}
        value={value}
        onClick={onClick}
        onChange={onChange}
        onBlur={onBlur}
        placeholder={placeholder}
        className="pr-10"
      />
      <CalendarIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  ),
)
DateInput.displayName = "DateInput"

const normalizeDate = (value?: Date | null) => {
  if (!value) return null
  return new Date(value.getFullYear(), value.getMonth(), value.getDate())
}

const parseDateInput = (raw?: string | null): Date | null | undefined => {
  if (typeof raw !== "string") return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  const formats = [PRIMARY_FORMAT, ...FALLBACK_FORMATS]
  for (const fmt of formats) {
    const parsed = parse(trimmed, fmt, new Date())
    if (isValid(parsed)) {
      return normalizeDate(parsed)
    }
  }
  const timestamp = Date.parse(trimmed)
  if (!Number.isNaN(timestamp)) {
    return normalizeDate(new Date(timestamp))
  }
  return undefined
}

export function SmartDatePicker({
  value,
  onChange,
  fromYear = 2000,
  toYear = new Date().getFullYear() + 1,
}: SmartDatePickerProps) {
  const selectedDate = React.useMemo(() => normalizeDate(value), [value])

  const emitChange = React.useCallback(
    (next: Date | null | undefined) => {
      if (!next) {
        onChange(undefined)
      } else {
        onChange(normalizeDate(next) ?? undefined)
      }
    },
    [onChange],
  )

const handleBlur = React.useCallback(
  (event?: React.SyntheticEvent<any>) => {
    const target = event?.currentTarget as HTMLInputElement | undefined
    if (!target) return
    const parsed = parseDateInput(target.value)
    if (parsed !== undefined) {
      emitChange(parsed)
    }
  },
  [emitChange],
)

const handleChangeRaw = React.useCallback(
  (event?: React.SyntheticEvent<any>) => {
    const target = event?.target as HTMLInputElement | undefined
    if (!target) {
      emitChange(null)
      return
    }
    const parsed = parseDateInput(target.value)
    if (parsed !== undefined) {
      emitChange(parsed)
    }
  },
  [emitChange],
)

  return (
    <DatePicker
      selected={selectedDate}
      onChange={(date) => emitChange(date as Date | null)}
      onChangeRaw={handleChangeRaw}
      onBlur={handleBlur}
      dateFormat={PRIMARY_FORMAT}
      placeholderText="YYYY-MM-DD"
      showMonthDropdown
      showYearDropdown
      dropdownMode="select"
      minDate={new Date(fromYear, 0, 1)}
      maxDate={new Date(toYear, 11, 31)}
      isClearable
      customInput={<DateInput />}
      className="w-full"
      popperClassName="z-[60]"
    />
  )
}
