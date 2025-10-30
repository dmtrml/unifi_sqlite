
"use client"

import * as React from "react"
import { Upload, FileUp, X, Check, ChevronsUpDown, Loader2 } from "lucide-react"
import Papa from "papaparse"
import { collection, doc, writeBatch, serverTimestamp } from "firebase/firestore"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
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
import { cn } from "@/lib/utils"
import { Alert, AlertDescription, AlertTitle } from "./ui/alert"
import type { Account, Category, Currency } from "@/lib/types"
import { useFirestore, useUser } from "@/firebase"

// The fields we can map to in our transaction object
const transactionFields = [
    { value: "date", label: "Date" },
    { value: "description", label: "Description" },
    { value: "amount", label: "Amount" },
    { value: "categoryName", label: "Category" },
    { value: "accountName", label: "Account" },
    { value: "transactionType", label: "Type (income/expense)" },
];

interface ImportTransactionsDialogProps {
    accounts: Account[];
    categories: Category[];
    mainCurrency: Currency;
}

interface ImportResult {
    successCount: number;
    errorCount: number;
    newCategories: number;
    newAccounts: number;
}

export function ImportTransactionsDialog({ accounts, categories, mainCurrency }: ImportTransactionsDialogProps) {
  const [open, setOpen] = React.useState(false)
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

  React.useEffect(() => {
    if (!open) {
      resetState();
    }
  }, [open]);

  const handleColumnMappingChange = (csvHeader: string, transactionField: string) => {
    setColumnMapping(prev => ({ ...prev, [csvHeader]: transactionField }));
  }

  const tryAutoMapping = (csvHeaders: string[]) => {
      const newMapping: Record<string, string> = {};
      csvHeaders.forEach(header => {
          const lowerHeader = header.toLowerCase().replace(/[^a-z0-9]/gi, '');
          const matchedField = transactionFields.find(field => 
              lowerHeader.includes(field.value.toLowerCase()) || 
              field.label.toLowerCase().includes(lowerHeader)
          );
          if (matchedField) {
              newMapping[header] = matchedField.value;
          } else {
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

  const handleImport = async () => {
    if (!file || !user || !firestore) return;

    setIsImporting(true);
    setStep(3);

    // Create local mutable copies for this import session
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
            
            for (const row of results.data as Record<string, string>[]) {
                try {
                    const mappedRow = Object.entries(columnMapping).reduce((acc, [csvHeader, field]) => {
                        if (field !== 'ignore' && row[csvHeader]) {
                            acc[field] = row[csvHeader];
                        }
                        return acc;
                    }, {} as Record<string, string>);

                    const date = new Date(mappedRow.date);
                    const amount = parseFloat(mappedRow.amount);
                    if (isNaN(date.getTime()) || isNaN(amount)) {
                       result.errorCount++;
                       continue;
                    }

                    // Handle Category
                    let categoryId = localCategories.find(c => c.name.toLowerCase() === mappedRow.categoryName?.toLowerCase())?.id;
                    if (!categoryId && mappedRow.categoryName) {
                        const newCategory = {
                            name: mappedRow.categoryName,
                            userId: user.uid,
                            icon: "MoreHorizontal",
                            color: "hsl(var(--muted-foreground))",
                            type: amount < 0 ? 'expense' : 'income'
                        } as Omit<Category, 'id'>;
                        const newCategoryRef = doc(collection(firestore, `users/${user.uid}/categories`));
                        batch.set(newCategoryRef, newCategory);
                        categoryId = newCategoryRef.id;
                        localCategories.push({ ...newCategory, id: categoryId });
                        result.newCategories++;
                    }

                    // Handle Account
                    let accountId = localAccounts.find(a => a.name.toLowerCase() === mappedRow.accountName?.toLowerCase())?.id;
                    if (!accountId && mappedRow.accountName) {
                        const newAccount = {
                            name: mappedRow.accountName,
                            balance: 0, // Will be adjusted
                            userId: user.uid,
                            icon: "Landmark",
                            color: "hsl(var(--muted-foreground))",
                            type: 'Bank Account',
                            currency: mainCurrency,
                        } as Omit<Account, 'id'>;
                        const newAccountRef = doc(collection(firestore, `users/${user.uid}/accounts`));
                        batch.set(newAccountRef, newAccount);
                        accountId = newAccountRef.id;
                        localAccounts.push({ ...newAccount, id: accountId });
                        result.newAccounts++;
                    }

                    if (!accountId) { // Skip if no account can be found or created
                        result.errorCount++;
                        continue;
                    }
                    
                    const transactionType = mappedRow.transactionType?.toLowerCase() === 'income' || (!mappedRow.transactionType && amount > 0) ? 'income' : 'expense';
                    const finalAmount = transactionType === 'expense' ? -Math.abs(amount) : Math.abs(amount);
                    
                    const newTransactionRef = doc(transactionsColRef);
                    batch.set(newTransactionRef, {
                        userId: user.uid,
                        date: date,
                        amount: Math.abs(finalAmount),
                        description: mappedRow.description || 'Imported Transaction',
                        transactionType: transactionType,
                        accountId: accountId,
                        categoryId: categoryId,
                        createdAt: serverTimestamp(),
                        expenseType: transactionType === 'expense' ? 'optional' : null,
                        incomeType: transactionType === 'income' ? 'active' : null,
                    });
                    
                    const accountRef = doc(firestore, `users/${user.uid}/accounts`, accountId);
                    const accountData = localAccounts.find(a => a.id === accountId);
                    if(accountData) {
                        // We use a FieldValue here but for batch it's handled on commit
                        const newBalance = (accountData.balance || 0) + finalAmount;
                        batch.update(accountRef, { balance: newBalance });
                        // Update local copy for subsequent rows in this batch
                        accountData.balance = newBalance;
                    }

                    result.successCount++;

                } catch (e) {
                    console.error("Error processing row: ", row, e);
                    result.errorCount++;
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


  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
            <Upload className="mr-2 h-4 w-4" />
            Import Transactions
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Import Transactions</DialogTitle>
          <DialogDescription>
            {step === 1 && "Step 1: Upload a CSV file to import."}
            {step === 2 && "Step 2: Map file columns to transaction fields and review data."}
            {step === 3 && "Step 3: View your import results."}
          </DialogDescription>
        </DialogHeader>
        
        {step === 1 && (
            <div className="py-4 space-y-4">
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
                    <Alert variant="destructive">
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}
            </div>
        )}
        {step === 2 && (
             <div className="py-4 space-y-6">
                {file && (
                     <div className="flex items-center justify-between p-2 text-sm border rounded-md bg-muted/50">
                        <span className="font-medium">{file.name}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={resetState}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                )}
                
                <div>
                  <h3 className="text-lg font-medium mb-2">Column Mapping</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Match each column from your file to a transaction field.
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {headers.map((header) => (
                      <div key={header} className="space-y-2">
                        <span className="font-medium text-sm px-3 py-1.5 bg-secondary text-secondary-foreground rounded-md block truncate">{header}</span>
                        <Select
                          value={columnMapping[header] || "ignore"}
                          onValueChange={(value) => handleColumnMappingChange(header, value)}
                        >
                          <SelectTrigger>
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

                <div>
                   <h3 className="text-lg font-medium mb-2">Data Preview (first 5 rows)</h3>
                   <div className="rounded-md border">
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
                                            <TableCell key={`${rowIndex}-${header}`} className="truncate max-w-xs">{row[header]}</TableCell>
                                        ))}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                   </div>
                </div>
             </div>
        )}

        {step === 3 && (
            <div className="py-4 text-center">
                {isImporting ? (
                    <div className="flex flex-col items-center gap-4">
                        <Loader2 className="h-12 w-12 animate-spin text-primary" />
                        <h3 className="text-lg font-semibold">Importing...</h3>
                        <p className="text-muted-foreground">Please wait while we process your file.</p>
                    </div>
                ) : importResult ? (
                    <div className="space-y-4">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                           <Check className="h-6 w-6 text-green-600" />
                        </div>
                        <h3 className="text-lg font-semibold">Import Complete</h3>
                        <div className="text-left border rounded-md p-4 max-w-md mx-auto space-y-2">
                           <div className="flex justify-between"><span>Successfully imported:</span> <span className="font-medium">{importResult.successCount} rows</span></div>
                           <div className="flex justify-between"><span>Skipped due to errors:</span> <span className="font-medium">{importResult.errorCount} rows</span></div>
                           <div className="flex justify-between"><span>New categories created:</span> <span className="font-medium">{importResult.newCategories}</span></div>
                           <div className="flex justify-between"><span>New accounts created:</span> <span className="font-medium">{importResult.newAccounts}</span></div>
                        </div>
                        <p className="text-muted-foreground text-sm">You can now close this window.</p>
                    </div>
                ) : error ? (
                    <Alert variant="destructive">
                        <AlertTitle>Import Failed</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                ) : null}
            </div>
        )}

        <DialogFooter>
          {step === 1 && (
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                Cancel
            </Button>
          )}
          {step === 2 && (
            <>
              <Button type="button" variant="secondary" onClick={resetState}>
                Back
              </Button>
              <Button type="button" onClick={handleImport} disabled={isImporting}>
                 {isImporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Import
              </Button>
            </>
          )}
           {step === 3 && (
             <Button type="button" onClick={() => setOpen(false)}>
                Close
             </Button>
           )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
