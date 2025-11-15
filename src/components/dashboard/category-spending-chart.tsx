"use client"

import * as React from "react"
import { Pie, PieChart, Sector, Cell } from "recharts"
import * as Icons from "lucide-react"

import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import type { CategorySummaryItem, Currency } from "@/lib/types"

const RADIAN = Math.PI / 180;
const CustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, payload }: any) => {
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  const IconComponent = (Icons as any)[payload.icon] || Icons.MoreHorizontal;

  return (
    <g>
      <IconComponent x={x - 12} y={y - 12} width={24} height={24} color="white" strokeWidth={1.5} />
    </g>
  );
};

type ChartDatum = CategorySummaryItem & { children?: CategorySummaryItem[] };

type Props = {
  data: CategorySummaryItem[];
  total: number;
  mainCurrency: Currency;
  childrenMap?: Record<string, CategorySummaryItem[]>;
  onSelectCategory?: (categoryId: string | null, categoryName: string) => void;
};

export function CategorySpendingChart({
  data,
  total,
  mainCurrency,
  childrenMap,
  onSelectCategory,
}: Props) {
  const [activeCategory, setActiveCategory] = React.useState<string | null>(null);
  const id = "pie-interactive";

  const displayData = React.useMemo(() => {
    if (!data.length) return [];
    const entries: ChartDatum[] = data.map((item) => ({
      ...item,
      children: item.categoryId ? childrenMap?.[item.categoryId] : undefined,
    }));
    const threshold = total * 0.03;

    const major = entries.filter((item) => item.total >= threshold);
    const minor = entries.filter((item) => item.total < threshold);

    if (minor.length > 1) {
      const otherTotal = minor.reduce((sum, item) => sum + item.total, 0);
      major.push({
        categoryId: "other",
        name: "Other",
        color: "hsl(var(--muted-foreground))",
        icon: "MoreHorizontal",
        total: otherTotal,
        children: undefined,
      });
    } else {
      major.push(...minor);
    }

    return major.sort((a, b) => b.total - a.total);
  }, [data, total, childrenMap]);

  const chartConfig = React.useMemo(() => {
    return displayData.reduce((acc, item) => {
      acc[item.name] = {
        label: item.name,
        color: item.color ?? "hsl(var(--primary))",
      };
      return acc;
    }, {} as ChartConfig);
  }, [displayData]);

  const activeIndex = React.useMemo(
    () => displayData.findIndex((item) => item.name === activeCategory),
    [activeCategory, displayData],
  );

  const currencyFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: mainCurrency });

  if (!displayData.length || total <= 0) {
    return (
      <div className="flex h-[250px] items-center justify-center text-muted-foreground">
        No spending data available for this period.
      </div>
    );
  }

  return (
    <ChartContainer config={chartConfig} id={id} className="mx-auto aspect-square h-full w-full">
      <PieChart>
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              formatter={(value, name, item, _index, rawPayload) => {
                const percentage = total > 0 ? ((value as number) / total) * 100 : 0;
                const chartItem = (rawPayload as ChartDatum | undefined) ?? (item?.payload as ChartDatum | undefined);
                const childList = chartItem?.children ?? [];
                const parentTotal = chartItem?.total ?? (value as number);
                return (
                  <div className="space-y-1.5">
                    <div className="font-medium text-foreground">{name}</div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-lg font-bold">{currencyFormatter.format(value as number)}</span>
                      <span className="text-sm text-muted-foreground">({percentage.toFixed(2)}%)</span>
                    </div>
                    {childList.length > 0 && (
                      <div className="mt-1 space-y-0.5 border-t border-border/60 pt-1 text-muted-foreground">
                        {childList.slice(0, 4).map((child) => {
                          const childShareOfParent =
                            parentTotal && parentTotal > 0
                              ? ((child.total / parentTotal) * 100).toFixed(1)
                              : "0";
                          const childShareOfTotal =
                            total > 0 ? ((child.total / total) * 100).toFixed(2) : "0";
                          return (
                            <div
                              key={child.categoryId ?? child.name}
                              className="flex items-center justify-between gap-2 text-xs"
                            >
                              <span className="truncate">↳ {child.name}</span>
                              <span>
                                {currencyFormatter.format(child.total)} ({childShareOfTotal}% total / {childShareOfParent}% parent)
                              </span>
                            </div>
                          );
                        })}
                        {childList.length > 4 && (
                          <div className="text-[11px] italic text-muted-foreground">
                            +{childList.length - 4} more
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              }}
            />
          }
        />
        <text
          x="50%"
          y="45%"
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-muted-foreground text-sm"
        >
          Total Spent
        </text>
        <text
          x="50%"
          y="55%"
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-foreground text-2xl font-bold"
        >
          {currencyFormatter.format(total)}
        </text>
        <Pie
          data={displayData}
          dataKey="total"
          nameKey="name"
          innerRadius="65%"
          outerRadius="85%"
          strokeWidth={5}
          labelLine={false}
          label={<CustomLabel />}
          activeIndex={activeIndex}
          activeShape={({ outerRadius = 0, ...props }) => (
            <g>
              <Sector {...props} outerRadius={outerRadius + 10} />
            </g>
          )}
          onMouseOver={(_, index) => {
            setActiveCategory(displayData[index].name);
          }}
          onMouseLeave={() => {
            setActiveCategory(null);
          }}
          onClick={(_, index) => {
                if (!onSelectCategory) return;
            const entry = displayData[index];
            if (!entry || entry.categoryId === 'other') return;
            const categoryId = entry.categoryId ?? null;
            onSelectCategory(categoryId, entry.name);
          }}
        >
          {displayData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color ?? "hsl(var(--primary))"} />
          ))}
        </Pie>
      </PieChart>
    </ChartContainer>
  );
}
