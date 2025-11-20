import * as Icons from "lucide-react"
import type { LucideIcon } from "lucide-react"

const iconComponents = Icons as unknown as Record<string, LucideIcon>;

const typeIconMap: Record<string, keyof typeof Icons> = {
  cash: "Wallet",
  card: "CreditCard",
  credit_card: "CreditCard",
  deposit: "PiggyBank",
  savings: "PiggyBank",
  loan: "HandCoins",
  debt: "HandCoins",
  "bank account": "Landmark",
  bank_account: "Landmark",
};

export function getAccountTypeIcon(type?: string, fallback?: string): LucideIcon {
  const normalized = type?.trim().toLowerCase().replace(/\s+/g, "_") ?? "";
  const fallbackIcon =
    fallback && typeof fallback === "string" && fallback in Icons
      ? (fallback as keyof typeof Icons)
      : undefined;
  const iconName = typeIconMap[normalized] ?? fallbackIcon ?? "Wallet";
  return iconComponents[iconName] ?? iconComponents.Wallet;
}
