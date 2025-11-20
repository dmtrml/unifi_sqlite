

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
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import type { Currency } from "@/lib/types"
import type { NormalizedImportRow, ImportSummary } from "@/lib/imports"
import { formatDateLabel } from "@/lib/date"
import { useUser } from "@/lib/auth-context"
import { useAccounts } from "@/hooks/use-accounts"
import { useCategories } from "@/hooks/use-categories"
import { useUserProfile } from "@/hooks/use-user-profile"
import { DEFAULT_IMPORT_PROFILE_ID, getImportProfile, importProfiles, type TransferStub } from "@/lib/import-profiles"

const DEFAULT_FIELDS = [
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

type ImportResult = ImportSummary & {
  skippedRows: number;
  skippedDetails: string[];
};

const MAPPING_STORAGE_KEY = "import:column-mapping";
const PRESET_STORAGE_KEY = "import:selected-profile";

const escapeCsvValue = (value: string) => `"${value.replace(/"/g, '""')}"`;

const isNormalizedRow = (value: NormalizedImportRow | TransferStub): value is NormalizedImportRow =>
  Boolean(value && 'transactionType' in value);

const finalizeProfileRows = (
  items: (NormalizedImportRow | TransferStub)[],
  profile: ReturnType<typeof getImportProfile>,
  defaultCurrency: Currency,
) => {
  if (typeof profile.finalize === 'function') {
    return profile.finalize(items, defaultCurrency);
  }
  return items.filter(isNormalizedRow);
};

const mapRowWithMapping = (
  row: Record<string, string>,
  columnMapping: Record<string, string>,
): Record<string, string> => {
  return Object.entries(columnMapping).reduce((acc, [csvHeader, field]) => {
    if (field !== "ignore" && row[csvHeader] != null && row[csvHeader] !== "") {
      acc[field] = row[csvHeader];
    }
    return acc;
  }, {} as Record<string, string>);
};

function ImportPageContent() {
  const [step, setStep] = React.useState(1);
  const [file, setFile] = React.useState<File | null>(null);
  const [headers, setHeaders] = React.useState<string[]>([]);
  const [previewData, setPreviewData] = React.useState<Record<string, string>[]>([]);
  const [columnMapping, setColumnMapping] = React.useState<Record<string, string>>({});
  const [normalizedPreview, setNormalizedPreview] = React.useState<NormalizedImportRow[]>([]);
  const [previewError, setPreviewError] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isImporting, setIsImporting] = React.useState(false);
  const [importResult, setImportResult] = React.useState<ImportResult | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const savedMappingRef = React.useRef<Record<string, string> | null>(null);
  const savedMappingSignatureRef = React.useRef<string | null>(null);
  const [profileId, setProfileId] = React.useState<string>(DEFAULT_IMPORT_PROFILE_ID);
  const activeProfile = React.useMemo(() => getImportProfile(profileId), [profileId]);

  const { user } = useUser();
  const { toast } = useToast();
  const { profile: userProfile } = useUserProfile();

  const { refresh: refreshCategories } = useCategories();
  const { refresh: refreshAccounts } = useAccounts();
  
  const mainCurrency = (userProfile?.mainCurrency || "USD") as Currency;
  const parserDelimiter = activeProfile.options?.delimiter ?? ",";

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const storedProfileId = localStorage.getItem(PRESET_STORAGE_KEY);
    if (storedProfileId) {
      const storedProfile = getImportProfile(storedProfileId);
      if (storedProfile.id !== profileId) {
        setProfileId(storedProfile.id);
      }
    }
  }, [profileId]);

  const mappingStorageKey = React.useMemo(
    () => `${MAPPING_STORAGE_KEY}:${activeProfile.id}`,
    [activeProfile.id],
  );

  const headersSignature = React.useCallback((list: string[]) => {
    return list.map((header) => header.trim().toLowerCase()).sort().join("|");
  }, []);

  const initializeMapping = React.useCallback((csvHeaders: string[], options?: { force?: boolean }) => {
    const force = options?.force ?? false;
    const saved = savedMappingRef.current;
    const savedSignature = savedMappingSignatureRef.current;
    const currentSignature = headersSignature(csvHeaders);
    const shouldUseSaved = !force && Boolean(saved && savedSignature && savedSignature === currentSignature);

    if (shouldUseSaved && saved) {
      const mapping: Record<string, string> = {};
      csvHeaders.forEach((header) => {
        mapping[header] = saved[header] ?? "ignore";
      });
      setColumnMapping(mapping);
      return;
    }

    const inferred = activeProfile.inferMapping(csvHeaders);
    setColumnMapping(inferred);
  }, [activeProfile, headersSignature]);

  const resetState = () => {
    setFile(null);
    setHeaders([]);
    setPreviewData([]);
    setColumnMapping({});
    setNormalizedPreview([]);
    setPreviewError(null);
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

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (!headers.length) return;
    if (!Object.keys(columnMapping).length) return;
    const payload = {
      headers,
      mapping: columnMapping,
    };
    localStorage.setItem(mappingStorageKey, JSON.stringify(payload));
    savedMappingRef.current = columnMapping;
    savedMappingSignatureRef.current = headersSignature(headers);
  }, [columnMapping, headers, headersSignature, mappingStorageKey]);

  React.useEffect(() => {
    if (!headers.length) return;
    initializeMapping(headers);
  }, [headers, initializeMapping, activeProfile.id]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem(mappingStorageKey);
    if (!raw) {
      savedMappingRef.current = null;
      savedMappingSignatureRef.current = null;
      return;
    }
    try {
      const payload = JSON.parse(raw);
      if (payload && typeof payload === "object" && payload.mapping && Array.isArray(payload.headers)) {
        savedMappingRef.current = payload.mapping;
        savedMappingSignatureRef.current = headersSignature(payload.headers);
      } else if (payload && typeof payload === "object") {
        savedMappingRef.current = payload;
        savedMappingSignatureRef.current = null;
      } else {
        savedMappingRef.current = null;
        savedMappingSignatureRef.current = null;
      }
    } catch {
      savedMappingRef.current = null;
      savedMappingSignatureRef.current = null;
    }
  }, [headersSignature, mappingStorageKey]);

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
      delimiter: parserDelimiter,
      complete: (results) => {
        if (results.meta.fields && results.data.length > 0) {
            setHeaders(results.meta.fields);
            const processed = activeProfile.preprocessRows
              ? activeProfile.preprocessRows(results.data as Record<string, string>[])
              : (results.data as Record<string, string>[]);
            setPreviewData(processed);
            initializeMapping(results.meta.fields);
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
          delimiter: parserDelimiter,
          complete: (results) => resolve((results.data as Record<string, string>[]) ?? []),
          error: (err) => reject(err),
        });
      });
    try {
      const allRows = await parseRows();
      const processedRows = activeProfile.preprocessRows ? activeProfile.preprocessRows(allRows) : allRows;
      let skippedRows = 0;
      const rowErrors: string[] = [];
      const intermediate: (NormalizedImportRow | TransferStub)[] = [];
      for (let index = 0; index < processedRows.length; index++) {
        const row = processedRows[index];
        try {
          const mappedRow = mapRowWithMapping(row, columnMapping);
          if (!mappedRow.date) {
            skippedRows++;
            if (!rowErrors.length) {
              rowErrors.push(`Row ${index + 1}: Missing date column mapping`);
            }
            continue;
          }
          const normalized = activeProfile.normalizeRow(mappedRow, mainCurrency);
          if (normalized) {
            intermediate.push(normalized);
          } else {
            skippedRows++;
          }
        } catch (rowError) {
          const message = rowError instanceof Error ? rowError.message : "Unknown error";
          if (!rowErrors.length) {
            rowErrors.push(`Row ${index + 1}: ${message}`);
          }
          skippedRows++;
        }
      }

      const finalizedRows = finalizeProfileRows(intermediate, activeProfile, mainCurrency);

      if (!finalizedRows.length) {
        const emptyResult: ImportResult = {
          successCount: 0,
          errorCount: skippedRows || processedRows.length,
          newCategories: 0,
          newAccounts: 0,
          newAccountNames: [],
          newCategoryNames: [],
          skippedRows: skippedRows || processedRows.length,
          skippedDetails: rowErrors,
          errorDetails: [],
          errorStats: {},
          processedRows: 0,
        };
        setImportResult(emptyResult);
        toast({
          variant: "destructive",
          title: "Import aborted",
          description: "No valid rows found in the CSV file.",
        });
        return;
      }

      if (rowErrors.length) {
        toast({
          variant: "destructive",
          title: "Some rows were skipped",
          description: rowErrors.slice(0, 2).join(" | "),
        });
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
          profileId: activeProfile.id,
          rows: finalizedRows,
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
        newAccountNames: summary.newAccountNames ?? [],
        newCategoryNames: summary.newCategoryNames ?? [],
        errorDetails: summary.errorDetails ?? [],
        errorStats: summary.errorStats ?? {},
        processedRows: summary.processedRows ?? finalizedRows.length,
        skippedRows,
        skippedDetails: rowErrors,
      };

      setImportResult(combinedResult);
      setStep(3);
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

  const handleDownloadErrorReport = React.useCallback(() => {
    if (!importResult) return;
    const serverErrors = importResult.errorDetails ?? [];
    const clientErrors = importResult.skippedDetails ?? [];
    if (!serverErrors.length && !clientErrors.length) return;

    const rows: string[] = ['source,rowIndex,code,message,details'];
    const pushRow = (source: string, rowIndex: string, code: string, message: string, details: string) => {
      rows.push(
        [source, rowIndex, code, message, details].map((value) => escapeCsvValue(value)).join(','),
      );
    };

    serverErrors.forEach((detail) => {
      const info = detail.rowSample ? JSON.stringify(detail.rowSample) : '';
      pushRow(
        'server',
        detail.rowIndex != null ? String(detail.rowIndex) : '',
        detail.code ?? 'unknown',
        detail.message,
        info,
      );
    });

    clientErrors.forEach((message, index) => {
      pushRow('client', '', `mapping-${index + 1}`, message, '');
    });

    if (rows.length <= 1) return;
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `import-errors-${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [importResult]);

  React.useEffect(() => {
    if (!previewData.length) {
      setNormalizedPreview([]);
      setPreviewError(null);
      return;
    }
    const items: (NormalizedImportRow | TransferStub)[] = [];
    for (let i = 0; i < Math.min(previewData.length, 5); i++) {
      const row = previewData[i];
      const mappedRow = mapRowWithMapping(row, columnMapping);
      if (!mappedRow.date) {
        setPreviewError("Map a column to 'date' to see normalized preview.");
        setNormalizedPreview([]);
        return;
      }
      try {
        const normalized = activeProfile.normalizeRow(mappedRow, (mainCurrency as Currency) || "USD");
        if (normalized) {
          items.push(normalized);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setPreviewError(`Row ${i + 1}: ${message}`);
        setNormalizedPreview([]);
        return;
      }
    }
    setPreviewError(null);
    const finalizedPreview = finalizeProfileRows(items, activeProfile, mainCurrency as Currency);
    setNormalizedPreview(finalizedPreview);
  }, [previewData, columnMapping, mainCurrency, activeProfile]);
  
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
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 p-2 text-sm border rounded-md bg-muted/50">
                      <span className="font-medium">{file.name}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={resetState}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
               <div className="space-y-4">
                 <div className="grid grid-cols-1 gap-2 md:grid-cols-[240px_1fr]">
                   <div className="space-y-1">
                    <Label>Import preset</Label>
                    <Select
                      value={activeProfile.id}
                       onValueChange={(value) => {
                         const nextProfile = getImportProfile(value);
                         setProfileId(nextProfile.id);
                         if (typeof window !== "undefined") {
                           localStorage.setItem(PRESET_STORAGE_KEY, nextProfile.id);
                         }
                         setColumnMapping({});
                         setNormalizedPreview([]);
                       }}
                     >
                       <SelectTrigger>
                         <SelectValue placeholder="Select preset" />
                       </SelectTrigger>
                       <SelectContent>
                         {importProfiles.map((item) => (
                           <SelectItem key={item.id} value={item.id}>
                             {item.label}
                           </SelectItem>
                         ))}
                       </SelectContent>
                     </Select>
                     <p className="text-xs text-muted-foreground">
                       Preset determines default column mapping and parsing rules.
                     </p>
                   </div>
                 </div>
                  <h3 className="text-base font-medium mb-2">Column Mapping</h3>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-muted-foreground">Mapping is saved automatically for the next upload.</p>
                    <Button variant="outline" size="sm" onClick={() => initializeMapping(headers, { force: true })}>
                      Auto map
                    </Button>
                  </div>
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
                              {(activeProfile.fields ?? DEFAULT_FIELDS).map(field => (
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
                <div>
                  <h3 className="text-base font-medium mb-2">Normalized Preview</h3>
                  {previewError ? (
                    <Alert variant="destructive">
                      <AlertTitle>Cannot build preview</AlertTitle>
                      <AlertDescription>{previewError}</AlertDescription>
                    </Alert>
                  ) : normalizedPreview.length ? (
                    <div className="relative w-full overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Details</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {normalizedPreview.map((row, index) => {
                            const date = new Date(row.date);
                            const details =
                              row.transactionType === "transfer"
                                ? `${row.fromAccountName ?? "—"} → ${row.toAccountName ?? "—"}`
                                : `${row.accountName ?? "—"}${row.categoryName ? ` (${row.categoryName})` : ""}`;
                            const amountDisplay =
                              row.transactionType === "transfer"
                                ? `${row.amountSent ?? 0} ${row.fromAccountCurrency ?? mainCurrency} → ${
                                    row.amountReceived ?? 0
                                  } ${row.toAccountCurrency ?? mainCurrency}`
                                : `${row.amount ?? 0} ${row.accountCurrency ?? mainCurrency}`;
                              return (
                              <TableRow key={index}>
                                <TableCell>{formatDateLabel(date)}</TableCell>
                                <TableCell className="capitalize">{row.transactionType}</TableCell>
                                <TableCell>{details}</TableCell>
                                <TableCell className="text-right font-medium">{amountDisplay}</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Map the required columns to see how rows will be imported.
                    </p>
                  )}
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
      case 3: {
        const serverErrorDetails = importResult?.errorDetails ?? [];
        const serverErrorStatsEntries = Object.entries(importResult?.errorStats ?? {});
        const totalServerErrors =
          serverErrorStatsEntries.reduce((sum, [, count]) => sum + Number(count ?? 0), 0) ||
          serverErrorDetails.length;
        const hasServerErrors = serverErrorDetails.length > 0;
        const hasClientMappingErrors = (importResult?.skippedDetails?.length ?? 0) > 0;
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
                      <div className="space-y-6 text-left">
                        <div className="flex flex-col items-center gap-2 text-center">
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/50">
                            <Check className="h-6 w-6 text-green-600 dark:text-green-400" />
                          </div>
                          <h3 className="text-lg font-semibold">Import Complete</h3>
                          <p className="text-sm text-muted-foreground">
                            Processed {importResult.successCount + importResult.errorCount} rows.
                          </p>
                        </div>
                        {hasClientMappingErrors && !hasServerErrors && (
                          <div className="flex justify-end">
                            <Button variant="outline" size="sm" onClick={handleDownloadErrorReport}>
                              Download error report
                            </Button>
                          </div>
                        )}
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="rounded-md border p-4 space-y-1">
                            <p className="text-sm text-muted-foreground">Successfully imported</p>
                            <p className="text-2xl font-semibold">{importResult.successCount}</p>
                          </div>
                          <div className="rounded-md border p-4 space-y-1">
                            <p className="text-sm text-muted-foreground">Skipped rows</p>
                            <p className="text-2xl font-semibold">{importResult.errorCount}</p>
                          </div>
                          <div className="rounded-md border p-4 space-y-1">
                            <p className="text-sm text-muted-foreground">New categories</p>
                            <p className="text-2xl font-semibold">{importResult.newCategories}</p>
                          </div>
                          <div className="rounded-md border p-4 space-y-1">
                            <p className="text-sm text-muted-foreground">New accounts</p>
                            <p className="text-2xl font-semibold">{importResult.newAccounts}</p>
                          </div>
                        </div>
                        {hasServerErrors && (
                          <div className="rounded-md border p-4 space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <h4 className="font-medium">Server-side errors</h4>
                                <p className="text-sm text-muted-foreground">
                                  Showing first {Math.min(serverErrorDetails.length, 5)} of {totalServerErrors}.
                                </p>
                              </div>
                              <Button variant="outline" size="sm" onClick={handleDownloadErrorReport}>
                                Download report
                              </Button>
                            </div>
                            <ul className="space-y-2 text-sm">
                              {serverErrorDetails.slice(0, 5).map((detail, index) => (
                                <li key={`${detail.rowIndex}-${detail.code}-${index}`} className="rounded-md bg-muted/50 p-3">
                                  <p className="font-semibold">
                                    Row {detail.rowIndex} · {detail.code}
                                  </p>
                                  <p className="text-muted-foreground">{detail.message}</p>
                                  {detail.rowSample && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                      {detail.rowSample.transactionType} ·{' '}
                                      {detail.rowSample.accountName ??
                                        detail.rowSample.fromAccountName ??
                                        detail.rowSample.toAccountName ??
                                        '—'}
                                    </p>
                                  )}
                                </li>
                              ))}
                            </ul>
                            {serverErrorStatsEntries.length > 0 && (
                              <div className="text-xs text-muted-foreground">
                                {serverErrorStatsEntries.map(([code, count]) => (
                                  <span key={code} className="mr-3">
                                    {code}: {count}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        {(importResult.newCategoryNames?.length ?? 0) > 0 && (
                          <div>
                            <h4 className="font-medium">Created categories</h4>
                            <p className="text-sm text-muted-foreground mb-2">
                              These categories were generated automatically:
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {importResult.newCategoryNames!.map((name) => (
                                <span key={name} className="rounded-full border px-3 py-1 text-sm">
                                  {name}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {(importResult.newAccountNames?.length ?? 0) > 0 && (
                          <div>
                            <h4 className="font-medium">Created accounts</h4>
                            <p className="text-sm text-muted-foreground mb-2">
                              Review them on the Accounts page to adjust icons/colors.
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {importResult.newAccountNames!.map((name) => (
                                <span key={name} className="rounded-full border px-3 py-1 text-sm">
                                  {name}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {importResult.skippedDetails.length > 0 && (
                          <div className="rounded-md border p-4">
                            <h4 className="font-medium">Skipped rows</h4>
                            <p className="text-sm text-muted-foreground mb-2">
                              {importResult.skippedRows} rows were skipped. Fix the issues below and re-import if needed.
                            </p>
                            <ul className="list-disc pl-4 space-y-1 text-sm">
                              {importResult.skippedDetails.slice(0, 5).map((issue, index) => (
                                <li key={index}>{issue}</li>
                              ))}
                              {importResult.skippedDetails.length > 5 && (
                                <li>…and {importResult.skippedDetails.length - 5} more.</li>
                              )}
                            </ul>
                          </div>
                        )}
                        {(importResult.newCategories > 0 || importResult.newAccounts > 0) && (
                          <Alert className="text-left">
                            <Info className="h-4 w-4" />
                            <AlertTitle>Next steps</AlertTitle>
                            <AlertDescription>
                              Customize newly created categories and accounts or jump to the transactions page to review imported entries.
                              <div className="mt-3 flex flex-wrap gap-2">
                                {importResult.newCategories > 0 && (
                                  <Button asChild variant="outline" size="sm">
                                    <Link href="/categories">Open Categories</Link>
                                  </Button>
                                )}
                                {importResult.newAccounts > 0 && (
                                  <Button asChild variant="outline" size="sm">
                                    <Link href="/accounts">Open Accounts</Link>
                                  </Button>
                                )}
                                <Button asChild variant="outline" size="sm">
                                  <Link href="/transactions">View Transactions</Link>
                                </Button>
                              </div>
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
                  ) : error ? (
                      <Alert variant="destructive">
                          <AlertTitle>Import Failed</AlertTitle>
                          <AlertDescription>{error}</AlertDescription>
                      </Alert>
                  ) : null}
              </div>
             </CardContent>
              <CardFooter className="flex flex-wrap gap-2 justify-between">
                <Button asChild variant="outline">
                  <Link href="/transactions">Go to Transactions</Link>
                </Button>
                <Button type="button" onClick={resetState}>
                  Start New Import
                </Button>
              </CardFooter>
          </Card>
        );
      }
      default:
        return null;
    }
  }

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
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

    
