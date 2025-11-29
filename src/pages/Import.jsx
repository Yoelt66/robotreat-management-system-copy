import React, { useState, useEffect } from "react";
import { Part, Warehouse, Category, Currency, ImportMapping } from "@/entities/all";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/components/ui/use-toast";
import { Upload, Settings, CheckCircle, Loader2, Info, ChevronDown, AlertCircle, File, Terminal } from "lucide-react";
import ImportFieldMapping from "../components/import/ImportFieldMapping";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const MAX_RETRIES = 3;
const UPDATE_BATCH_SIZE = 30; // Further decreased for stability
const DELAY_BETWEEN_BATCHES = 1000; // Increased delay to 1 second
const PREVIEW_ROWS = 10; // Show only first 10 rows in preview
const CONCURRENCY_LIMIT = 5; // Process 5 updates at a time to avoid rate limits

async function apiCallWithRetry(apiCall, retries, callName) {
  for (let i = 0; i < retries; i++) {
    try {
      const result = await apiCall();
      await new Promise(resolve => setTimeout(resolve, 200)); // Small delay between calls
      return result;
    } catch (error) {
      console.error(`API call failed attempt ${i + 1}/${retries} for ${callName}:`, error);
      
      if (error.message && error.message.includes('429')) {
        const waitTime = Math.min(2000 * Math.pow(2, i), 15000); // Increased max wait time
        console.log(`Rate limit hit, waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
      
      if (i === retries - 1) throw new Error(`Failed to load ${callName} after ${retries} attempts: ${error.message}`);
    }
  }
}

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function ChangeDetectionModal({ detectedChanges, onConfirm, onCancel, onToggleUpdate }) {
  const getChangeDisplay = (change) => {
    const changeTypes = {
      new: { label: "פריט חדש", className: "bg-green-100 text-green-800" },
      update: { label: "עדכון קיים", className: "bg-blue-100 text-blue-800" },
      stock_only: { label: "עדכון מלאי בלבד", className: "bg-yellow-100 text-yellow-800" },
      no_change: { label: "ללא שינוי", className: "bg-gray-100 text-gray-800" }
    };
    return changeTypes[change.type] || changeTypes.no_change;
  };

  const totalChanges = detectedChanges.filter(c => c.shouldUpdate).length;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" dir="rtl">
      <div className="bg-white rounded-lg max-w-6xl w-full m-4 max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b">
          <h2 className="text-xl font-bold">בדיקת שינויים לפני ייבוא</h2>
          <p className="text-gray-600 mt-2">נמצאו {detectedChanges.length} פריטים. בחר אילו שינויים לבצע:</p>
        </div>
        
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <div className="mb-4 flex gap-4 items-center">
            <span className="font-medium">סה"כ שינויים שנבחרו: {totalChanges}</span>
            <Button size="sm" variant="outline" onClick={() => {
              detectedChanges.forEach((change, index) => {
                if (change.type !== 'no_change') { // Only select if there's an actual change
                  onToggleUpdate(index, true);
                }
              });
            }}>
              בחר הכל
            </Button>
            <Button size="sm" variant="outline" onClick={() => {
              detectedChanges.forEach((_, index) => onToggleUpdate(index, false));
            }}>
              בטל הכל
            </Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">בחר</TableHead>
                <TableHead>מק"ט</TableHead>
                <TableHead>שם פריט</TableHead>
                <TableHead>סוג שינוי</TableHead>
                <TableHead>שינויים</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detectedChanges.slice(0, 100).map((change, index) => (
                <TableRow key={change.sku} className={!change.shouldUpdate ? 'opacity-50' : ''}>
                  <TableCell>
                    <Checkbox
                      checked={change.shouldUpdate}
                      onCheckedChange={(checked) => onToggleUpdate(index, checked)}
                      disabled={change.type === 'no_change'}
                    />
                  </TableCell>
                  <TableCell className="font-mono">{change.sku}</TableCell>
                  <TableCell>{change.name}</TableCell>
                  <TableCell>
                    <Badge className={getChangeDisplay(change).className}>
                      {getChangeDisplay(change).label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {change.changes && change.changes.length > 0 ? (
                      <div className="space-y-1">
                        {change.changes.slice(0, 3).map((ch, idx) => (
                          <div key={idx} className="text-sm">
                            <span className="font-medium">{ch.field}:</span>
                            <span className="text-red-600"> {ch.old}</span>
                            <span> → </span>
                            <span className="text-green-600">{ch.new}</span>
                          </div>
                        ))}
                        {change.changes.length > 3 && (
                          <div className="text-xs text-gray-500">ועוד {change.changes.length - 3} שינויים...</div>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-500">ללא שינויים</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {detectedChanges.length > 100 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-gray-500">
                    מוצגות 100 שורות ראשונות מתוך {detectedChanges.length}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="p-6 border-t flex justify-end gap-3">
          <Button variant="outline" onClick={onCancel}>
            ביטול
          </Button>
          <Button onClick={onConfirm} disabled={totalChanges === 0}>
            בצע ייבוא ({totalChanges} פריטים)
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function Import() {
  const [data, setData] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [fieldMapping, setFieldMapping] = useState([]);
  const [progress, setProgress] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const [logs, setLogs] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [referenceData, setReferenceData] = useState({ categories: [], warehouses: [], currencies: [] });
  const [loading, setLoading] = useState(true);
  const [savedMappings, setSavedMappings] = useState([]);
  const [selectedMapping, setSelectedMapping] = useState(null);
  
  // File upload states
  const [isFileUploading, setIsFileUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  
  // Change detection states
  const [detectedChanges, setDetectedChanges] = useState([]);
  const [showChangeDetection, setShowChangeDetection] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // New state for header detection
  const [hasHeaders, setHasHeaders] = useState(true);
  const [debugInfo, setDebugInfo] = useState(""); // New state for debug info

  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      try {
        const [categories, warehouses, currencies, mappings] = await Promise.all([
          apiCallWithRetry(() => Category.list(), MAX_RETRIES, "Category.list"),
          apiCallWithRetry(() => Warehouse.list(), MAX_RETRIES, "Warehouse.list"),
          apiCallWithRetry(() => Currency.list(), MAX_RETRIES, "Currency.list"),
          apiCallWithRetry(() => ImportMapping.list(), MAX_RETRIES, "ImportMapping.list")
        ]);
        
        const safeWarehouses = warehouses || [];
        
        setReferenceData({
          categories: categories || [],
          warehouses: safeWarehouses,
          currencies: currencies || []
        });

        setSavedMappings(mappings || []);

        const defaultMapping = mappings?.find(m => m.is_default) || mappings?.[0] || null;
        
        if (defaultMapping) {
          setSelectedMapping(defaultMapping);
          setFieldMapping(Array.isArray(defaultMapping.mapping) ? defaultMapping.mapping : []);
        } else {
          const initialMapping = getInitialFieldMapping(safeWarehouses);
          setFieldMapping(initialMapping);
        }

      } catch (error) {
        console.error("Error loading initial data for import page:", error);
        toast({
          variant: "destructive",
          title: "שגיאה בטעינת נתונים",
          description: "לא ניתן היה לטעון הגדרות ייבוא שמורות.",
        });
      } finally {
        setLoading(false);
      }
    };
    
    loadInitialData();
  }, []);

  const getInitialFieldMapping = (warehouses = []) => {
    const baseFields = [
      { key: 'sku', label: 'מקט', checked: true, is_required: true },
      { key: 'name', label: 'שם פריט', checked: true, is_required: true },
      { key: 'category', label: 'קטגוריה', checked: true, is_required: false },
      { key: 'unit', label: 'יחידת מידה', checked: true, is_required: false },
      { key: 'minimum_stock', label: 'מלאי מינימום', checked: true, is_required: false },
      { key: 'notes', label: 'הערות', checked: true, is_required: false },
      { key: 'cost_price', label: 'מחיר עלות', checked: true, is_required: false },
      { key: 'current_location', label: 'מיקום נוכחי', checked: false, is_required: false },
      { key: 'supplier_part_number', label: 'מקט אצל ספק', checked: false, is_required: false },
      { key: 'replaced_sku', label: 'מקט חלופי', checked: false, is_required: false },
      { key: 'supplier_number', label: 'מספר ספק', checked: false, is_required: false },
      { key: 'cost_currency', label: 'מטבע עלות', checked: false, is_required: false },
      { key: 'sale_currency', label: 'מטבע מכירה', checked: false, is_required: false },
      { key: 'import_percentage', label: 'אחוז ייבוא', checked: false, is_required: false },
      { key: 'markup_percentage', label: 'אחוז רווח', checked: false, is_required: false },
      { key: 'exchange_rate', label: 'שער חליפין', checked: false, is_required: false },
    ];
  
    const warehouseFields = warehouses.map(wh => ({
      key: `${wh.warehouse_id}`, 
      label: `מלאי: ${wh.name}`, 
      checked: false, 
      is_required: false 
    }));
  
    const combinedFields = [...baseFields, ...warehouseFields];
    
    let columnCounter = 1;
    return combinedFields.map(field => {
      if (field.checked) {
        return { ...field, column: columnCounter++ };
      }
      return { ...field, column: '' };
    });
  };

  const addLog = (message, type = "info") => {
    setLogs(prev => [...prev, { message, type, timestamp: new Date() }]);
  };

  const parseCSV = (text, hasHeaders, delimiter = ',') => {
    const lines = text.trim().split(/\r\n|\n/);
    if (lines.length === 0) return [];
  
    const splitLine = (line, delim) => {
        const result = [];
        let inQuote = false;
        let currentField = '';
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                inQuote = !inQuote;
            } else if (char === delim && !inQuote) {
                result.push(currentField.trim());
                currentField = '';
            } else {
                currentField += char;
            }
        }
        result.push(currentField.trim()); // Add the last field
        return result;
    };

    const data = [];
    const startIndex = hasHeaders ? 1 : 0; // Skip first line if it has headers

    for (let i = startIndex; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      
      const values = splitLine(lines[i], delimiter);
      data.push(values.map(v => v.replace(/"/g, ''))); // Store as array of strings, remove quotes
    }
    return data;
  };

  const parseExcel = async (file) => {
    // Read the Excel file using a simple approach
    const arrayBuffer = await file.arrayBuffer();
    const workbook = await parseXLSX(arrayBuffer);
    return workbook;
  };

  const parseXLSX = async (arrayBuffer) => {
    // Simple XLSX parser - reads first sheet
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(arrayBuffer);
    
    // Get shared strings
    const sharedStringsFile = zip.file('xl/sharedStrings.xml');
    let sharedStrings = [];
    if (sharedStringsFile) {
      const sharedStringsXml = await sharedStringsFile.async('string');
      const siMatches = sharedStringsXml.match(/<si>[\s\S]*?<\/si>/g) || [];
      sharedStrings = siMatches.map(si => {
        const tMatch = si.match(/<t[^>]*>([^<]*)<\/t>/);
        return tMatch ? tMatch[1] : '';
      });
    }
    
    // Get first sheet
    const sheet1File = zip.file('xl/worksheets/sheet1.xml');
    if (!sheet1File) throw new Error('לא נמצא גיליון בקובץ Excel');
    
    const sheetXml = await sheet1File.async('string');
    const rows = [];
    
    // Parse rows
    const rowMatches = sheetXml.match(/<row[^>]*>[\s\S]*?<\/row>/g) || [];
    
    for (const rowXml of rowMatches) {
      const cellMatches = rowXml.match(/<c[^>]*>[\s\S]*?<\/c>|<c[^\/]*\/>/g) || [];
      const rowData = [];
      let maxCol = 0;
      
      for (const cellXml of cellMatches) {
        // Get cell reference (e.g., "A1", "B2")
        const refMatch = cellXml.match(/r="([A-Z]+)(\d+)"/);
        if (!refMatch) continue;
        
        const colLetter = refMatch[1];
        const colIndex = colLetter.split('').reduce((acc, char) => acc * 26 + char.charCodeAt(0) - 64, 0) - 1;
        
        // Fill empty cells
        while (rowData.length < colIndex) {
          rowData.push('');
        }
        
        // Get cell value
        let value = '';
        const valueMatch = cellXml.match(/<v>([^<]*)<\/v>/);
        
        if (valueMatch) {
          const isSharedString = cellXml.includes('t="s"');
          if (isSharedString) {
            const stringIndex = parseInt(valueMatch[1]);
            value = sharedStrings[stringIndex] || '';
          } else {
            value = valueMatch[1];
          }
        }
        
        rowData[colIndex] = value;
        maxCol = Math.max(maxCol, colIndex);
      }
      
      // Fill remaining empty cells
      while (rowData.length <= maxCol) {
        rowData.push('');
      }
      
      if (rowData.some(cell => cell !== '')) {
        rows.push(rowData);
      }
    }
    
    return rows;
  };
  
  const processParsedData = (dataRows) => {
    if (!Array.isArray(dataRows) || dataRows.length === 0) {
        throw new Error("No data rows found after parsing.");
    }
    
    // The data is now an array of arrays. Map it based on the column configuration from Step 1.
    // Sort fieldMapping once to use consistently
    const sortedFieldMapping = fieldMapping
        .filter(field => field.checked)
        .sort((a, b) => (a.column || Infinity) - (b.column || Infinity));

    const processedData = dataRows.map(rowValues => {
        return sortedFieldMapping.map(field => {
            const colIndex = field.column - 1; // field.column is 1-based
            return colIndex >= 0 && colIndex < rowValues.length ? String(rowValues[colIndex] || '').trim() : '';
        });
    });

    // The headers for the preview table are derived from fieldMapping, not the file.
    const processedHeaders = sortedFieldMapping.map(field => field.label);

    setHeaders(processedHeaders);
    setData(processedData);
  };


  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setLogs([]); // Reset logs
    setDebugInfo(""); // Reset debug info
    addLog('מתחיל עיבוד קובץ חדש...', 'info');

    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({
        variant: "destructive",
        title: "קובץ גדול מדי",
        description: "גודל הקובץ חייב להיות קטן מ-50MB."
      });
      event.target.value = ''; // Clear the file input
      return;
    }

    setIsFileUploading(true);
    setUploadedFile(file);

    const fileName = file.name.toLowerCase();
    const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');
    const isTabDelimited = fileName.endsWith('.txt') || fileName.endsWith('.tsv');

    try {
      let parsedData;
      
      if (isExcel) {
        addLog('מזהה קובץ Excel, מנתח...', 'info');
        const allRows = await parseExcel(file);
        parsedData = hasHeaders ? allRows.slice(1) : allRows;
        addLog(`ניתוח Excel הסתיים, נמצאו ${parsedData.length} שורות נתונים.`, 'success');
      } else {
        // CSV or Tab-delimited text file
        const text = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result);
          reader.onerror = (e) => reject(new Error('שגיאה בקריאת הקובץ'));
          reader.readAsText(file, 'UTF-8');
        });
        
        addLog('קריאת הקובץ הסתיימה, מנתח תוכן...', 'success');
        
        const delimiter = isTabDelimited ? '\t' : ',';
        if (isTabDelimited) {
          addLog('מזהה קובץ עם הפרדת טאב...', 'info');
        }
        
        parsedData = parseCSV(text, hasHeaders, delimiter);
        addLog(`ניתוח הסתיים, נמצאו ${parsedData.length} שורות נתונים.`, 'success');
      }
      
      if (parsedData.length === 0) {
        throw new Error('הקובץ ריק או לא הכיל נתונים חוקיים.');
      }
      
      processParsedData(parsedData);
      
      toast({
        title: "הקובץ עובד בהצלחה",
        description: `זוהו ${parsedData.length} שורות.`
      });
      addLog(`עיבוד הקובץ הושלם.`, 'success');

    } catch (error) {
      console.error("שגיאה בניתוח הקובץ:", error);
      let errorMessage = error.message || "אירעה שגיאה לא ידועה.";
      addLog(`שגיאה בניתוח הקובץ: ${errorMessage}`, "error");
      toast({ variant: "destructive", title: "שגיאה בניתוח הקובץ", description: errorMessage });
    } finally {
      setIsFileUploading(false);
      event.target.value = '';
    }
  };
  
  const analyzeChanges = async () => {
    if (data.length === 0) {
      toast({
        variant: "destructive",
        title: "אין נתונים לניתוח",
        description: "יש לעבד נתונים תחילה.",
      });
      return;
    }
    if (!selectedMapping) {
      toast({
        variant: "destructive",
        title: "אין מיפוי עמודות",
        description: "יש לבחור תבנית מיפוי לפני ניתוח הנתונים.",
      });
      return;
    }

    setIsAnalyzing(true);
    addLog('מתחיל ניתוח שינויים...', 'info');

    try {
      // Load data in batches to avoid overwhelming the system
      addLog('טוען נתוני מערכת קיימים...', 'info');
      const [allParts, allCategories] = await Promise.all([
        apiCallWithRetry(() => Part.list(), MAX_RETRIES, "Part.list"),
        apiCallWithRetry(() => Category.list(), MAX_RETRIES, "Category.list").catch(() => [])
      ]);
      
      const partMap = new Map(allParts.map(p => [p.sku, p]));
      const categoryMap = new Map(allCategories.map(c => [c.code, c]));
      
      const changes = [];
      const batchSize = 100; // Process in smaller batches
      
      addLog(`מנתח ${data.length} שורות בקבוצות של ${batchSize}...`, 'info');

      for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);
        addLog(`מעבד קבוצה ${Math.floor(i / batchSize) + 1}/${Math.ceil(data.length / batchSize)}`, 'info');

        for (const row of batch) {
          const formattedRow = {};
          
          // Map row array to object based on the sorted fieldMapping
          const sortedActiveFields = fieldMapping
            .filter(field => field.checked)
            .sort((a, b) => (a.column || Infinity) - (b.column || Infinity));
            
          sortedActiveFields.forEach((field, index) => {
             let value = row[index]; // 'row' is now an array, and 'index' is its column index in the processed data.
              if (value === null || value === undefined || value === '') {
                value = null;
              } else if (typeof value === 'string') {
                value = value.trim();
                if (value === '') {
                  value = null;
                }
              }
              formattedRow[field.key] = value;
          });

          if (!formattedRow.sku) continue;

          // Apply category settings if category is specified
          if (formattedRow.category) {
            const categorySettings = categoryMap.get(formattedRow.category);
            if (categorySettings) {
              if (!formattedRow.supplier_number && categorySettings.supplier_number) {
                formattedRow.supplier_number = categorySettings.supplier_number;
              }
              
              if (!formattedRow.cost_currency && categorySettings.cost_currency) {
                formattedRow.cost_currency = categorySettings.cost_currency;
              }
              if (!formattedRow.sale_currency && categorySettings.sale_currency) {
                formattedRow.sale_currency = categorySettings.sale_currency;
              }
              
              if (formattedRow.import_percentage === undefined || formattedRow.import_percentage === null) {
                if (categorySettings.import_percentage !== undefined && categorySettings.import_percentage !== null) {
                  formattedRow.import_percentage = categorySettings.import_percentage;
                }
              }
              if (formattedRow.markup_percentage === undefined || formattedRow.markup_percentage === null) {
                if (categorySettings.margin_percentage !== undefined && categorySettings.margin_percentage !== null) {
                  formattedRow.markup_percentage = categorySettings.margin_percentage;
                }
              }
            }
          }

          const existingPart = partMap.get(formattedRow.sku);
          
          if (!existingPart) {
            // New item
            changes.push({
              sku: formattedRow.sku,
              name: formattedRow.name || 'לא מוגדר',
              type: 'new',
              shouldUpdate: true,
              changes: [{ field: 'סטטוס', old: 'לא קיים', new: 'פריט חדש' }],
              newData: formattedRow
            });
          } else {
            // Existing item - check for changes
            const itemChanges = [];
            
            // Check field changes
            const fieldsToCheck = ['name', 'category', 'unit', 'minimum_stock', 'notes', 'cost_price', 'current_location', 'supplier_part_number', 'replaced_sku', 'supplier_number', 'cost_currency', 'sale_currency', 'import_percentage', 'markup_percentage', 'exchange_rate'];
            
            fieldsToCheck.forEach(field => {
              if (formattedRow[field] !== undefined && formattedRow[field] !== null) {
                const oldValue = existingPart[field];
                const newValue = formattedRow[field];
                
                if (String(oldValue || '') !== String(newValue || '')) {
                  itemChanges.push({
                    field: field,
                    old: oldValue || 'ריק',
                    new: newValue || 'ריק'
                  });
                }
              }
            });

            // Check stock changes
            const allWarehouses = referenceData.warehouses;
            const stockChanges = [];
            
            allWarehouses.forEach(warehouse => {
              // Find the corresponding value in formattedRow using the warehouse ID as key
              const stockValue = formattedRow[String(warehouse.warehouse_id)]; 
              
              if (stockValue !== null && stockValue !== undefined && stockValue !== '') {
                const newQuantity = parseInt(stockValue) || 0;
                const currentQuantity = existingPart[warehouse.warehouse_id] || 0;
                
                if (newQuantity !== currentQuantity) {
                  stockChanges.push({
                    field: `מלאי ${warehouse.name}`,
                    old: currentQuantity,
                    new: newQuantity
                  });
                }
              }
            });

            const allChanges = [...itemChanges, ...stockChanges];
            
            if (allChanges.length > 0) {
              const changeType = itemChanges.length > 0 ? 'update' : 'stock_only';
              changes.push({
                sku: formattedRow.sku,
                name: formattedRow.name || existingPart.name,
                type: changeType,
                shouldUpdate: true,
                changes: allChanges,
                newData: formattedRow,
                existingData: existingPart
              });
            } else {
              changes.push({
                sku: formattedRow.sku,
                name: formattedRow.name || existingPart.name,
                type: 'no_change',
                shouldUpdate: false,
                changes: [],
                newData: formattedRow,
                existingData: existingPart
              });
            }
          }
        }

        // Small delay between batches to avoid overwhelming the UI
        if (i + batchSize < data.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      setDetectedChanges(changes);
      setShowChangeDetection(true);
      
      const significantChanges = changes.filter(c => c.type !== 'no_change');
      addLog(`ניתוח הושלם. נמצאו ${significantChanges.length} פריטים עם שינויים מתוך ${changes.length} פריטים`, 'success');
      
      if (significantChanges.length === 0) {
        toast({
          title: "לא נמצאו שינויים",
          description: "כל הנתונים בקובץ זהים לנתונים הקיימים במערכת."
        });
      }

    } catch (error) {
      console.error("Error analyzing changes:", error);
      addLog(`שגיאה בניתוח שינויים: ${error.message}`, "error");
      toast({
        variant: "destructive",
        title: "שגיאה בניתוח שינויים",
        description: error.message
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleMappingSelection = (mapping) => {
    setSelectedMapping(mapping);
    setFieldMapping(Array.isArray(mapping.mapping) ? mapping.mapping : []);
  };

  const handleToggleUpdate = (index, shouldUpdate) => {
    setDetectedChanges(prev => prev.map((change, i) => 
      i === index ? { ...change, shouldUpdate } : change
    ));
  };

  const handleConfirmImport = () => {
    setShowChangeDetection(false);
    const changesToImport = detectedChanges.filter(c => c.shouldUpdate);
    handleImportWithChanges(changesToImport);
  };

  const handleImportWithChanges = async (changes) => {
    setIsImporting(true);
    setProgress(0);
    setLogs([]);
    addLog(`התחלת תהליך ייבוא עם ${changes.length} שינויים.`);

    try {
      const [initialParts, allWarehouses] = await Promise.all([
        apiCallWithRetry(() => Part.list(), MAX_RETRIES, "Part.list"),
        apiCallWithRetry(() => Warehouse.list(), MAX_RETRIES, "Warehouse.list")
      ]);

      let maxPartBusinessId = initialParts.reduce((max, p) => Math.max(max, parseInt(p.part_id) || 0), 0);

      const newItems = changes.filter(c => c.type === 'new');
      const allItemsToProcess = changes.filter(c => c.type !== 'no_change');
      const totalItemsToProcess = allItemsToProcess.length;

      let createdCount = 0;
      let updatedCount = 0;
      let errorCount = 0;
      let processedCount = 0;

      // Phase 1: Create new items with minimal required data
      if (newItems.length > 0) {
        addLog(`יוצר רשומות בסיסיות עבור ${newItems.length} פריטים חדשים...`, 'info');
        const minimalPayloads = newItems.map(change => {
          maxPartBusinessId++;
          const formattedRow = change.newData;
          return {
            part_id: String(maxPartBusinessId),
            sku: formattedRow.sku,
            name: formattedRow.name,
            category: formattedRow.category || 'other',
            unit: formattedRow.unit || 'pieces',
          };
        });

        try {
            await apiCallWithRetry(() => Part.bulkCreate(minimalPayloads), MAX_RETRIES, 'Bulk Create Placeholders');
            createdCount = minimalPayloads.length;
            addLog(`${createdCount} פריטים חדשים נוצרו בהצלחה.`, 'success');
        } catch(e) {
            addLog(`שגיאה קריטית ביצירת פריטים חדשים: ${e.message}`, 'error');
            errorCount += minimalPayloads.length;
            throw e;
        }
      }

      // Phase 2: Update all items (new and existing) with full data
      addLog('מתחיל שלב עדכון נתונים מלא...','info');
      const allPartsForUpdate = await apiCallWithRetry(() => Part.list(), MAX_RETRIES, "Part.list (post-creation)");
      const partMap = new Map(allPartsForUpdate.map(p => [p.sku, p]));
      
      if (allItemsToProcess.length > 0) {
        addLog(`מעדכן נתונים מלאים עבור ${allItemsToProcess.length} פריטים...`, 'info');
        
        for (let i = 0; i < allItemsToProcess.length; i += UPDATE_BATCH_SIZE) {
          const batch = allItemsToProcess.slice(i, i + UPDATE_BATCH_SIZE);
          addLog(`מעבד קבוצת עדכונים ${Math.floor(i / UPDATE_BATCH_SIZE) + 1}/${Math.ceil(allItemsToProcess.length / UPDATE_BATCH_SIZE)}`, 'info');

          // Process the batch sequentially to avoid rate limits
          for (const change of batch) {
            try {
              const formattedRow = change.newData;
              const existingPart = partMap.get(formattedRow.sku);
              
              if (!existingPart) {
                throw new Error('פריט לא נמצא לעדכון לאחר שלב היצירה.');
              }

              const updateData = {};
              const fieldsToUpdate = ['name', 'category', 'unit', 'minimum_stock', 'notes', 'cost_price', 'current_location', 'supplier_part_number', 'replaced_sku', 'supplier_number', 'cost_currency', 'sale_currency', 'import_percentage', 'markup_percentage', 'exchange_rate'];
              
              fieldsToUpdate.forEach(field => {
                if (formattedRow[field] !== undefined && formattedRow[field] !== null) {
                  const newValue = ['minimum_stock', 'cost_price', 'import_percentage', 'markup_percentage', 'exchange_rate'].includes(field)
                    ? parseFloat(formattedRow[field]) || null
                    : formattedRow[field];
                  
                  if (change.type === 'new' || String(existingPart[field] || '') !== String(newValue || '')) {
                     updateData[field] = newValue;
                  }
                }
              });

              allWarehouses.forEach(wh => {
                const stockVal = formattedRow[String(wh.warehouse_id)];
                if (stockVal !== undefined && stockVal !== null && stockVal !== '') {
                  const newQuantity = parseInt(stockVal) || 0;
                  if (change.type === 'new' || (existingPart[wh.warehouse_id] || 0) !== newQuantity) {
                    updateData[wh.warehouse_id] = newQuantity;
                  }
                }
              });
              
              if (Object.keys(updateData).length > 0) {
                updateData.last_updated = new Date().toISOString().split('T')[0];
                await apiCallWithRetry(() => Part.update(existingPart.id, updateData), MAX_RETRIES, `Part Update ${existingPart.sku}`);
                
                if (change.type !== 'new') {
                  updatedCount++;
                }
              }
            } catch (e) {
                errorCount++;
                const failedSku = change.sku || 'לא ידוע';
                const errorMessage = e.message || 'שגיאה לא ידועה';
                addLog(`שגיאה בעדכון מק"ט ${failedSku}: ${errorMessage}`, 'error');
            }
          }

          processedCount += batch.length;
          setProgress(processedCount / totalItemsToProcess * 100);
          
          if (i + UPDATE_BATCH_SIZE < allItemsToProcess.length) {
            await delay(DELAY_BETWEEN_BATCHES);
          }
        }
      }

      // Correctly count total updated items
      const finalUpdatedCount = updatedCount + newItems.length;

      // Final summary
      addLog(`=== סיכום ייבוא ===`, "success");
      addLog(`פריטים חדשים שנוצרו: ${createdCount}`, "success");
      addLog(`פריטים שעודכנו בנתונים מלאים: ${finalUpdatedCount}`, "success");
      addLog(`שגיאות: ${errorCount}`, errorCount > 0 ? "error" : "success");
      
      if (errorCount === 0) {
        addLog(`הייבוא הושלם בהצלחה! 🎉`, "success");
        toast({ 
          title: "הייבוא הושלם בהצלחה!",
          description: `נוצרו ${createdCount} פריטים, עודכנו ${finalUpdatedCount} פריטים.`
        });
      } else {
        addLog(`הייבוא הושלם עם ${errorCount} שגיאות.`, "warn");
        toast({ 
          variant: "destructive", 
          title: `הייבוא הושלם עם ${errorCount} שגיאות`,
          description: "יש לבדוק את רשימת השגיאות ביומן"
        });
      }

    } catch (error) {
      console.error("Import failed critically:", error);
      addLog(`הייבוא נכשל: ${error.message}`, "error");
      toast({
        variant: "destructive",
        title: "הייבוא נכשל",
        description: error.message
      });
    } finally {
      setIsImporting(false);
      setProgress(100);
    }
  };

  const handleImport = async () => {
    // First analyze changes, then show confirmation dialog
    await analyzeChanges();
  };

  return (
    <div className="p-6" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">ייבוא פריטים</h1>
        </div>

        {/* Step 1: Settings */}
        <Card>
          <CardHeader>
            <CardTitle>שלב 1: הגדרות ייבוא</CardTitle>
            <div className="flex justify-between items-center">
                <CardDescription>בחר תבנית מיפוי עמודות או הגדר מיפוי חדש.</CardDescription>
                <Button variant="outline" size="sm" onClick={() => setShowSettings(!showSettings)}>
                    <Settings className="h-4 w-4 ml-2" />
                    {showSettings ? 'הסתר הגדרות מיפוי' : 'הצג הגדרות מיפוי'}
                </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
                <div className="flex items-center justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : (
              <>
                <div className="mb-4">
                  <Label className="text-sm font-medium">בחר תבנית מיפוי</Label>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="w-full justify-between mt-1">
                        <span>{selectedMapping ? selectedMapping.name : "בחר תבנית..."}</span>
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
                      {savedMappings.length > 0 ? (
                        savedMappings.map(m => (
                          <DropdownMenuItem key={m.id} onSelect={() => handleMappingSelection(m)}>
                            {m.name} {m.is_default && "(ברירת מחדל)"}
                          </DropdownMenuItem>
                        ))
                      ) : (
                        <DropdownMenuItem disabled>לא נמצאו הגדרות שמורות</DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  {!selectedMapping && (
                     <Alert variant="destructive" className="mt-2">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>לא נבחרה תבנית מיפוי</AlertTitle>
                        <AlertDescription>
                          יש לבחור תבנית מיפוי עמודות או ליצור אחת חדשה בדף ההגדרות.
                        </AlertDescription>
                      </Alert>
                  )}
                </div>

                {showSettings && (
                    <div className="p-4 border rounded-lg bg-gray-50/50">
                        <ImportFieldMapping 
                          mapping={fieldMapping} 
                          onMappingChange={setFieldMapping} 
                          headers={headers}
                          referenceData={referenceData}
                        />
                    </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Step 2: Upload Data */}
        {selectedMapping && (
            <Card>
            <CardHeader>
                <CardTitle>שלב 2: העלאת נתונים</CardTitle>
                <CardDescription>
                  העלה קובץ CSV, Excel (.xlsx) או טקסט עם הפרדת טאב (.txt/.tsv).
                </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert className="mb-4">
                <Info className="h-4 w-4" />
                <AlertTitle>סוגי קבצים נתמכים</AlertTitle>
                <AlertDescription>
                  • <strong>Excel (.xlsx)</strong> - מומלץ, נקרא ישירות
                  <br />
                  • <strong>CSV</strong> - יש לוודא קידוד UTF-8
                  <br />
                  • <strong>טקסט עם טאב (.txt/.tsv)</strong> - הפרדה בטאב בין עמודות
                </AlertDescription>
              </Alert>
              <div className="space-y-6">
                <div className="flex items-center space-x-2" dir="rtl">
                  <Checkbox
                    id="has-headers"
                    checked={hasHeaders}
                    onCheckedChange={setHasHeaders}
                  />
                  <Label htmlFor="has-headers" className="mr-2">לקובץ יש שורת כותרות (השורה הראשונה תתעלם)</Label>
                </div>

                {/* File Upload Option */}
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                    <div className="text-center">
                    <File className="mx-auto h-12 w-12 text-gray-400" />
                    <div className="mt-4">
                        <label htmlFor="file-upload" className="cursor-pointer">
                        <span className="mt-2 block text-sm font-medium text-gray-900">
                            העלה קובץ נתונים
                        </span>
                        <span className="mt-1 block text-xs text-gray-500">
                            CSV, Excel (.xlsx), או טקסט (.txt/.tsv) - מקס 50MB
                        </span>
                        </label>
                        <input
                        id="file-upload"
                        name="file-upload"
                        type="file"
                        className="sr-only"
                        accept=".csv,.xlsx,.xls,.txt,.tsv"
                        onChange={handleFileUpload}
                        disabled={isFileUploading}
                        />
                    </div>
                    <div className="mt-4">
                        <Button
                        onClick={() => document.getElementById('file-upload').click()}
                        disabled={isFileUploading}
                        variant="outline"
                        >
                        {isFileUploading ? (
                            <>
                            <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                            מעבד קובץ...
                            </>
                        ) : (
                            <>
                            <Upload className="h-4 w-4 ml-2" />
                            בחר קובץ
                            </>
                        )}
                        </Button>
                    </div>
                    </div>
                </div>

                {uploadedFile && (
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertTitle>קובץ הועלה בהצלחה!</AlertTitle>
                    <AlertDescription>
                      קובץ {uploadedFile.name} עובד ומוכן לייבוא.
                    </AlertDescription>
                  </Alert>
                )}
                </div>
            </CardContent>
            </Card>
        )}

        {/* Step 3: Preview and Import */}
        {selectedMapping && data.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>שלב 3: תצוגה מקדימה וייבוא</CardTitle>
              <CardDescription>
                כך ייראו {Math.min(PREVIEW_ROWS, data.length)} השורות הראשונות לאחר הייבוא. לחץ על "בדוק שינויים" לפני הייבוא.
                {data.length > PREVIEW_ROWS && ` (מוצגות ${PREVIEW_ROWS} מתוך ${data.length} שורות)`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto border rounded-lg mb-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {headers.map((headerLabel, index) => (
                        <TableHead key={index}>{headerLabel}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.slice(0, PREVIEW_ROWS).map((row, rowIndex) => (
                      <TableRow key={rowIndex}>
                        {row.map((cell, cellIndex) => (
                          <TableCell key={cellIndex}>
                            {cell || <span className="text-gray-400 italic">{'ריק'}</span>}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {data.length > 0 && (
                <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                  <div className="text-sm font-medium text-blue-800">
                    סטטיסטיקות קובץ:
                  </div>
                  <div className="text-sm text-blue-600 mt-1">
                    • סה"כ שורות: {data.length.toLocaleString()}
                    <br />
                    • עמודות מיופות: {headers.length}
                    <br />
                    • גודל קובץ: {uploadedFile ? (uploadedFile.size / 1024 / 1024).toFixed(2) + 'MB' : 'לא ידוע'}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3">
                <Button
                  onClick={analyzeChanges}
                  disabled={isAnalyzing || isImporting}
                  variant="outline"
                >
                  {isAnalyzing ? (
                    <Loader2 className="h-5 w-5 ml-2 animate-spin" />
                  ) : (
                    <Info className="h-5 w-5 ml-2" />
                  )}
                  {isAnalyzing ? "מנתח שינויים..." : "בדוק שינויים"}
                </Button>
                <Button
                  onClick={handleImport} // This now triggers analyzeChanges too, but the disabled state in JSX prevents direct use.
                  disabled={true}
                  size="lg"
                  className="cursor-not-allowed"
                >
                    <CheckCircle className="h-5 w-5 ml-2" />
                  התחל ייבוא (זמין לאחר בדיקת שינויים)
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Debug Info Panel */}
        {debugInfo && (
          <Card>
            <Collapsible>
              <CollapsibleTrigger asChild>
                <CardHeader className="flex flex-row items-center justify-between cursor-pointer">
                  <CardTitle className="flex items-center gap-2">
                    <Terminal className="h-5 w-5" />
                    מידע דיבאג
                  </CardTitle>
                  <Button variant="outline" size="sm">הצג/הסתר</Button>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent>
                  <pre className="bg-gray-900 text-white p-4 rounded-md text-xs overflow-x-auto whitespace-pre-wrap">
                    {debugInfo}
                  </pre>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        )}

        {isImporting && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex justify-between mb-2">
                <span className="font-medium">מתבצע ייבוא...</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} />
              <div className="mt-2 text-sm text-gray-600">
                עיבוד בקבוצות של {UPDATE_BATCH_SIZE} פריטים עם השהיה של {DELAY_BETWEEN_BATCHES/1000} שניות בין קבוצות
              </div>
            </CardContent>
          </Card>
        )}

        {logs.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>יומן ייבוא</CardTitle>
            </CardHeader>
            <CardContent className="max-h-60 overflow-y-auto bg-gray-900 text-white font-mono text-sm p-4 rounded-lg">
              {logs.map((log, index) => (
                <div key={index} className={`flex items-start gap-3 ${log.type === 'error' ? 'text-red-400' : log.type === 'success' ? 'text-green-400' : log.type === 'warn' ? 'text-yellow-400' : 'text-gray-300'}`}>
                  <span>{log.timestamp.toLocaleTimeString()}</span>
                  <p className="flex-1">{log.message}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {showChangeDetection && (
          <ChangeDetectionModal
            detectedChanges={detectedChanges}
            onConfirm={handleConfirmImport}
            onCancel={() => setShowChangeDetection(false)}
            onToggleUpdate={handleToggleUpdate}
          />
        )}
      </div>
    </div>
  );
}