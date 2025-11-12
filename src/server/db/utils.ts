export const toCents = (value: number): number =>
  Math.round(Number.isFinite(value) ? value * 100 : 0);

export const fromCents = (value: number | null | undefined): number =>
  typeof value === 'number' ? value / 100 : 0;

export const toEpochMs = (value: Date | number): number =>
  typeof value === 'number' ? value : value.getTime();

export const nowMs = (): number => Date.now();

export type PaginatedResult<T> = {
  items: T[];
  nextCursor: number | null;
  hasMore: boolean;
};
