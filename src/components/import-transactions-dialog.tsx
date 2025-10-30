
"use client"

import * as React from "react"
import { Upload, FileUp, X } from "lucide-react"
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
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { Alert, AlertDescription, AlertTitle } from "./ui/alert"

export function ImportTransactionsDialog() {
  const [open, setOpen] = React.useState(false)
  const [step, setStep] = React.useState(1);
  const [file, setFile] = React.useState<File | null>(null);
  const [headers, setHeaders] = React.useState<string[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const { toast } = useToast();

  const resetState = () => {
    setFile(null);
    setHeaders([]);
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
      preview: 1,
      complete: (results) => {
        if (results.meta.fields) {
            setHeaders(results.meta.fields);
            setStep(2);
        } else {
            setError("Could not parse CSV headers. Make sure the file is a valid CSV with a header row.");
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
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Импорт транзакций</DialogTitle>
          <DialogDescription>
            {step === 1 && "Шаг 1: Загрузите CSV-файл для импорта."}
            {step === 2 && "Шаг 2: Сопоставьте столбцы файла с полями транзакций."}
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
             <div className="py-4 space-y-4">
                {file && (
                     <div className="flex items-center justify-between p-2 text-sm border rounded-md bg-muted/50">
                        <span className="font-medium">{file.name}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={resetState}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                )}
                <p className="text-muted-foreground">
                    Функциональность сопоставления полей будет реализована на следующем шаге.
                </p>
                <div className="space-y-2">
                    <h4 className="font-medium">Обнаруженные заголовки:</h4>
                    <div className="flex flex-wrap gap-2">
                        {headers.map(header => (
                            <span key={header} className="px-2 py-1 text-xs rounded-md bg-secondary text-secondary-foreground">
                                {header}
                            </span>
                        ))}
                    </div>
                </div>
             </div>
        )}


        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
            Отмена
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
