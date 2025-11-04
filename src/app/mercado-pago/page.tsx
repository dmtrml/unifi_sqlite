

"use client"

import * as React from "react"
import { collection, writeBatch, doc } from "firebase/firestore"
import { Loader2, Check, Import, BadgeHelp, LinkIcon } from "lucide-react"
import { z } from 'zod';
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
import { useFirestore, useUser, useCollection, useMemoFirebase, useDoc } from "@/firebase"
import { getMercadoPagoTransactions } from "./actions"
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
import type { Account, Category, User } from "@/lib/types"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";


export const SimplifiedTransactionSchema = z.object({
  id: z.string(),
  date: z.string(),
  description: z.string(),
  gross_amount: z.number(),
  coupon_amount: z.number().default(0),
  total_paid_amount: z.number(),
  fees: z.number(),
  net_amount: z.number(),
  currency: z.string(),
  type: z.enum(['income', 'expense', 'transfer', 'funding', 'unknown']),
  status: z.string(),
  operation_type: z.string(),
  payer: z.string(),
});

export type SimplifiedTransaction = z.infer<typeof SimplifiedTransactionSchema>;

interface ImportResult {
    successCount: number;
    errorCount: number;
}

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
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const userDocRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
  const { data: userData } = useDoc<User>(userDocRef);

  const accountsQuery = useMemoFirebase(() =>
    user ? collection(firestore, "users", user.uid, "accounts") : null,
    [user, firestore]
  );
  const { data: accounts } = useCollection<Account>(accountsQuery);
  
  const categoriesQuery = useMemoFirebase(() =>
    user ? collection(firestore, "users", user.uid, "categories") : null,
    [user, firestore]
  );
  const { data: categories } = useCollection<Category>(categoriesQuery);
  
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
    setIsLoading(true);
    setRawApiResponses([]);
    setTransactions([]);
    setError(null);
    const result = await getMercadoPagoTransactions();

    if (result.rawData) {
        setRawApiResponses(result.rawData);
    }
    
    if (result.success) {
      setTransactions(result.data);
      if (result.data.length > 0) setStep(2);
      else toast({ title: "Нет новых транзакций", description: "Не найдено транзакций для импорта."})
    } else {
      setError(result.error);
    }
    
    setIsLoading(false);
  };

  const findCategory = (name: string, localCategories: Category[]): string | null => {
    const category = localCategories.find(c => c.name.toLowerCase() === name.toLowerCase());
    return category ? category.id : null;
  };

  const handleImport = async () => {
    if (!user || !firestore || !selectedAccountId || !accounts || !categories) {
        toast({ title: "Ошибка", description: "Выберите счет для импорта.", variant: "destructive" });
        return;
    }

    setIsImporting(true);
    setStep(3);
    const BATCH_SIZE = 450;
    const finalResult: ImportResult = { successCount: 0, errorCount: 0 };
    
    const approvedTransactions = transactions.filter(t => t.status === 'approved' && (t.type === 'income' || t.type === 'expense' || t.type === 'funding'));

    try {
        let totalAmountToUpdate = 0;
        const localCategories = [...categories];

        for (let i = 0; i < approvedTransactions.length; i += BATCH_SIZE) {
            const batch = writeBatch(firestore);
            const chunk = approvedTransactions.slice(i, i + BATCH_SIZE);

            for (const tx of chunk) {
                let transactionType: 'income' | 'expense' | null = null;
                let amount = 0;
                
                if (tx.type === 'expense') {
                    transactionType = 'expense';
                    amount = tx.total_paid_amount;
                } else if (tx.type === 'funding' || tx.type === 'income') {
                    transactionType = 'income';
                    amount = tx.net_amount;
                }

                if (!transactionType) continue;

                const categoryId = findCategory(tx.description, localCategories);
                
                const transactionData = {
                    userId: user.uid,
                    date: new Date(tx.date),
                    amount: amount,
                    description: `${tx.description} (MP)`,
                    transactionType: transactionType,
                    accountId: selectedAccountId,
                    categoryId: categoryId,
                    incomeType: transactionType === 'income' ? 'active' : null,
                    expenseType: transactionType === 'expense' ? 'optional' : null,
                    fromAccountId: null,
                    toAccountId: null,
                    amountSent: null,
                    amountReceived: null,
                };
                
                const newTransactionRef = doc(collection(firestore, `users/${user.uid}/transactions`));
                batch.set(newTransactionRef, transactionData);
                finalResult.successCount++;

                totalAmountToUpdate += (transactionType === 'income' ? amount : -amount);
            }
            await batch.commit();
        }

        const accountRef = doc(firestore, `users/${user.uid}/accounts/${selectedAccountId}`);
        const accountToUpdate = accounts.find(a => a.id === selectedAccountId);
        if (accountToUpdate) {
            const newBalance = accountToUpdate.balance + totalAmountToUpdate;
            const finalBatch = writeBatch(firestore);
            finalBatch.update(accountRef, { balance: newBalance });
            await finalBatch.commit();
        }

        setImportResult(finalResult);
        toast({ title: "Импорт завершен", description: `Обработано ${finalResult.successCount} транзакций.` });
    } catch (e) {
        console.error("Ошибка импорта:", e);
        setError("Произошла критическая ошибка во время сохранения данных.");
        toast({ title: "Ошибка импорта", description: "Не удалось сохранить транзакции.", variant: "destructive" });
        setImportResult(finalResult);
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
  
  const isConnected = !!userData?.mercadoPagoAccessToken;

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <Card>
            <CardHeader>
              <CardTitle>Шаг 1: Подключение и загрузка</CardTitle>
              <CardDescription>Подключите свой аккаунт Mercado Pago для загрузки транзакций.</CardDescription>
            </CardHeader>
            <CardContent>
              {error && (
                  <Alert variant="destructive" className="mt-4">
                      <AlertTitle>Ошибка</AlertTitle>
                      <AlertDescription>{error}</AlertDescription>
                  </Alert>
              )}
            </CardContent>
            <CardFooter>
             {isConnected ? (
                <Button onClick={handleFetchTransactions} disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Загрузить транзакции
                </Button>
             ) : (
                <Button asChild>
                    <Link href="https://auth.mercadopago.com/authorization?client_id=YOUR_CLIENT_ID&response_type=code&platform_id=mp&state=YOUR_STATE&redirect_uri=http://localhost:9002/mercado-pago/callback">
                        <LinkIcon className="mr-2 h-4 w-4" />
                        Подключить Mercado Pago
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
              <CardTitle>Шаг 2: Проверка и импорт</CardTitle>
              <CardDescription>Проверьте транзакции и выберите счет для импорта. Будут импортированы только одобренные (approved) доходы и расходы.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {error && (
                  <Alert variant="destructive" className="mt-4">
                      <AlertTitle>Ошибка</AlertTitle>
                      <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <div className="flex items-center gap-4">
                    <p>Импортировать в счет:</p>
                    <Select onValueChange={setSelectedAccountId} value={selectedAccountId || ""}>
                        <SelectTrigger className="w-[280px]">
                            <SelectValue placeholder="Выберите счет..." />
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
                                <TableHead>Дата</TableHead>
                                <TableHead>Описание</TableHead>
                                <TableHead>Тип</TableHead>
                                <TableHead className="text-right">Сумма</TableHead>
                                <TableHead className="text-right">Скидка</TableHead>
                                <TableHead className="text-right">Оплачено</TableHead>
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
                            <AccordionTrigger>Показать сырые данные API</AccordionTrigger>
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
                <Button variant="outline" onClick={resetState}>Назад</Button>
                <Button onClick={handleImport} disabled={!selectedAccountId || isImporting}>
                    {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Import className="mr-2 h-4 w-4" />}
                    Импортировать
                </Button>
            </CardFooter>
          </Card>
        );
      case 3:
        return (
          <Card>
             <CardHeader>
                <CardTitle>Шаг 3: Результаты импорта</CardTitle>
             </CardHeader>
             <CardContent>
               <div className="py-4 text-center">
                  {isImporting ? (
                      <div className="flex flex-col items-center gap-4">
                          <Loader2 className="h-12 w-12 animate-spin text-primary" />
                          <h3 className="text-lg font-semibold">Импортируем...</h3>
                          <p className="text-muted-foreground">Пожалуйста, подождите.</p>
                      </div>
                  ) : importResult ? (
                      <div className="space-y-4">
                          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/50">
                             <Check className="h-6 w-6 text-green-600 dark:text-green-400" />
                          </div>
                          <h3 className="text-lg font-semibold">Импорт завершен</h3>
                          <p>Успешно импортировано: {importResult.successCount} транзакций.</p>
                      </div>
                  ) : error ? (
                      <Alert variant="destructive">
                          <AlertTitle>Импорт не удался</AlertTitle>
                          <AlertDescription>{error}</AlertDescription>
                      </Alert>
                  ) : null}
              </div>
             </CardContent>
              <CardFooter className="justify-end">
                <Button type="button" onClick={resetState}>
                  Начать новый импорт
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
          <h1 className="text-lg font-semibold md:text-2xl">Интеграция с Mercado Pago</h1>
        </div>
        {renderStepContent()}
      </main>
    </AppLayout>
  )
}

export default MercadoPagoPageContent;

    

    