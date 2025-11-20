"use client"

import * as React from "react"
import * as Icons from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { Progress } from "@/components/ui/progress"
import type { CategorySummaryItem, Currency } from "@/lib/types"

export type BreakdownMode = 'linear' | 'log';

type Props = {
  data: CategorySummaryItem[];
  total: number;
  mainCurrency: Currency;
  childrenMap?: Record<string, CategorySummaryItem[]>;
  onSelectCategory?: (categoryId: string | null, categoryName: string) => void;
  displayMode?: BreakdownMode;
};

export function CategoryBreakdownChart({
  data,
  total,
  mainCurrency,
  childrenMap,
  onSelectCategory,
  displayMode = 'linear',
}: Props) {
  const currencyFormatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: mainCurrency,
  });
  const computeShare = React.useCallback(
    (value: number, base: number) => {
      if (base <= 0 || value <= 0) return 0;
      if (displayMode === "log") {
        const numerator = Math.log(value + 1);
        const denominator = Math.log(base + 1);
        return denominator > 0 ? (numerator / denominator) * 100 : 0;
      }
      return (value / base) * 100;
    },
    [displayMode],
  );

  const getWeight = React.useCallback(
    (value: number) => {
      if (value <= 0) return 0;
      return displayMode === "log" ? Math.log(value + 1) : value;
    },
    [displayMode],
  );

  if (!data.length || total <= 0) {
    return (
      <div className="flex h-40 items-center justify-center text-muted-foreground">
        No expense data to display.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {data.map((item) => {
        const IconComponent = (Icons[item.icon as keyof typeof Icons] ?? Icons.MoreHorizontal) as LucideIcon;
        const percentage = total > 0 ? (item.total / total) * 100 : 0;
        const childItems =
          item.categoryId && childrenMap?.[item.categoryId]
            ? [...childrenMap[item.categoryId]].sort((a, b) => b.total - a.total)
            : [];
        const barShare = computeShare(item.total, total);
        const renderProgress = () => {
          if (childItems.length === 0) {
            return (
              <div className="relative h-4">
                <Progress
                  value={barShare}
                  className="absolute top-1/2 h-2 w-full -translate-y-1/2"
                  style={{ "--indicator-color": item.color ?? "var(--primary)" } as React.CSSProperties}
                />
                <span
                  className="absolute text-xs font-semibold text-muted-foreground"
                  style={{
                    left: `calc(${Math.min(barShare, 95)}% + 4px)` ,
                    top: "50%",
                    transform: "translateY(-50%)",
                  }}
                >
                  {percentage.toFixed(0)}%
                </span>
              </div>
            );
          }
          const childrenTotal = childItems.reduce((sum, child) => sum + child.total, 0);
          const parentOwnTotal = Math.max(item.total - childrenTotal, 0);
          const parentShare = barShare;
          const segments = childItems
            .map((segment, index) => ({
              key: segment.categoryId ?? `${item.categoryId}-${index}`,
              color: segment.color ?? item.color ?? "var(--primary)",
              total: Math.max(segment.total, 0),
            }))
            .filter((segment) => segment.total > 0);
          if (parentOwnTotal > 0) {
            segments.push({
              key: `${item.categoryId ?? item.name}-own`,
              color: item.color ?? "var(--primary)",
              total: parentOwnTotal,
            });
          }
          const totalWeight = segments.reduce((sum, segment) => sum + getWeight(segment.total), 0);
          if (!segments.length || totalWeight <= 0 || parentShare <= 0) {
            return (
              <div className="relative h-4">
                <Progress
                  value={parentShare}
                  className="absolute top-1/2 h-2 w-full -translate-y-1/2"
                  style={{ "--indicator-color": item.color ?? "var(--primary)" } as React.CSSProperties}
                />
                <span
                  className="absolute text-xs font-semibold text-muted-foreground"
                  style={{
                    left: `calc(${Math.min(parentShare, 95)}% + 4px)`,
                    top: "50%",
                    transform: "translateY(-50%)",
                  }}
                >
                  {percentage.toFixed(0)}%
                </span>
              </div>
            );
          }
          let offset = 0;
          return (
            <div className="relative h-4">
              <div className="absolute top-1/2 h-2 w-full -translate-y-1/2 rounded-full bg-muted" />
              {segments.map((segment) => {
                const weight = getWeight(segment.total);
                if (weight <= 0 || totalWeight <= 0 || parentShare <= 0) return null;
                const width = (weight / totalWeight) * parentShare;
                if (width <= 0) return null;
                const element = (
                  <span
                    key={segment.key}
                    className="absolute top-1/2 h-2 -translate-y-1/2 rounded-none"
                    style={{
                      left: `${offset}%`,
                      width: `${width}%`,
                      backgroundColor: segment.color,
                    }}
                  />
                );
                offset += width;
                return element;
              })}
              {offset < parentShare && parentShare > 0 && totalWeight > 0 && (
                <span
                  className="absolute top-1/2 h-2 -translate-y-1/2 rounded-none"
                  style={{
                    left: `${offset}%`,
                    width: `${Math.max(parentShare - offset, 0)}%`,
                    backgroundColor: item.color ?? "var(--primary)",
                  }}
                />
              )}
              <span
                className="absolute text-xs font-semibold text-muted-foreground"
                style={{
                  left: `calc(${Math.min(parentShare, 95)}% + 4px)` ,
                  top: "50%",
                  transform: "translateY(-50%)",
                }}
              >
                {percentage.toFixed(0)}%
              </span>
            </div>
          );
        };
        return (
          <div key={item.categoryId ?? item.name} className="space-y-1">
            <button
              className="w-full space-y-1 text-left"
              onClick={() => {
                if (!onSelectCategory) return;
                const categoryId = item.categoryId && item.categoryId !== 'other' ? item.categoryId : null;
                onSelectCategory(categoryId, item.name);
              }}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <IconComponent className="h-4 w-4" style={{ color: item.color ?? "currentColor" }} />
                  <span className="font-medium">{item.name}</span>
                </div>
                <span className="font-semibold">{currencyFormatter.format(item.total)}</span>
              </div>
              {renderProgress()}
            </button>
            {childItems.length > 0 && (
              <div className="space-y-1 pl-6 text-sm text-muted-foreground">
                {childItems.map((child) => {
                  const childPercentage = total > 0 ? (child.total / total) * 100 : 0;
                  const ChildIcon =
                    (Icons[child.icon as keyof typeof Icons] ?? Icons.MoreHorizontal) as LucideIcon;
                  const childIconColor = child.color ?? item.color ?? "currentColor";
                  return (
                    <button
                      key={child.categoryId ?? `${item.name}-${child.name}`}
                      className="flex w-full items-center justify-between gap-2 text-left hover:text-foreground"
                      onClick={() => onSelectCategory?.(child.categoryId ?? null, child.name)}
                    >
                      <span className="flex items-center gap-2 truncate">
                        <ChildIcon className="h-3.5 w-3.5" style={{ color: childIconColor }} />
                        <span className="truncate">{child.name}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        <span>{currencyFormatter.format(child.total)}</span>
                        <span className="text-xs">{childPercentage.toFixed(1)}%</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
