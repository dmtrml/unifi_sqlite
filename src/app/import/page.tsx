

"use client"

import * as React from "react"
import { Upload, FileUp, X, Check, Loader2, Info } from "lucide-react"
import Papa from "papaparse"
import { collection, doc, writeBatch, serverTimestamp, query, DocumentReference } from "firebase/firestore"
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
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import type { Account, Category, Currency, User, Transaction } from "@/lib/types"
import { useFirestore, useUser, useCollection, useMemoFirebase, useDoc } from "@/firebase"
import { colorOptions } from "@/lib/colors"

const transactionFields = [
    { value: "date", label: "date" },
    { value: "categoryName", label: "categoryName" },
    { value: "comment", label: "comment" },
    { value: "outcomeAccountName", label: "outcomeAccountName" },
    { value: "outcome", label: "outcome" },
    { value: "outcomeCurrency", label: "outcomeCurrency" },
    { value: "incomeAccountName", label: "incomeAccountName" },
    { value: "income", label: "income" },
    { value: "incomeCurrency", label: "incomeCurrency" },
];

interface ImportResult {
    successCount: number;
    errorCount: number;
    newCategories: number;
    newAccounts: number;
}

function ImportPageContent() {
  const [step, setStep] = React.useState(1);
  const [file, setFile] = React.useState<File | null>(null);
  const [headers, setHeaders] = React.useState<string[]>([]);
  const [previewData, setPreviewData] = React.useState<Record<string, string>[]>([]);
  const [columnMapping, setColumnMapping] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState<string | null>(null);
  const [isImporting, setIsImporting] = React.useState(false);
  const [importResult, setImportResult] = React.useState<ImportResult | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const userDocRef = useMemoFirebase(
    () => (user ? doc(firestore, "users", user.uid) : null),
    [user, firestore]
  )
  const { data: userData } = useDoc<User>(userDocRef);

  const categoriesQuery = useMemoFirebase(() => 
    user ? query(collection(firestore, "users", user.uid, "categories")) : null, 
    [user, firestore]
  );
  const accountsQuery = useMemoFirebase(() =>
    user ? query(collection(firestore, "users", user.uid, "accounts")) : null,
    [user, firestore]
  );

  const { data: categories } = useCollection<Category>(categoriesQuery);
  const { data: accounts } = useCollection<Account>(accountsQuery);
  
  const mainCurrency = userData?.mainCurrency || "USD";

  const resetState = () => {
    setFile(null);
    setHeaders([]);
    setPreviewData([]);
    setColumnMapping({});
    setError(null);
    setStep(1);
    setIsImporting(false);
    setImportResult(null);
    if(fileInputRef.current) {
        fileInputRef.current.value = "";
    }
  }

  const handleColumnMappingChange = (csvHeader: string, transactionField: string) => {
    setColumnMapping(prev => ({ ...prev, [csvHeader]: transactionField }));
  }

  const tryAutoMapping = (csvHeaders: string[]) => {
      const newMapping: Record<string, string> = {};
      const lowerCaseHeaders = csvHeaders.map(h => h.toLowerCase().replace(/[^a-z0-9]/gi, ''));

      transactionFields.forEach(field => {
          const fieldVariants = [
              field.value.toLowerCase(), 
              field.label.toLowerCase().replace(/[^a-z0-9]/gi, '')
          ];
          
          let found = false;
          for (const header of csvHeaders) {
              const lowerHeader = header.toLowerCase().replace(/[^a-z0-9]/gi, '');
              if (fieldVariants.some(variant => lowerHeader.includes(variant)) && !Object.values(newMapping).includes(field.value)) {
                  newMapping[header] = field.value;
                  found = true;
                  break;
              }
          }
      });
      
      csvHeaders.forEach(header => {
          if(!newMapping[header]) {
              newMapping[header] = "ignore";
          }
      });

      setColumnMapping(newMapping);
  }

  const handleFile = (selectedFile: File) => {
    if (!selectedFile) {
      setError("No file selected.");
      return;
    }
    
    if (selectedFile.type !== "text/csv") {
      setError("Invalid file type. Please upload a CSV file.");
      setFile(null);
      return;
    }

    setError(null);
    setFile(selectedFile);

    Papa.parse(selectedFile, {
      header: true,
      skipEmptyLines: true,
      preview: 6, // Get headers and 5 rows for preview
      complete: (results) => {
        if (results.meta.fields && results.data.length > 0) {
            setHeaders(results.meta.fields);
            setPreviewData(results.data as Record<string, string>[]);
            tryAutoMapping(results.meta.fields);
            setStep(2);
        } else {
            setError("Could not parse CSV. Make sure the file is a valid CSV with a header row and at least one data row.");
        }
      },
      error: (err) => {
        setError(`CSV parsing error: ${err.message}`);
      }
    });
  }
  
  type MappedRow = Record<string, string>;

  const getOrCreateAccount = (
    name: string,
    currency: string | undefined,
    localAccounts: (Account & { ref?: DocumentReference })[],
    batch: any,
    result: ImportResult,
    availableColors: string[]
  ): { id: string, currency: Currency } => {
      let account = localAccounts.find(a => a.name.toLowerCase() === name.toLowerCase());
      if (account) {
          return { id: account.id, currency: account.currency };
      }
      
      const newAccountCurrency = (currency?.toUpperCase() as Currency) || mainCurrency;
      const newColor = availableColors.pop() || "hsl(var(--muted-foreground))"; // Pop a color from the shuffled list

      const newAccountData = {
          name: name,
          balance: 0, 
          userId: user!.uid,
          icon: "Landmark", // Default icon for unstyled accounts
          color: newColor,
          type: 'Bank Account' as const,
          currency: newAccountCurrency,
      };

      const newAccountRef = doc(collection(firestore!, `users/${user!.uid}/accounts`));
      batch.set(newAccountRef, newAccountData);
      
      const newLocalAccount = { ...newAccountData, id: newAccountRef.id, ref: newAccountRef };
      localAccounts.push(newLocalAccount);
      result.newAccounts++;
      
      return { id: newAccountRef.id, currency: newAccountCurrency };
  };

  const getOrCreateCategory = (name: string, type: 'expense' | 'income', localCategories: Category[], batch: any, result: ImportResult): string => {
    let category = localCategories.find(c => c.name.toLowerCase() === name.toLowerCase());
    if (category) {
      return category.id;
    }

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
    result.newCategories++;
    return newCategoryRef.id;
  };


  const handleImport = async () => {
    if (!file || !user || !firestore || !accounts || !categories) return;

    setIsImporting(true);
    setStep(3);
    
    // Prepare a shuffled list of unique, available colors for new accounts
    const existingColors = new Set(accounts.map(a => a.color));
    const availableColors = colorOptions
      .map(c => c.value)
      .filter(c => !existingColors.has(c))
      .sort(() => 0.5 - Math.random()); // Shuffle

    const localAccounts = [...accounts];
    const localCategories = [...categories];

    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        worker: true,
        chunkSize: 1024 * 1024 * 5, // 5MB chunks for large files
        complete: async (results) => {
            const BATCH_SIZE = 450; // Firestore batch limit is 500
            const allRows = results.data as Record<string, string>[];
            const finalResult: ImportResult = { successCount: 0, errorCount: 0, newCategories: 0, newAccounts: 0 };
            
            const accountBalanceChanges: Record<string, number> = {};

            try {
                for (let i = 0; i < allRows.length; i += BATCH_SIZE) {
                    const batch = writeBatch(firestore!);
                    const chunk = allRows.slice(i, i + BATCH_SIZE);
                    
                    for (const row of chunk) {
                        try {
                            const mappedRow: MappedRow = Object.entries(columnMapping).reduce((acc, [csvHeader, field]) => {
                                if (field !== 'ignore' && row[csvHeader] != null && row[csvHeader] !== '') {
                                    acc[field] = row[csvHeader];
                                }
                                return acc;
                            }, {} as MappedRow);
                            
                            const date = new Date(mappedRow.date);
                            if (isNaN(date.getTime())) {
                               finalResult.errorCount++;
                               continue;
                            }
                            
                            const incomeAmount = Number(mappedRow.income) || 0;
                            const outcomeAmount = Number(mappedRow.outcome) || 0;

                            if (isNaN(incomeAmount) || isNaN(outcomeAmount)) {
                                finalResult.errorCount++;
                                continue;
                            }

                            let transactionType: 'income' | 'expense' | 'transfer' | null = null;
                            
                            if (outcomeAmount > 0 && incomeAmount > 0) {
                                transactionType = 'transfer';
                            } else if (outcomeAmount > 0) {
                                transactionType = 'expense';
                            } else if (incomeAmount > 0) {
                                transactionType = 'income';
                            } else {
                                continue;
                            }

                            const newTransactionRef = doc(collection(firestore!, `users/${user.uid}/transactions`));
                            let transactionData: Partial<Transaction> | null = null;
                            
                            if (transactionType === 'transfer') {
                                if (!mappedRow.outcomeAccountName || !mappedRow.incomeAccountName) {
                                    finalResult.errorCount++; continue;
                                }

                                const fromAccountInfo = getOrCreateAccount(mappedRow.outcomeAccountName, mappedRow.outcomeCurrency, localAccounts, batch, finalResult, availableColors);
                                const toAccountInfo = getOrCreateAccount(mappedRow.incomeAccountName, mappedRow.incomeCurrency, localAccounts, batch, finalResult, availableColors);
                                
                                const isMultiCurrency = fromAccountInfo.currency !== toAccountInfo.currency;
                                
                                const amountSent = isMultiCurrency ? outcomeAmount : outcomeAmount;
                                const amountReceived = isMultiCurrency ? incomeAmount : outcomeAmount;

                                transactionData = {
                                    userId: user.uid, date, description: mappedRow.comment || "Imported Transfer",
                                    transactionType: 'transfer', fromAccountId: fromAccountInfo.id, toAccountId: toAccountInfo.id,
                                    amount: isMultiCurrency ? null : outcomeAmount,
                                    amountSent: isMultiCurrency ? amountSent : null,
                                    amountReceived: isMultiCurrency ? amountReceived : null,
                                    accountId: null, categoryId: null, expenseType: null, incomeType: null,
                                };
                                
                                accountBalanceChanges[fromAccountInfo.id] = (accountBalanceChanges[fromAccountInfo.id] || 0) - amountSent;
                                accountBalanceChanges[toAccountInfo.id] = (accountBalanceChanges[toAccountInfo.id] || 0) + amountReceived;

                            } else { // Income or Expense
                                const amount = transactionType === 'income' ? incomeAmount : outcomeAmount;
                                const accountName = mappedRow.incomeAccountName || mappedRow.outcomeAccountName;
                                const currency = mappedRow.incomeCurrency || mappedRow.outcomeCurrency;
                                
                                if (!accountName) {
                                   finalResult.errorCount++; continue;
                                }
                                
                                const accountInfo = getOrCreateAccount(accountName, currency, localAccounts, batch, finalResult, availableColors);
                                let categoryId: string | null = null;
                                if (mappedRow.categoryName) {
                                   categoryId = getOrCreateCategory(mappedRow.categoryName, transactionType, localCategories, batch, finalResult);
                                }
                                
                                const finalAmount = transactionType === 'expense' ? -Math.abs(amount) : Math.abs(amount);
                                
                                transactionData = {
                                    userId: user.uid,
                                    date,
                                    amount: Math.abs(amount),
                                    description: mappedRow.comment || 'Imported Transaction',
                                    transactionType: transactionType,
                                    accountId: accountInfo.id, 
                                    categoryId: categoryId || null,
                                    expenseType: transactionType === 'expense' ? 'optional' : null,
                                    incomeType: transactionType === 'income' ? 'active' : null,
                                    fromAccountId: null,
                                    toAccountId: null,
                                    amountSent: null,
                                    amountReceived: null,
                                };

                                accountBalanceChanges[accountInfo.id] = (accountBalanceChanges[accountInfo.id] || 0) + finalAmount;
                            }
                            
                            if (transactionData) {
                                batch.set(newTransactionRef, { ...transactionData, createdAt: serverTimestamp() });
                                finalResult.successCount++;
                            }

                        } catch (e) {
                            console.error("Error processing row: ", row, e);
                            finalResult.errorCount++;
                        }
                    }

                    // Apply balance changes accumulated in this chunk
                    for (const accountId in accountBalanceChanges) {
                        const account = localAccounts.find(a => a.id === accountId);
                        if (account) {
                          const accountRef = doc(firestore, `users/${user.uid}/accounts`, accountId);
                          const newBalance = (account.balance || 0) + accountBalanceChanges[accountId];
                          batch.update(accountRef, { balance: newBalance });
                          account.balance = newBalance; // Update local copy for next chunk
                        }
                    }
                    // Reset for next chunk
                    Object.keys(accountBalanceChanges).forEach(k => delete accountBalanceChanges[k]);

                    await batch.commit();
                    toast({ title: `Importing...`, description: `Processed ${i + chunk.length} of ${allRows.length} rows.` });
                }

                setImportResult(finalResult);
                toast({ title: "Import Complete", description: `Processed ${finalResult.successCount + finalResult.errorCount} rows.` });

            } catch (commitError) {
                console.error("Batch commit failed: ", commitError);
                toast({ title: "Import Failed", description: "An error occurred while saving data. Please try again.", variant: "destructive" });
                setError("A critical error occurred during the saving process.");
                setImportResult(finalResult); // Show partial results even on failure
            } finally {
                setIsImporting(false);
            }
        }
    });
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      handleFile(selectedFile);
    }
  }

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const droppedFile = event.dataTransfer.files?.[0];
    if (droppedFile) {
        handleFile(droppedFile);
    }
  };
  
  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <Card>
            <CardHeader>
              <CardTitle>Step 1: Upload File</CardTitle>
              <CardDescription>Select a CSV file to import your transactions.</CardDescription>
            </CardHeader>
            <CardContent>
              <div 
                  className="relative flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
              >
                  <FileUp className="w-10 h-10 text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">
                      <span className="font-semibold">Click to upload</span> or drag and drop
                  </p>
                  <p className="text-xs text-muted-foreground">CSV (up to 5MB)</p>
                  <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv"
                      className="hidden"
                      onChange={handleFileChange}
                  />
              </div>
              {error && (
                  <Alert variant="destructive" className="mt-4">
                      <AlertTitle>Error</AlertTitle>
                      <AlertDescription>{error}</AlertDescription>
                  </Alert>
              )}
            </CardContent>
          </Card>
        );
      case 2:
        return (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Step 2: Map Columns & Preview</CardTitle>
                  <CardDescription>Match your file columns to transaction fields.</CardDescription>
                </div>
                {file && (
                     <div className="flex items-center gap-2 p-2 text-sm border rounded-md bg-muted/50">
                        <span className="font-medium">{file.name}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={resetState}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
               <div>
                  <h3 className="text-base font-medium mb-2">Column Mapping</h3>
                  <div className="rounded-md border">
                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {headers.map((header) => (
                        <div key={header} className="grid grid-cols-2 items-center gap-2">
                          <span className="font-medium text-sm text-muted-foreground truncate">{header}</span>
                          <Select
                            value={columnMapping[header] || "ignore"}
                            onValueChange={(value) => handleColumnMappingChange(header, value)}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select field..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ignore">Ignore</SelectItem>
                              <SelectSeparator />
                              {transactionFields.map(field => (
                                <SelectItem key={field.value} value={field.value}>
                                  {field.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                   <h3 className="text-base font-medium mb-2">Data Preview (first 5 rows)</h3>
                    <div className="relative w-full overflow-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                {headers.map(header => (
                                    <TableHead key={header}>{header}</TableHead>
                                ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {previewData.slice(0, 5).map((row, rowIndex) => (
                                    <TableRow key={rowIndex}>
                                        {headers.map(header => (
                                            <TableCell key={`${rowIndex}-${header}`} className="whitespace-nowrap">
                                                {row[header]}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </CardContent>
            <CardFooter className="justify-end gap-2">
              <Button type="button" variant="outline" onClick={resetState}>
                Back
              </Button>
              <Button type="button" onClick={handleImport} disabled={isImporting}>
                 {isImporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Import
              </Button>
            </CardFooter>
          </Card>
        );
      case 3:
        return (
          <Card>
             <CardHeader>
                <CardTitle>Step 3: Import Results</CardTitle>
             </CardHeader>
             <CardContent>
               <div className="py-4 text-center">
                  {isImporting ? (
                      <div className="flex flex-col items-center gap-4">
                          <Loader2 className="h-12 w-12 animate-spin text-primary" />
                          <h3 className="text-lg font-semibold">Importing...</h3>
                          <p className="text-muted-foreground">Please wait while we process your file.</p>
                      </div>
                  ) : importResult ? (
                      <div className="space-y-4">
                          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/50">
                             <Check className="h-6 w-6 text-green-600 dark:text-green-400" />
                          </div>
                          <h3 className="text-lg font-semibold">Import Complete</h3>
                          <div className="text-left border rounded-md p-4 max-w-md mx-auto space-y-2">
                             <div className="flex justify-between"><span>Successfully imported:</span> <span className="font-medium">{importResult.successCount} rows</span></div>
                             <div className="flex justify-between"><span>Skipped due to errors:</span> <span className="font-medium">{importResult.errorCount} rows</span></div>
                             <div className="flex justify-between"><span>New categories created:</span> <span className="font-medium">{importResult.newCategories}</span></div>
                             <div className="flex justify-between"><span>New accounts created:</span> <span className="font-medium">{importResult.newAccounts}</span></div>
                          </div>
                           {(importResult.newCategories > 0 || importResult.newAccounts > 0) && (
                                <Alert className="mt-6 text-left max-w-lg mx-auto">
                                  <Info className="h-4 w-4" />
                                  <AlertTitle>Action Required</AlertTitle>
                                  <AlertDescription>
                                    New categories and/or accounts were created with default styles.
                                    <div className="mt-2 space-x-2">
                                      {importResult.newCategories > 0 && (
                                        <Button asChild variant="outline" size="sm">
                                          <Link href="/categories">Style Categories</Link>
                                        </Button>
                                      )}
                                      {importResult.newAccounts > 0 && (
                                        <Button asChild variant="outline" size="sm">
                                          <Link href="/accounts">Style Accounts</Link>
                                        </Button>
                                      )}
                                    </div>
                                  </AlertDescription>
                                </Alert>
                            )}
                          <p className="text-muted-foreground text-sm pt-4">You can now close this window or start a new import.</p>
                      </div>
                  ) : error ? (
                      <Alert variant="destructive">
                          <AlertTitle>Import Failed</AlertTitle>
                          <AlertDescription>{error}</AlertDescription>
                      </Alert>
                  ) : null}
              </div>
             </CardContent>
              <CardFooter className="justify-end">
                <Button type="button" onClick={resetState}>
                  Start New Import
                </Button>
              </CardFooter>
          </Card>
        );
      default:
        return null;
    }
  }

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
      <div className="flex items-center">
        <h1 className="text-lg font-semibold md:text-2xl">Import Transactions</h1>
      </div>
      {renderStepContent()}
    </main>
  )
}


export default function ImportPage() {
    return (
        <AppLayout>
            <ImportPageContent />
        </AppLayout>
    )
}

    
