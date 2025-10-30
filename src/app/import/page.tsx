"use client"

import * as React from "react"
import { Upload, FileUp, X, Check, Loader2 } from "lucide-react"
import Papa from "papaparse"
import { collection, doc, writeBatch, serverTimestamp, query, DocumentReference } from "firebase/firestore"

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
import { ScrollArea } from "@/components/ui/scroll-area"
import { convertAmount } from "@/lib/currency"

const transactionFields = [
    { value: "date", label: "Date" },
    { value: "description", label: "Description" },
    { value: "transactionType", label: "Type (income/expense/transfer)" },
    // Generic fields
    { value: "amount", label: "Amount (for income/expense)" },
    { value: "accountName", label: "Account (for income/expense)" },
    { value: "categoryName", label: "Category" },
    // Transfer specific
    { value: "fromAccountName", label: "From Account (for transfers)" },
    { value: "toAccountName", label: "To Account (for transfers)" },
    { value: "amountSent", label: "Amount Sent (for transfers)" },
    { value: "amountReceived", label: "Amount Received (for transfers)" },
    { value: "fromCurrency", label: "From Currency" },
    { value: "toCurrency", label: "To Currency" },
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
    result: ImportResult
  ): { id: string, currency: Currency } => {
      let account = localAccounts.find(a => a.name.toLowerCase() === name.toLowerCase());
      if (account) {
          return { id: account.id, currency: account.currency };
      }
      
      const newAccountCurrency = (currency?.toUpperCase() as Currency) || mainCurrency;
      const newAccountData = {
          name: name,
          balance: 0, 
          userId: user!.uid,
          icon: "Landmark",
          color: "hsl(var(--muted-foreground))",
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

    let localAccounts = [...accounts];
    let localCategories = [...categories];

    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        worker: true,
        complete: async (results) => {
            const batch = writeBatch(firestore);
            const result: ImportResult = { successCount: 0, errorCount: 0, newCategories: 0, newAccounts: 0 };
            const transactionsColRef = collection(firestore, `users/${user.uid}/transactions`);
            
            const allRows = results.data as Record<string, string>[];
            const accountBalanceChanges: Record<string, number> = {};

            for (const row of allRows) {
                try {
                    const mappedRow: MappedRow = Object.entries(columnMapping).reduce((acc, [csvHeader, field]) => {
                        if (field !== 'ignore' && row[csvHeader]) {
                            acc[field] = row[csvHeader];
                        }
                        return acc;
                    }, {} as MappedRow);
                    
                    const date = new Date(mappedRow.date);
                    if (isNaN(date.getTime())) {
                       result.errorCount++;
                       continue;
                    }
                    
                    const transactionType = mappedRow.transactionType?.toLowerCase() || 'expense';

                    const newTransactionRef = doc(transactionsColRef);
                    let transactionData: Omit<Transaction, 'id'> | null = null;
                    
                    if (transactionType === 'transfer') {
                        if (!mappedRow.fromAccountName || !mappedRow.toAccountName) {
                            result.errorCount++; continue;
                        }

                        const fromAccountInfo = getOrCreateAccount(mappedRow.fromAccountName, mappedRow.fromCurrency, localAccounts, batch, result);
                        const toAccountInfo = getOrCreateAccount(mappedRow.toAccountName, mappedRow.toCurrency, localAccounts, batch, result);
                        
                        const isMultiCurrency = fromAccountInfo.currency !== toAccountInfo.currency;
                        
                        let amountSent = parseFloat(mappedRow.amountSent || mappedRow.amount);
                        let amountReceived = parseFloat(mappedRow.amountReceived || mappedRow.amount);
                        if (isNaN(amountSent) || (isMultiCurrency && isNaN(amountReceived))) {
                            result.errorCount++; continue;
                        }
                        if (isMultiCurrency && !mappedRow.amountReceived) {
                           amountReceived = convertAmount(amountSent, fromAccountInfo.currency, toAccountInfo.currency);
                        }

                        transactionData = {
                            userId: user.uid, date, description: mappedRow.description || "Imported Transfer",
                            transactionType: 'transfer', fromAccountId: fromAccountInfo.id, toAccountId: toAccountInfo.id,
                            amountSent, amountReceived,
                        };
                        
                        accountBalanceChanges[fromAccountInfo.id] = (accountBalanceChanges[fromAccountInfo.id] || 0) - amountSent;
                        accountBalanceChanges[toAccountInfo.id] = (accountBalanceChanges[toAccountInfo.id] || 0) + amountReceived;

                    } else { // Income or Expense
                        const amount = parseFloat(mappedRow.amount);
                        if (isNaN(amount) || !mappedRow.accountName) {
                           result.errorCount++; continue;
                        }
                        
                        const accountInfo = getOrCreateAccount(mappedRow.accountName, mappedRow.fromCurrency || mappedRow.toCurrency, localAccounts, batch, result);
                        let categoryId: string | undefined = undefined;
                        if (mappedRow.categoryName) {
                           categoryId = getOrCreateCategory(mappedRow.categoryName, transactionType as 'income' | 'expense', localCategories, batch, result);
                        }
                        
                        const finalAmount = transactionType === 'expense' ? -Math.abs(amount) : Math.abs(amount);
                        
                        transactionData = {
                            userId: user.uid, date, amount: Math.abs(amount),
                            description: mappedRow.description || 'Imported Transaction',
                            transactionType: transactionType as 'income' | 'expense',
                            accountId: accountInfo.id, categoryId,
                            expenseType: transactionType === 'expense' ? 'optional' : undefined,
                            incomeType: transactionType === 'income' ? 'active' : undefined,
                        };

                        accountBalanceChanges[accountInfo.id] = (accountBalanceChanges[accountInfo.id] || 0) + finalAmount;
                    }
                    
                    if (transactionData) {
                        batch.set(newTransactionRef, { ...transactionData, createdAt: serverTimestamp() });
                        result.successCount++;
                    }

                } catch (e) {
                    console.error("Error processing row: ", row, e);
                    result.errorCount++;
                }
            }
            
            // Apply balance changes
            for (const accountId in accountBalanceChanges) {
                const account = localAccounts.find(a => a.id === accountId);
                if (account) {
                  const accountRef = doc(firestore, `users/${user.uid}/accounts`, accountId);
                  const newBalance = (account.balance || 0) + accountBalanceChanges[accountId];
                  batch.update(accountRef, { balance: newBalance });
                }
            }


            try {
                await batch.commit();
                setImportResult(result);
                toast({ title: "Import Successful", description: `Processed ${result.successCount + result.errorCount} rows.` });
            } catch (commitError) {
                console.error("Batch commit failed: ", commitError);
                toast({ title: "Import Failed", description: "Could not save imported data. Please try again.", variant: "destructive" });
                setError("A critical error occurred during the final step of saving your data.");
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
                  <ScrollArea className="h-64 rounded-md border">
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
                  </ScrollArea>
                </div>

                <div>
                   <h3 className="text-base font-medium mb-2">Data Preview (first 5 rows)</h3>
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
                                        <TableCell key={`${rowIndex}-${header}`}>{row[header]}</TableCell>
                                    ))}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
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
