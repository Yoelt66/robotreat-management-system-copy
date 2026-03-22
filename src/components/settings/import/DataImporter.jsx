import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { FileDown, Upload, Loader2 } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { Progress } from '@/components/ui/progress';

// Helper function to download CSV template
const downloadCSVTemplate = (headers, filename) => {
    let csvContent = "\uFEFF"; // BOM for Excel to recognize UTF-8
    csvContent += headers.join(",");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

export default function DataImporter({
    title,
    description,
    entityName,
    templateHeaders,
    templateDisplayHeaders,
    requiredFields,
    mapRowToEntity,
    preImportTask,
    entityCreateFn,
    icon
}) {
    const [file, setFile] = useState(null);
    const [isImporting, setIsImporting] = useState(false);
    const [progress, setProgress] = useState(0);
    const [logs, setLogs] = useState([]);
    const fileInputRef = useRef(null);

    const handleFileChange = (e) => {
        setFile(e.target.files[0] || null);
        setLogs([]);
    };
    
    const addLog = (message, type = 'info') => {
        setLogs(prev => [...prev, { message, type, time: new Date().toLocaleTimeString() }]);
    };

    const handleImport = async () => {
        if (!file) {
            toast({ variant: 'destructive', title: 'לא נבחר קובץ' });
            return;
        }

        setIsImporting(true);
        setProgress(0);
        setLogs([]);
        addLog(`מתחיל ייבוא עבור: ${title}`, 'info');

        try {
            addLog('מכין נתונים מקדימים...', 'info');
            const preImportData = preImportTask ? await preImportTask() : {};
            addLog('איסוף נתונים מקדימים הושלם.', 'info');
            
            // Parse file using SheetJS - supports xlsx, xls, csv, tsv, txt
            addLog('קורא קובץ...', 'info');
            const arrayBuffer = await file.arrayBuffer();
            const workbook = XLSX.read(arrayBuffer, { type: 'array', codepage: 65001 });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const allRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: null });

            // Skip header row (index 0)
            const dataRows = [];
            for (let i = 1; i < allRows.length; i++) {
                const row = allRows[i];
                if (!row || row.every(cell => cell === null || cell === undefined || String(cell).trim() === '')) continue;
                dataRows.push(row.map(cell => {
                    if (cell === null || cell === undefined) return null;
                    const str = String(cell).trim();
                    return str === '' ? null : str;
                }));
            }

            if (dataRows.length === 0) {
                throw new Error("הקובץ ריק או מכיל רק שורת כותרת.");
            }

            addLog(`נמצאו ${dataRows.length} שורות לייבוא.`, 'info');
            
            const entitiesToCreate = [];
            let failedRows = 0;

            for (let i = 0; i < dataRows.length; i++) {
                try {
                    const rowArray = dataRows[i];
                    
                    const missingFields = [];
                    for (const field of requiredFields) {
                        const index = templateHeaders.indexOf(field);
                        if (index === -1 || !rowArray[index]) {
                            missingFields.push(templateDisplayHeaders?.[index] || field);
                        }
                    }
                    if (missingFields.length > 0) {
                        throw new Error(`חסרים שדות חובה: ${missingFields.join(', ')}`);
                    }
                    
                    const entity = mapRowToEntity(rowArray, preImportData);
                    entitiesToCreate.push(entity);
                } catch (rowError) {
                    addLog(`שורה ${i + 2}: ${rowError.message}`, 'error');
                    failedRows++;
                }
            }

            addLog(`עיבוד הקובץ הושלם: ${entitiesToCreate.length} שורות תקינות, ${failedRows} שורות עם שגיאות.`, 'info');
            
            if (entitiesToCreate.length === 0) {
                addLog('לא נמצאו רשומות תקינות לייבוא. הייבוא בוטל.', failedRows > 0 ? 'error' : 'warning');
                toast({
                    variant: failedRows > 0 ? "destructive" : "default",
                    title: "הייבוא הסתיים",
                    description: "לא נמצאו רשומות תקינות לעיבוד."
                });
                setIsImporting(false);
                return;
            }
            
            addLog(`מתחיל העלאה לשרת של ${entitiesToCreate.length} רשומות...`, 'info');
            
            const batchSize = 50;
            let successCount = 0;
            for (let i = 0; i < entitiesToCreate.length; i += batchSize) {
                const batch = entitiesToCreate.slice(i, i + batchSize);
                await entityCreateFn(batch);
                successCount += batch.length;
                setProgress((i + batch.length) / entitiesToCreate.length * 100);
                addLog(`הועלו ${successCount} / ${entitiesToCreate.length} רשומות...`, 'info');
            }

            addLog(`הייבוא הושלם! ${successCount} רשומות חדשות נוצרו.`, 'success');
            toast({ title: 'הייבוא הושלם בהצלחה!' });
            
        } catch (error) {
            console.error("Import error:", error);
            addLog(`שגיאה בתהליך הייבוא: ${error.message}`, 'error');
            toast({ variant: 'destructive', title: 'שגיאה בייבוא', description: error.message, duration: 8000 });
        } finally {
            setIsImporting(false);
            setFile(null);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const downloadHeaders = templateDisplayHeaders || templateHeaders;

    return (
        <Card className="h-full flex flex-col">
            <CardHeader>
                <div className="flex items-center gap-3">
                    {icon && React.createElement(icon, { className: "h-6 w-6 text-gray-600" })}
                    <div>
                        <CardTitle>{title}</CardTitle>
                        {description && <CardDescription>{description}</CardDescription>}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4 flex-grow">
                <div className="flex flex-col sm:flex-row gap-4">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv,.txt,.tsv,.xlsx,.xls"
                        onChange={handleFileChange}
                        disabled={isImporting}
                        className="flex-grow text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 border border-input rounded-md px-3 py-1.5 cursor-pointer"
                    />
                    <Button 
                        variant="outline" 
                        onClick={() => downloadCSVTemplate(downloadHeaders, `${entityName}_template.csv`)}
                        className="flex-shrink-0"
                    >
                        <FileDown className="h-4 w-4 ml-2" />
                        הורד תבנית
                    </Button>
                </div>
                <p className="text-xs text-muted-foreground">סוגי קבצים נתמכים: Excel (.xlsx/.xls), CSV, טקסט עם טאב (.txt/.tsv)</p>
                <Button onClick={handleImport} disabled={!file || isImporting} className="w-full">
                    {isImporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 ml-2" />}
                    {isImporting ? 'מייבא...' : 'התחל ייבוא'}
                </Button>
            </CardContent>
            {(isImporting || logs.length > 0) && (
                <CardFooter>
                    <div className="w-full space-y-2">
                        {isImporting && <Progress value={progress} className="w-full" />}
                        {logs.length > 0 && (
                            <div className="w-full max-h-48 overflow-y-auto bg-gray-900 text-white p-3 rounded-md text-xs space-y-1 font-mono">
                                {logs.map((log, i) => (
                                    <p key={i} className={`flex items-start gap-2 ${log.type === 'error' ? 'text-red-400' : log.type === 'success' ? 'text-green-400' : log.type === 'warning' ? 'text-yellow-400' : 'text-gray-300'}`}>
                                        <span className="flex-shrink-0">{log.time}</span>
                                        <span className="flex-grow">{log.message}</span>
                                    </p>
                                ))}
                            </div>
                        )}
                    </div>
                </CardFooter>
            )}
        </Card>
    );
}