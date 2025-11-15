"use client"

import * as React from "react"
import * as Icons from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { Progress } from "@/components/ui/progress"
import type { CategorySummaryItem, Currency } from "@/lib/types"

type Props = {
  data: CategorySummaryItem[];
  total: number;
  mainCurrency: Currency;
  childrenMap?: Record<string, CategorySummaryItem[]>;
  onSelectCategory?: (categoryId: string | null, categoryName: string) => void;
};

export function CategoryBreakdownChart({
  data,
  total,
  mainCurrency,
  childrenMap,
  onSelectCategory,
}: Props) {
  const currencyFormatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: mainCurrency,
  });

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
        const renderProgress = () => {
          if (childItems.length === 0) {
            return (
              <div className="relative h-4">
                <Progress
                  value={percentage}
                  className="absolute top-1/2 h-2 w-full -translate-y-1/2"
                  style={{ "--indicator-color": item.color ?? "var(--primary)" } as React.CSSProperties}
                />
                <span
                  className="absolute text-xs font-semibold text-muted-foreground"
                  style={{
                    left: `calc(${Math.min(percentage, 95)}% + 4px)` ,
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
          const parentShare = percentage;
          let offset = 0;
          return (
            <div className="relative h-4">
              <div className="absolute top-1/2 h-2 w-full -translate-y-1/2 rounded-full bg-muted" />
              {childItems.map((segment, index) => {
                const share = total > 0 ? (segment.total / total) * 100 : 0;
                const bar = (
                  <span
                    key={segment.categoryId ?? `${item.categoryId}-${index}`}
                    className="absolute top-1/2 h-2 -translate-y-1/2 rounded-none"
                    style={{
                      left: `${offset}%`,
                      width: `${share}%`,
                      backgroundColor: segment.color ?? item.color ?? "var(--primary)",
                    }}
                  />
                );
                offset += share;
                return bar;
              })}
              {parentOwnTotal > 0 && (
                <span
                  className="absolute top-1/2 h-2 -translate-y-1/2 rounded-none"
                  style={{
                    left: `${offset}%`,
                    width: `${total > 0 ? (parentOwnTotal / total) * 100 : 0}%`,
                    backgroundColor: item.color ?? "var(--primary)",
                  }}
                />
              )}
              {offset < parentShare && (
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
                  left: `calc(${Math.min(percentage, 95)}% + 4px)` ,
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
                  return (
                    <button
                      key={child.categoryId ?? `${item.name}-${child.name}`}
                      className="flex w-full items-center justify-between gap-2 text-left hover:text-foreground"
                      onClick={() => onSelectCategory?.(child.categoryId ?? null, child.name)}
                    >
                      <span className="flex items-center gap-2 truncate">
                        <ChildIcon className="h-3.5 w-3.5" style={{ color: child.color ?? item.color }} />
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
