
"use client"

import * as React from "react"
import { Upload, FileUp, X, Check, ChevronsUpDown } from "lucide-react"
import Papa from "papaparse"

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
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { Alert, AlertDescription, AlertTitle } from "./ui/alert"

// The fields we can map to in our transaction object
const transactionFields = [
    { value: "date", label: "Date" },
    { value: "description", label: "Description" },
    { value: "amount", label: "Amount" },
    { value: "categoryName", label: "Category" },
    { value: "accountName", label: "Account" },
    { value: "transactionType", label: "Type (income/expense)" },
];


export function ImportTransactionsDialog() {
  const [open, setOpen] = React.useState(false)
  const [step, setStep] = React.useState(1);
  const [file, setFile] = React.useState<File | null>(null);
  const [headers, setHeaders] = React.useState<string[]>([]);
  const [previewData, setPreviewData] = React.useState<Record<string, string>[]>([]);
  const [columnMapping, setColumnMapping] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const { toast } = useToast();

  const resetState = () => {
    setFile(null);
    setHeaders([]);
    setPreviewData([]);
    setColumnMapping({});
    setError(null);
    setStep(1);
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
          const lowerHeader = header.toLowerCase();
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
            Импортировать транзакции
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Импорт транзакций</DialogTitle>
          <DialogDescription>
            {step === 1 && "Шаг 1: Загрузите CSV-файл для импорта."}
            {step === 2 && "Шаг 2: Сопоставьте столбцы файла с полями транзакций и проверьте данные."}
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
                        <span className="font-semibold">Нажмите, чтобы загрузить</span> или перетащите файл
                    </p>
                    <p className="text-xs text-muted-foreground">CSV (до 5 МБ)</p>
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
                        <AlertTitle>Ошибка</AlertTitle>
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
                  <h3 className="text-lg font-medium mb-2">Сопоставление столбцов</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Укажите, какому полю транзакции соответствует каждый столбец из вашего файла.
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
                            <SelectValue placeholder="Выбрать поле..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ignore">Пропустить</SelectItem>
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
                   <h3 className="text-lg font-medium mb-2">Предварительный просмотр данных (первые 5 строк)</h3>
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


        <DialogFooter>
          {step === 1 && (
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                Отмена
            </Button>
          )}
          {step === 2 && (
            <>
              <Button type="button" variant="secondary" onClick={() => setStep(1)}>
                Назад
              </Button>
              <Button type="button">
                Импортировать
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
