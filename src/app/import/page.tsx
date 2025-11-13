

"use client"

import * as React from "react"
import { Upload, FileUp, X, Check, Loader2, Info } from "lucide-react"
import Papa from "papaparse"
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
import type { Currency } from "@/lib/types"
import type { NormalizedImportRow, ImportSummary } from "@/lib/imports"
import { useUser } from "@/lib/auth-context"
import { useAccounts } from "@/hooks/use-accounts"
import { useCategories } from "@/hooks/use-categories"
import { useUserProfile } from "@/hooks/use-user-profile"

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

type ImportResult = ImportSummary;

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
  const { toast } = useToast();
  const { profile } = useUserProfile();

  const { refresh: refreshCategories } = useCategories();
  const { refresh: refreshAccounts } = useAccounts();
  
  const mainCurrency = profile?.mainCurrency || "USD";

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
  

  const handleImport = async () => {
    if (!file || !user) {
      toast({
        variant: "destructive",
        title: "Import unavailable",
        description: "Please sign in and select a CSV file before importing.",
      });
      return;
    }

    setIsImporting(true);
    setError(null);
    setImportResult(null);

    const parseRows = () =>
      new Promise<Record<string, string>[]>((resolve, reject) => {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          worker: true,
          complete: (results) => resolve((results.data as Record<string, string>[]) ?? []),
          error: (err) => reject(err),
        });
      });

    const ensureCurrency = (value?: string) =>
      ((value?.toUpperCase() as Currency) || (mainCurrency as Currency));

    const buildNormalizedRow = (mappedRow: Record<string, string>): NormalizedImportRow | null => {
      const dateValue = new Date(mappedRow.date);
      if (isNaN(dateValue.getTime())) {
        throw new Error("Invalid date");
      }

      const incomeAmount = Number(mappedRow.income) || 0;
      const outcomeAmount = Number(mappedRow.outcome) || 0;

      if (!Number.isFinite(incomeAmount) || !Number.isFinite(outcomeAmount)) {
        throw new Error("Invalid amount");
      }

      const description = mappedRow.comment?.trim() || "Imported Transaction";

      if (outcomeAmount > 0 && incomeAmount > 0) {
        const fromAccountName = mappedRow.outcomeAccountName?.trim();
        const toAccountName = mappedRow.incomeAccountName?.trim();
        if (!fromAccountName || !toAccountName) {
          throw new Error("Transfer accounts missing");
        }

        return {
          transactionType: "transfer",
          date: dateValue.getTime(),
          description,
          amountSent: Math.abs(outcomeAmount),
          amountReceived: Math.abs(incomeAmount),
          fromAccountName,
          fromAccountCurrency: ensureCurrency(mappedRow.outcomeCurrency),
          toAccountName,
          toAccountCurrency: ensureCurrency(mappedRow.incomeCurrency),
        };
      }

      if (outcomeAmount > 0) {
        const accountName = mappedRow.outcomeAccountName?.trim() || mappedRow.incomeAccountName?.trim();
        if (!accountName) {
          throw new Error("Account not provided for expense");
        }
        return {
          transactionType: "expense",
          date: dateValue.getTime(),
          description,
          amount: Math.abs(outcomeAmount),
          accountName,
          accountCurrency: ensureCurrency(mappedRow.outcomeCurrency || mappedRow.incomeCurrency),
          categoryName: mappedRow.categoryName?.trim() || null,
        };
      }

      if (incomeAmount > 0) {
        const accountName = mappedRow.incomeAccountName?.trim() || mappedRow.outcomeAccountName?.trim();
        if (!accountName) {
          throw new Error("Account not provided for income");
        }
        return {
          transactionType: "income",
          date: dateValue.getTime(),
          description,
          amount: Math.abs(incomeAmount),
          accountName,
          accountCurrency: ensureCurrency(mappedRow.incomeCurrency || mappedRow.outcomeCurrency),
          categoryName: mappedRow.categoryName?.trim() || null,
        };
      }

      return null;
    };

    try {
      const allRows = await parseRows();
      const normalizedRows: NormalizedImportRow[] = [];
      let skippedRows = 0;

      for (const row of allRows) {
        try {
          const mappedRow = Object.entries(columnMapping).reduce((acc, [csvHeader, field]) => {
            if (field !== "ignore" && row[csvHeader] != null && row[csvHeader] !== "") {
              acc[field] = row[csvHeader];
            }
            return acc;
          }, {} as Record<string, string>);

          if (!mappedRow.date) {
            skippedRows++;
            continue;
          }

          const normalized = buildNormalizedRow(mappedRow);
          if (normalized) {
            normalizedRows.push(normalized);
          } else {
            skippedRows++;
          }
        } catch (rowError) {
          console.error("Skipping row during import", rowError);
          skippedRows++;
        }
      }

      if (!normalizedRows.length) {
        const emptyResult: ImportResult = {
          successCount: 0,
          errorCount: skippedRows || allRows.length,
          newCategories: 0,
          newAccounts: 0,
        };
        setImportResult(emptyResult);
        toast({
          variant: "destructive",
          title: "Import aborted",
          description: "No valid rows found in the CSV file.",
        });
        return;
      }

      const response = await fetch("/api/imports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-uid": user.uid,
        },
        body: JSON.stringify({
          source: "csv",
          defaultCurrency: mainCurrency,
          rows: normalizedRows,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.message ?? "Failed to import data.");
      }

      const summary = (await response.json()) as ImportSummary;
      const combinedResult: ImportResult = {
        successCount: summary.successCount,
        errorCount: summary.errorCount + skippedRows,
        newCategories: summary.newCategories,
        newAccounts: summary.newAccounts,
      };

      setImportResult(combinedResult);
      toast({
        title: "Import complete",
        description: `Processed ${combinedResult.successCount + combinedResult.errorCount} rows.`,
      });
      refreshAccounts();
      refreshCategories();
    } catch (importError) {
      console.error("CSV import failed", importError);
      setError("An error occurred while importing data. Please try again.");
      toast({
        variant: "destructive",
        title: "Import failed",
        description:
          importError instanceof Error ? importError.message : "Unexpected error during import.",
      });
    } finally {
      setIsImporting(false);
    }
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

    

