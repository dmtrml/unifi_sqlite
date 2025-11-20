import { Timestamp } from "@/lib/timestamp";

type DateLike = number | string | Date | Timestamp;

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const coerceDate = (value: DateLike): Date => {
  if (value instanceof Timestamp) {
    return value.toDate();
  }
  if (typeof value === "number") {
    return new Date(value);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (ISO_DATE_PATTERN.test(trimmed)) {
      return new Date(`${trimmed}T00:00:00Z`);
    }
    return new Date(trimmed);
  }
  return value;
};

const normalizeDate = (value: DateLike): Date | null => {
  const date = coerceDate(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatDateLabel = (
  value: DateLike,
  locale?: Intl.LocalesArgument,
  options?: Intl.DateTimeFormatOptions,
) => {
  const date = normalizeDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat(locale, { timeZone: "UTC", ...(options ?? {}) }).format(date);
};

export const getUTCDateKey = (value: DateLike) => {
  const date = normalizeDate(value);
  if (!date) return null;
  return date.toISOString().slice(0, 10);
};

export const dateFromKeyUTC = (key: string) => {
  if (!ISO_DATE_PATTERN.test(key)) return null;
  return new Date(`${key}T00:00:00Z`);
};
