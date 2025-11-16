

"use client"

import * as React from "react"
import Link from "next/link"
import { useUser } from "@/lib/auth-context"
import { useUserProfile } from "@/hooks/use-user-profile"
import { useRouter } from "next/navigation"
import AppLayout from "@/components/layout"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import type { Currency } from "@/lib/types"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DeleteDataDialog } from "@/components/delete-data-dialog"
import { Upload } from "lucide-react"

const currencies: Currency[] = ["USD", "EUR", "JPY", "GBP", "CHF", "CAD", "AUD", "CNY", "INR", "ARS", "RUB"];

function SettingsPageContent() {
  const { user } = useUser()
  const { toast } = useToast()
  const { profile, saveProfile, isLoading: profileLoading } = useUserProfile()
  const router = useRouter()

  const [mainCurrency, setMainCurrency] = React.useState<Currency>("USD")
  const [exportingFormat, setExportingFormat] = React.useState<"csv" | "json" | null>(null)
  const [isBackingUp, setIsBackingUp] = React.useState(false)
  const [isRestoring, setIsRestoring] = React.useState(false)
  const restoreInputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (profile?.mainCurrency) {
      setMainCurrency(profile.mainCurrency)
    }
  }, [profile])

  const handleSaveSettings = async () => {
    if (!user) {
      toast({ title: "Error", description: "You must be logged in.", variant: "destructive" });
      return
    }

    try {
      await saveProfile({
        mainCurrency,
        email: user.email ?? profile?.email,
      })
      toast({
        title: "Settings Saved",
        description: "Your settings have been successfully updated.",
      })
    } catch (error) {
      console.error("Error updating settings: ", error)
      toast({
        title: "Error",
        description: "Failed to update settings.",
        variant: "destructive",
      })
    }
  }

  const parseFilename = (headerValue: string | null): string | null => {
    if (!headerValue) return null;
    const match = /filename="?([^";]+)"?/i.exec(headerValue);
    return match ? match[1] : null;
  };

  const handleExport = async (format: "csv" | "json") => {
    if (!user) {
      toast({ title: "Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }
    try {
      setExportingFormat(format);
      const response = await fetch(`/api/transactions/export?format=${format}`, {
        headers: {
          "x-uid": user.uid,
        },
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.message ?? "Failed to export transactions.");
      }
      const blob = await response.blob();
      const filename =
        parseFilename(response.headers.get("content-disposition")) ??
        `transactions.${format}`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({
        title: "Export ready",
        description: `Downloaded ${filename}`,
      });
    } catch (error) {
      console.error("Export failed", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to export transactions.",
        variant: "destructive",
      });
    } finally {
      setExportingFormat(null);
    }
  };

  const handleBackup = async () => {
    if (!user) {
      toast({ title: "Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }
    try {
      setIsBackingUp(true);
      const response = await fetch(`/api/backup`, {
        headers: {
          "x-uid": user.uid,
        },
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.message ?? "Failed to create backup.");
      }
      const blob = await response.blob();
      const filename =
        parseFilename(response.headers.get("content-disposition")) ??
        `backup-${new Date().toISOString().slice(0, 10)}.json`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({
        title: "Backup ready",
        description: `Downloaded ${filename}`,
      });
    } catch (error) {
      console.error("Backup failed", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create backup.",
        variant: "destructive",
      });
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestoreFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || isRestoring) {
      toast({ title: "Error", description: "You must be logged in.", variant: "destructive" });
      event.target.value = "";
      return;
    }
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      setIsRestoring(true);
      const text = await file.text();
      const response = await fetch("/api/backup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-uid": user.uid,
        },
        body: text,
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.message ?? "Failed to restore backup.");
      }
      const result = await response.json().catch(() => ({}));
      toast({
        title: "Backup restored",
        description:
          typeof result?.summary === "object"
            ? `Accounts: ${result.summary.accounts}, Transactions: ${result.summary.transactions}`
            : "Your data has been restored.",
      });
      router.refresh();
    } catch (error) {
      console.error("Restore failed", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to restore backup.",
        variant: "destructive",
      });
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
      <Card>
        <CardHeader>
          <CardTitle>Currency</CardTitle>
          <CardDescription>
            Set your main currency for reports and summaries.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="space-y-2">
                 <Label htmlFor="main-currency">Main Currency</Label>
                 <Select value={mainCurrency} onValueChange={(value) => setMainCurrency(value as Currency)}>
                    <SelectTrigger className="w-[180px]" id="main-currency">
                        <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                        {currencies.map(currency => (
                            <SelectItem key={currency} value={currency}>{currency}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </CardContent>
      </Card>
       <div className="flex justify-end">
          <Button onClick={handleSaveSettings} disabled={profileLoading}>
            {profileLoading ? "Loading..." : "Save Settings"}
          </Button>
        </div>

      <Card>
        <CardHeader>
          <CardTitle>Data Management</CardTitle>
          <CardDescription>
            Export your data or import new transactions.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={handleBackup}
            disabled={isBackingUp}
          >
            {isBackingUp ? "Creating backup..." : "Backup JSON"}
          </Button>
          <div className="text-xs text-muted-foreground w-full">
            Restoring a backup will replace all existing accounts, categories, budgets, transactions, and recurring templates.
          </div>
          <Button
            variant="outline"
            onClick={() => {
              if (!isRestoring) {
                restoreInputRef.current?.click();
              }
            }}
            disabled={isRestoring}
          >
            {isRestoring ? "Restoring..." : "Restore JSON"}
          </Button>
          <input
            ref={restoreInputRef}
            type="file"
            accept="application/json"
            onChange={handleRestoreFile}
            className="hidden"
          />
          <Button
            variant="outline"
            onClick={() => handleExport("csv")}
            disabled={exportingFormat === "csv"}
          >
            {exportingFormat === "csv" ? "Exporting..." : "Export CSV"}
          </Button>
          <Button
            variant="outline"
            onClick={() => handleExport("json")}
            disabled={exportingFormat === "json"}
          >
            {exportingFormat === "json" ? "Exporting..." : "Export JSON"}
          </Button>
          <Button variant="outline" asChild>
            <Link href="/import">
              <Upload className="mr-2 h-4 w-4" />
              Import Transactions
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Start Over</CardTitle>
          <CardDescription>
            Reset your application data. These actions are irreversible.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DeleteDataDialog />
        </CardContent>
      </Card>
    </main>
  )
}

export default function SettingsPage() {
  return (
    <AppLayout>
      <SettingsPageContent />
    </AppLayout>
  )
}
