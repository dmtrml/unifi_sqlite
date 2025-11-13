

"use client"

import * as React from "react"
import { Loader2, Check, Import, BadgeHelp, LinkIcon } from "lucide-react"
import Link from "next/link"

import AppLayout from "@/components/layout"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useUser } from "@/lib/auth-context"
import { useAccounts } from "@/hooks/use-accounts"
import { useCategories } from "@/hooks/use-categories"
import { useUserProfile } from "@/hooks/use-user-profile"
import { getMercadoPagoTransactions, type SimplifiedTransaction } from "./actions"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Account, Category } from "@/lib/types"
import type { ImportSummary, NormalizedImportRow } from "@/lib/imports"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";


type ImportResult = ImportSummary;

function MercadoPagoPageContent() {
  const [step, setStep] = React.useState(1);
  const [transactions, setTransactions] = React.useState<SimplifiedTransaction[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isImporting, setIsImporting] = React.useState(false);
  const [importResult, setImportResult] = React.useState<ImportResult | null>(null);
  const [selectedAccountId, setSelectedAccountId] = React.useState<string | null>(null);
  const [rawApiResponses, setRawApiResponses] = React.useState<any[]>([]);

  const { user } = useUser();
  const { toast } = useToast();
  const { profile } = useUserProfile();

  const { accounts, refresh: refreshAccounts } = useAccounts();
  const { categories } = useCategories();
  
  const resetState = () => {
    setStep(1);
    setTransactions([]);
    setError(null);
    setIsLoading(false);
    setIsImporting(false);
    setImportResult(null);
    setSelectedAccountId(null);
    setRawApiResponses([]);
  };

  const handleFetchTransactions = async () => {
    if (!user) {
      toast({
        variant: "destructive",
        title: "пїЅпїЅ?пїЅпїЅпїЅпїЅ?пїЅ?пїЅШђпїЅ' пїЅпїЅ?пїЅпїЅпїЅ?пїЅ?пїЅ'пїЅпїЅ",
        description: "пїЅ?пїЅпїЅ пїЅ?пїЅ?пїЅпїЅпїЅ>пїЅ?пїЅ? пїЅ?пїЅ?пїЅпїЅпїЅ' пїЅ?пїЅ>пїЅ? пїЅпїЅ?пїЅпїЅпїЅ?пїЅ?пїЅ'пїЅпїЅ.",
      });
      return;
    }

    setIsLoading(true);
    setRawApiResponses([]);
    setTransactions([]);
    setError(null);
    const result = await getMercadoPagoTransactions(user.uid);

    setRawApiResponses((result.rawData ?? []) as any[]);
    if (result.success) {
      const imported = result.data ?? [];
      setTransactions(imported);
      if (imported.length > 0) setStep(2);
      else toast({ title: "РќРµС‚ РЅРѕРІС‹С… С‚СЂР°РЅР·Р°РєС†РёР№", description: "РќРµ РЅР°Р№РґРµРЅРѕ С‚СЂР°РЅР·Р°РєС†РёР№ РґР»СЏ РёРјРїРѕСЂС‚Р°."})
    } else {
      setError(result.error ?? "Не удалось загрузить операции.");
      setTransactions([]);
    }
    
    setIsLoading(false);
  };

  const findCategoryId = React.useCallback(
    (name: string) => {
      const list = categories ?? [];
      const category = list.find((c) => c.name.toLowerCase() === name.toLowerCase());
      return category ? category.id : null;
    },
    [categories],
  );

  const handleImport = async () => {
    if (!user || !selectedAccountId) {
      toast({
        variant: "destructive",
        title: "�?�?��+���",
        description: "�'�<�+��?��'�� �?�ؐ�' �?�>�? ��?���?�?�'��.",
      });
      return;
    }

    const approvedTransactions = transactions.filter(
      (t) => t.status === 'approved' && (t.type === 'income' || t.type === 'expense' || t.type === 'funding'),
    );

    if (!approvedTransactions.length) {
      toast({ title: "���?�?�?�? ���?���", description: "��?�?���>�?�?�? ���?���?�?�'��." });
      return;
    }

    setIsImporting(true);
    setStep(3);

    const normalizedRows: NormalizedImportRow[] = [];
    let skippedRows = 0;

    for (const tx of approvedTransactions) {
      try {
        let transactionType: 'income' | 'expense' | null = null;
        let amount = 0;

        if (tx.type === 'expense') {
          transactionType = 'expense';
          amount = tx.total_paid_amount;
        } else if (tx.type === 'income' || tx.type === 'funding') {
          transactionType = 'income';
          amount = tx.net_amount;
        }

        if (!transactionType || amount <= 0) {
          skippedRows++;
          continue;
        }

        const dateValue = new Date(tx.date).getTime();
        if (!Number.isFinite(dateValue)) {
          skippedRows++;
          continue;
        }

        const categoryId = tx.description ? findCategoryId(tx.description) : null;

        normalizedRows.push({
          transactionType,
          date: dateValue,
          description: `${tx.description} (MP)`,
          amount: Math.abs(amount),
          accountId: selectedAccountId,
          categoryId,
        });
      } catch (rowError) {
        console.error('Skipping Mercado Pago row', rowError);
        skippedRows++;
      }
    }

    if (!normalizedRows.length) {
      setImportResult({ successCount: 0, errorCount: skippedRows, newCategories: 0, newAccounts: 0 });
      toast({ variant: "destructive", title: "�?�?��+���", description: "�?�� �������?�?�' ���?�?�?�? �������." });
      setIsImporting(false);
      return;
    }

    try {
      const response = await fetch('/api/imports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-uid': user.uid,
        },
        body: JSON.stringify({
          source: 'mercado-pago',
          defaultCurrency: profile?.mainCurrency ?? 'USD',
          rows: normalizedRows,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.message ?? 'Failed to import transactions.');
      }

      const summary = (await response.json()) as ImportSummary;
      const combined: ImportResult = {
        successCount: summary.successCount,
        errorCount: summary.errorCount + skippedRows,
        newCategories: summary.newCategories,
        newAccounts: summary.newAccounts,
      };

      setImportResult(combined);
      toast({ title: "Import complete", description: `Imported ${combined.successCount} transactions.` });
      refreshAccounts();
    } catch (importError) {
      console.error('Mercado Pago import failed', importError);
      setError("�?�?�?����?�?�>�� ��?��'��ؐ�?����? �?�?��+���.");
      toast({
        variant: "destructive",
        title: "�?�?��+���",
        description: importError instanceof Error ? importError.message : 'Unexpected error during import.',
      });
      setImportResult({ successCount: 0, errorCount: skippedRows, newCategories: 0, newAccounts: 0 });
    } finally {
      setIsImporting(false);
    }
  };
  const getOperationTypeBadge = (type: SimplifiedTransaction['type'], operationType: string) => {
    switch (type) {
        case 'income': return <Badge variant="default">Income</Badge>;
        case 'expense': return <Badge variant="destructive">Expense</Badge>;
        case 'transfer': return <Badge variant="secondary">Transfer</Badge>;
        case 'funding': return <Badge style={{backgroundColor: 'hsl(var(--chart-3))', color: 'white'}}>Funding</Badge>;
        default: return <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Badge variant="outline"><BadgeHelp className="h-4 w-4"/></Badge>
                </TooltipTrigger>
                <TooltipContent>
                    <p>Unknown Operation: {operationType}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    }
  }
  
  const isConnected = Boolean(profile?.mercadoPagoConnected);
  const authUrl = `https://auth.mercadopago.com/authorization?client_id=${process.env.NEXT_PUBLIC_MERCADO_PAGO_CLIENT_ID}&response_type=code&platform_id=mp&state=YOUR_STATE&redirect_uri=http://localhost:9002/mercado-pago/callback`;


  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <Card>
            <CardHeader>
              <CardTitle>РЁР°Рі 1: РџРѕРґРєР»СЋС‡РµРЅРёРµ Рё Р·Р°РіСЂСѓР·РєР°</CardTitle>
              <CardDescription>РџРѕРґРєР»СЋС‡РёС‚Рµ СЃРІРѕР№ Р°РєРєР°СѓРЅС‚ Mercado Pago РґР»СЏ Р·Р°РіСЂСѓР·РєРё С‚СЂР°РЅР·Р°РєС†РёР№.</CardDescription>
            </CardHeader>
            <CardContent>
              {error && (
                  <Alert variant="destructive" className="mt-4">
                      <AlertTitle>РћС€РёР±РєР°</AlertTitle>
                      <AlertDescription>{error}</AlertDescription>
                  </Alert>
              )}
            </CardContent>
            <CardFooter>
             {isConnected ? (
                <Button onClick={handleFetchTransactions} disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Р—Р°РіСЂСѓР·РёС‚СЊ С‚СЂР°РЅР·Р°РєС†РёРё
                </Button>
             ) : (
                <Button asChild>
                    <Link href={authUrl}>
                        <LinkIcon className="mr-2 h-4 w-4" />
                        РџРѕРґРєР»СЋС‡РёС‚СЊ Mercado Pago
                    </Link>
                </Button>
             )}
            </CardFooter>
          </Card>
        );
      case 2:
        return (
          <Card>
            <CardHeader>
              <CardTitle>РЁР°Рі 2: РџСЂРѕРІРµСЂРєР° Рё РёРјРїРѕСЂС‚</CardTitle>
              <CardDescription>РџСЂРѕРІРµСЂСЊС‚Рµ С‚СЂР°РЅР·Р°РєС†РёРё Рё РІС‹Р±РµСЂРёС‚Рµ СЃС‡РµС‚ РґР»СЏ РёРјРїРѕСЂС‚Р°. Р‘СѓРґСѓС‚ РёРјРїРѕСЂС‚РёСЂРѕРІР°РЅС‹ С‚РѕР»СЊРєРѕ РѕРґРѕР±СЂРµРЅРЅС‹Рµ (approved) РґРѕС…РѕРґС‹ Рё СЂР°СЃС…РѕРґС‹.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {error && (
                  <Alert variant="destructive" className="mt-4">
                      <AlertTitle>РћС€РёР±РєР°</AlertTitle>
                      <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <div className="flex items-center gap-4">
                    <p>РРјРїРѕСЂС‚РёСЂРѕРІР°С‚СЊ РІ СЃС‡РµС‚:</p>
                    <Select onValueChange={setSelectedAccountId} value={selectedAccountId || ""}>
                        <SelectTrigger className="w-[280px]">
                            <SelectValue placeholder="Р’С‹Р±РµСЂРёС‚Рµ СЃС‡РµС‚..." />
                        </SelectTrigger>
                        <SelectContent>
                            {accounts?.map(acc => (
                                <SelectItem key={acc.id} value={acc.id}>
                                    {acc.name} ({acc.currency})
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="relative w-full overflow-auto max-h-[50vh]">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Р”Р°С‚Р°</TableHead>
                                <TableHead>РћРїРёСЃР°РЅРёРµ</TableHead>
                                <TableHead>РўРёРї</TableHead>
                                <TableHead className="text-right">РЎСѓРјРјР°</TableHead>
                                <TableHead className="text-right">РЎРєРёРґРєР°</TableHead>
                                <TableHead className="text-right">РћРїР»Р°С‡РµРЅРѕ</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {transactions.map(tx => (
                                <TableRow key={tx.id}>
                                    <TableCell>{new Date(tx.date).toLocaleDateString()}</TableCell>
                                    <TableCell>{tx.description}</TableCell>
                                    <TableCell>{getOperationTypeBadge(tx.type, tx.operation_type)}</TableCell>
                                    <TableCell className="text-right">
                                        {new Intl.NumberFormat('ru-RU', { style: 'currency', currency: tx.currency }).format(tx.gross_amount)}
                                    </TableCell>
                                    <TableCell className="text-right text-green-600">
                                        -{new Intl.NumberFormat('ru-RU', { style: 'currency', currency: tx.currency }).format(tx.coupon_amount)}
                                    </TableCell>
                                    <TableCell className="text-right font-semibold">
                                        {new Intl.NumberFormat('ru-RU', { style: 'currency', currency: tx.currency }).format(tx.total_paid_amount)}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
                 {rawApiResponses.length > 0 && (
                    <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="item-1">
                            <AccordionTrigger>РџРѕРєР°Р·Р°С‚СЊ СЃС‹СЂС‹Рµ РґР°РЅРЅС‹Рµ API</AccordionTrigger>
                            <AccordionContent>
                                <pre className="mt-2 w-full overflow-x-auto rounded-md bg-muted p-4 text-sm max-h-96">
                                    <code>{JSON.stringify(rawApiResponses, null, 2)}</code>
                                </pre>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                )}
            </CardContent>
            <CardFooter className="justify-end gap-2">
                <Button variant="outline" onClick={resetState}>РќР°Р·Р°Рґ</Button>
                <Button onClick={handleImport} disabled={!selectedAccountId || isImporting}>
                    {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Import className="mr-2 h-4 w-4" />}
                    РРјРїРѕСЂС‚РёСЂРѕРІР°С‚СЊ
                </Button>
            </CardFooter>
          </Card>
        );
      case 3:
        return (
          <Card>
             <CardHeader>
                <CardTitle>РЁР°Рі 3: Р РµР·СѓР»СЊС‚Р°С‚С‹ РёРјРїРѕСЂС‚Р°</CardTitle>
             </CardHeader>
             <CardContent>
               <div className="py-4 text-center">
                  {isImporting ? (
                      <div className="flex flex-col items-center gap-4">
                          <Loader2 className="h-12 w-12 animate-spin text-primary" />
                          <h3 className="text-lg font-semibold">РРјРїРѕСЂС‚РёСЂСѓРµРј...</h3>
                          <p className="text-muted-foreground">РџРѕР¶Р°Р»СѓР№СЃС‚Р°, РїРѕРґРѕР¶РґРёС‚Рµ.</p>
                      </div>
                  ) : importResult ? (
                      <div className="space-y-4">
                          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/50">
                             <Check className="h-6 w-6 text-green-600 dark:text-green-400" />
                          </div>
                          <h3 className="text-lg font-semibold">РРјРїРѕСЂС‚ Р·Р°РІРµСЂС€РµРЅ</h3>
                          <p>РЈСЃРїРµС€РЅРѕ РёРјРїРѕСЂС‚РёСЂРѕРІР°РЅРѕ: {importResult.successCount} С‚СЂР°РЅР·Р°РєС†РёР№.</p>
                      </div>
                  ) : error ? (
                      <Alert variant="destructive">
                          <AlertTitle>РРјРїРѕСЂС‚ РЅРµ СѓРґР°Р»СЃСЏ</AlertTitle>
                          <AlertDescription>{error}</AlertDescription>
                      </Alert>
                  ) : null}
              </div>
             </CardContent>
              <CardFooter className="justify-end">
                <Button type="button" onClick={resetState}>
                  РќР°С‡Р°С‚СЊ РЅРѕРІС‹Р№ РёРјРїРѕСЂС‚
                </Button>
              </CardFooter>
          </Card>
        );
    }
  };

  return (
    <AppLayout>
      <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
        <div className="flex items-center">
          <h1 className="text-lg font-semibold md:text-2xl">РРЅС‚РµРіСЂР°С†РёСЏ СЃ Mercado Pago</h1>
        </div>
        {renderStepContent()}
      </main>
    </AppLayout>
  )
}

export default MercadoPagoPageContent;

    

    







