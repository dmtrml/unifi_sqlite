"use client"

import * as React from "react"
import { collection, writeBatch, doc } from "firebase/firestore"
import { Loader2, Check, Info, Import } from "lucide-react"
import { z } from 'zod';

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
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase"
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
import type { Account, Category } from "@/lib/types"

/**
 * Определяет упрощенную структуру транзакции, которую мы будем использовать в приложении.
 */
export const SimplifiedTransactionSchema = z.object({
  id: z.string(), // ID должен быть строкой
  date: z.string(),
  description: z.string(),
  amount: z.number(),
  currency: z.string(),
  type: z.enum(['income', 'expense']),
  status: z.string(),
  payer: z.string(),
});

export type SimplifiedTransaction = z.infer<typeof SimplifiedTransactionSchema>;


interface ImportResult {
    successCount: number;
    errorCount: number;
}

function MercadoPagoPageContent() {
  const [step, setStep] = React.useState(1);
  const [accessToken, setAccessToken] = React.useState("");
  const [transactions, setTransactions] = React.useState<SimplifiedTransaction[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isImporting, setIsImporting] = React.useState(false);
  const [importResult, setImportResult] = React.useState<ImportResult | null>(null);
  const [selectedAccountId, setSelectedAccountId] = React.useState<string | null>(null);

  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

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
    setAccessToken("");
    setTransactions([]);
    setError(null);
    setIsLoading(false);
    setIsImporting(false);
    setImportResult(null);
    setSelectedAccountId(null);
  };

  const handleFetchTransactions = async () => {
    setIsLoading(true);
    setError(null);
    const result = await getMercadoPagoTransactions(accessToken);
    if (result.success) {
      setTransactions(result.data);
      setStep(2);
    } else {
      setError(result.error);
    }
    setIsLoading(false);
  };

  const getOrCreateCategory = (
      name: string,
      type: 'expense' | 'income',
      localCategories: Category[],
      batch: any
  ): string => {
      let category = localCategories.find(c => c.name.toLowerCase() === name.toLowerCase());
      if (category) {
          return category.id;
      }
      // Для простоты, создадим категорию, если ее нет
      const newCategoryData = {
          name: name,
          userId: user!.uid,
          icon: "MoreHorizontal",
          color: "hsl(var(--muted-foreground))",
          type: type,
      };
      const newCategoryRef = doc(collection(firestore!, `users/${user!.uid}/categories`));
      batch.set(newCategoryRef, newCategoryData);
      localCategories.push({ ...newCategoryData, id: newCategoryRef.id });
      return newCategoryRef.id;
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

    try {
        let totalAmountToUpdate = 0;
        const localCategories = [...categories];

        for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
            const batch = writeBatch(firestore);
            const chunk = transactions.slice(i, i + BATCH_SIZE);

            for (const tx of chunk) {
                const categoryId = getOrCreateCategory(tx.description, tx.type, localCategories, batch);
                
                const transactionData = {
                    userId: user.uid,
                    date: new Date(tx.date),
                    amount: tx.amount,
                    description: tx.description,
                    transactionType: tx.type,
                    accountId: selectedAccountId,
                    categoryId: categoryId,
                    incomeType: tx.type === 'income' ? 'active' : null,
                    expenseType: tx.type === 'expense' ? 'optional' : null,
                    fromAccountId: null,
                    toAccountId: null,
                    amountSent: null,
                    amountReceived: null,
                };
                
                const newTransactionRef = doc(collection(firestore, `users/${user.uid}/transactions`));
                batch.set(newTransactionRef, transactionData);
                finalResult.successCount++;

                totalAmountToUpdate += (tx.type === 'income' ? tx.amount : -tx.amount);
            }
            await batch.commit();
        }

        // Обновляем баланс счета после всех батчей
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

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <Card>
            <CardHeader>
              <CardTitle>Шаг 1: Подключение к Mercado Pago</CardTitle>
              <CardDescription>Введите ваш Access Token для получения транзакций.</CardDescription>
            </CardHeader>
            <CardContent>
              <Input
                type="password"
                placeholder="Access Token"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
              />
              {error && (
                  <Alert variant="destructive" className="mt-4">
                      <AlertTitle>Ошибка</AlertTitle>
                      <AlertDescription>{error}</AlertDescription>
                  </Alert>
              )}
            </CardContent>
            <CardFooter>
              <Button onClick={handleFetchTransactions} disabled={isLoading || !accessToken}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Получить транзакции
              </Button>
            </CardFooter>
          </Card>
        );
      case 2:
        return (
          <Card>
            <CardHeader>
              <CardTitle>Шаг 2: Проверка и импорт</CardTitle>
              <CardDescription>Проверьте транзакции и выберите счет для импорта.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
                                <TableHead>Статус</TableHead>
                                <TableHead className="text-right">Сумма</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {transactions.map(tx => (
                                <TableRow key={tx.id}>
                                    <TableCell>{new Date(tx.date).toLocaleDateString()}</TableCell>
                                    <TableCell>{tx.description}</TableCell>
                                    <TableCell>{tx.status}</TableCell>
                                    <TableCell className="text-right">
                                        {new Intl.NumberFormat('ru-RU', { style: 'currency', currency: tx.currency }).format(tx.amount)}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
            <CardFooter className="justify-end gap-2">
                <Button variant="outline" onClick={resetState}>Назад</Button>
                <Button onClick={handleImport} disabled={!selectedAccountId || isImporting}>
                    {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Import className="mr-2 h-4 w-4" />}
                    Импортировать {transactions.length} транзакций
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
