import React, { useState, useEffect } from "react";
import { Warehouse, Category, Currency, ImportMapping } from "@/entities/all";
import { base44 } from "@/api/base44Client";
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

import { Upload, Settings, CheckCircle, Loader2, Info, ChevronDown, AlertCircle, File, Terminal, Zap } from "lucide-react";
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

const PREVIEW_ROWS = 10; // Show only first 10 rows in preview



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
          <p className="text-gray-600 mt-2">נמצאו {detectedChanges.filter(c => c.type !== 'no_change').length} פריטים עם שינויים מתוך {detectedChanges.length} פריטים. בחר אילו שינויים לבצע:</p>
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
              {detectedChanges.filter(change => change.type !== 'no_change').slice(0, 100).map((change, index) => {
                const originalIndex = detectedChanges.indexOf(change);
                return (
                  <TableRow key={change.sku} className={!change.shouldUpdate ? 'opacity-50' : ''}>
                    <TableCell>
                      <Checkbox
                        checked={change.shouldUpdate}
                        onCheckedChange={(checked) => onToggleUpdate(originalIndex, checked)}
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
                );
              })}
              {detectedChanges.filter(c => c.type !== 'no_change').length > 100 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-gray-500">
                    מוצגות 100 שורות ראשונות מתוך {detectedChanges.filter(c => c.type !== 'no_change').length}
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
          Category.list(),
          Warehouse.list(),
          Currency.list(),
          ImportMapping.list()
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
          
          // Merge saved mapping with latest field definitions
          const latestFields = getInitialFieldMapping(safeWarehouses);
          const savedMapping = Array.isArray(defaultMapping.mapping) ? defaultMapping.mapping : [];
          const savedFieldsMap = new Map(savedMapping.map(f => [f.key, f]));
          
          const mergedMapping = latestFields.map(latestField => {
            if (savedFieldsMap.has(latestField.key)) {
              return savedFieldsMap.get(latestField.key);
            }
            return latestField;
          });
          
          setFieldMapping(mergedMapping);
        } else {
          const initialMapping = getInitialFieldMapping(safeWarehouses);
          setFieldMapping(initialMapping);
        }

      } catch (error) {
        console.error("Error loading initial data for import page:", error);

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
      { key: 'manual_sale_price', label: 'מחיר מכירה ידני', checked: false, is_required: false },
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
        addLog('קבצי Excel אינם נתמכים ישירות. יש לייצא את הקובץ כ-CSV או טקסט עם הפרדת טאב.', 'error');
        throw new Error('קבצי Excel (.xlsx/.xls) אינם נתמכים ישירות. יש לייצא את הקובץ מ-Excel כ-CSV UTF-8 או כטקסט עם הפרדת טאב.');
      } else {
        // CSV or Tab-delimited text file
        // Try UTF-8 first, if Hebrew chars appear garbled, try Windows-1255
        let text = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result);
          reader.onerror = (e) => reject(new Error('שגיאה בקריאת הקובץ'));
          reader.readAsText(file, 'UTF-8');
        });
        
        // Check for garbled Hebrew (common pattern: Ã or Â characters indicate wrong encoding)
        const hasGarbledChars = /[\xC0-\xFF]{2,}/.test(text) && !/[\u0590-\u05FF]/.test(text);
        if (hasGarbledChars) {
          addLog('זוהה קידוד לא תקין, מנסה קידוד Windows-1255...', 'info');
          text = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error('שגיאה בקריאת הקובץ'));
            reader.readAsText(file, 'windows-1255');
          });
        }
        
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
      

      addLog(`עיבוד הקובץ הושלם.`, 'success');

    } catch (error) {
      console.error("שגיאה בניתוח הקובץ:", error);
      let errorMessage = error.message || "אירעה שגיאה לא ידועה.";
      addLog(`שגיאה בניתוח הקובץ: ${errorMessage}`, "error");

    } finally {
      setIsFileUploading(false);
      event.target.value = '';
    }
  };
  
  const analyzeChanges = async () => {
    if (data.length === 0) {
      alert('אין נתונים לייבוא');
      return;
    }
    if (!selectedMapping) {
      alert('יש לבחור תבנית מיפוי');
      return;
    }

    setIsAnalyzing(true);
    addLog('מתחיל ניתוח שינויים בצד הלקוח...', 'info');

    try {
      // Load all existing parts data from entities
      addLog('טוען נתוני מערכת קיימים...', 'info');
      const [partCoreData, partPricingData, partSupplierData, partStockData, allCategories, allWarehouses] = await Promise.all([
        base44.entities.PartCore.list(),
        base44.entities.PartPricing.list(),
        base44.entities.PartSupplier.list(),
        base44.entities.PartStock.list(),
        base44.entities.Category.list(),
        base44.entities.Warehouse.list()
      ]);

      // Build parts lookup maps
      const pricingMap = new Map(partPricingData.map(p => [p.part_sku, p]));
      const supplierMap = new Map(partSupplierData.map(p => [p.part_sku, p]));
      const stockByPart = new Map();
      
      partStockData.forEach(stock => {
        if (!stockByPart.has(stock.part_sku)) {
          stockByPart.set(stock.part_sku, {});
        }
        stockByPart.get(stock.part_sku)[stock.warehouse_id] = stock.quantity;
      });

      const allParts = partCoreData.map(core => {
        const pricing = pricingMap.get(core.sku) || {};
        const supplier = supplierMap.get(core.sku) || {};
        const stocks = stockByPart.get(core.sku) || {};
        return { ...core, ...pricing, ...supplier, ...stocks };
      });

      const partMap = new Map(allParts.map(p => [p.sku, p]));
      addLog(`נטענו ${allParts.length} פריטים קיימים`, 'info');

      // Analyze each row
      const sortedActiveFields = fieldMapping
        .filter(field => field.checked)
        .sort((a, b) => (a.column || Infinity) - (b.column || Infinity));

      const changes = [];
      
      for (const row of data) {
        const formattedRow = {};
        
        sortedActiveFields.forEach((field, index) => {
          let value = row[index];
          if (value === null || value === undefined || value === '') {
            value = null;
          } else if (typeof value === 'string') {
            value = value.trim();
            if (value === '') value = null;
          }
          formattedRow[field.key] = value;
        });

        if (!formattedRow.sku) continue;

        const existingPart = partMap.get(formattedRow.sku);

        if (!existingPart) {
          // New item
          changes.push({
            sku: formattedRow.sku,
            name: formattedRow.name || 'לא מוגדר',
            type: 'new',
            shouldUpdate: true,
            changes: ['יצירה חדשה'],
            newData: formattedRow
          });
        } else {
          // Existing item - detect changes
          const itemChanges = [];
          const allFields = [
            'name', 'category', 'unit', 'minimum_stock', 'notes', 'current_location',
            'replaced_sku', 'cost_price', 'cost_currency', 'sale_currency',
            'import_percentage', 'markup_percentage', 'manual_sale_price',
            'supplier_number', 'supplier_part_number'
          ];

          allFields.forEach(field => {
            if (formattedRow[field] !== undefined && formattedRow[field] !== null) {
              const oldValue = existingPart[field];
              const newValue = formattedRow[field];
              
              // Special handling for cost_price: treat 0 and empty as the same
              if (field === 'cost_price') {
                const oldPrice = parseFloat(oldValue) || 0;
                const newPrice = parseFloat(newValue) || 0;
                if (oldPrice !== newPrice) {
                  itemChanges.push({
                    field: field,
                    old: oldPrice || 'ריק',
                    new: newPrice || 'ריק'
                  });
                }
              } else if (String(oldValue || '') !== String(newValue || '')) {
                itemChanges.push({
                  field: field,
                  old: oldValue || 'ריק',
                  new: newValue || 'ריק'
                });
              }
            }
          });

          // Check stock changes
          allWarehouses.forEach(warehouse => {
            const stockValue = formattedRow[String(warehouse.warehouse_id)];
            
            if (stockValue !== null && stockValue !== undefined && stockValue !== '') {
              const newQuantity = parseInt(stockValue) || 0;
              const currentQuantity = existingPart[warehouse.warehouse_id] || 0;
              
              if (newQuantity !== currentQuantity) {
                itemChanges.push({
                  field: `מלאי ${warehouse.name}`,
                  old: currentQuantity,
                  new: newQuantity
                });
              }
            }
          });

          if (itemChanges.length > 0) {
            changes.push({
              sku: formattedRow.sku,
              name: formattedRow.name || existingPart.name,
              type: 'update',
              shouldUpdate: true,
              changes: itemChanges,
              newData: formattedRow
            });
          }
        }
      }

      addLog(`ניתוח הושלם: ${changes.length} שינויים זוהו`, 'success');
      setDetectedChanges(changes);
      setShowChangeDetection(true);

    } catch (error) {
      console.error('Error analyzing changes:', error);
      addLog(`שגיאה בניתוח: ${error.message}`, 'error');
      alert(`שגיאה בניתוח השינויים: ${error.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleMappingSelection = (mapping) => {
    setSelectedMapping(mapping);
    
    // Merge saved mapping with latest field definitions to include new fields
    const latestFields = getInitialFieldMapping(referenceData.warehouses);
    const savedMapping = Array.isArray(mapping.mapping) ? mapping.mapping : [];
    
    // Create a map of existing fields from saved mapping
    const savedFieldsMap = new Map(savedMapping.map(f => [f.key, f]));
    
    // Merge: keep saved fields and add new fields that don't exist in saved mapping
    const mergedMapping = latestFields.map(latestField => {
      if (savedFieldsMap.has(latestField.key)) {
        return savedFieldsMap.get(latestField.key);
      }
      return latestField;
    });
    
    setFieldMapping(mergedMapping);
  };

  const handleToggleUpdate = (index, shouldUpdate) => {
    setDetectedChanges(prev => prev.map((change, i) => 
      i === index ? { ...change, shouldUpdate } : change
    ));
  };

  const handleConfirmImport = async () => {
    setShowChangeDetection(false);
    const changesToImport = detectedChanges.filter(c => c.shouldUpdate);
    await handleImportWithBackend(changesToImport);
  };

  const handleImportWithBackend = async (changes) => {
    setIsImporting(true);
    setProgress(0);
    setLogs([]);
    addLog(`מתחיל עיבוד ${changes.length} שינויים...`, 'info');

    try {
      const newItems = changes.filter(c => c.type === 'new');
      const updateItems = changes.filter(c => c.type === 'update');
      
      let createdCount = 0;
      let updatedCount = 0;
      let errorCount = 0;

      // Process new items
      if (newItems.length > 0) {
        addLog(`יוצר ${newItems.length} פריטים חדשים...`, 'info');
        setProgress(20);

        for (const change of newItems) {
          try {
            const formattedRow = change.newData;
            
            const partPayload = {
              sku: String(formattedRow.sku).trim(),
              name: String(formattedRow.name || '').trim(),
              category: formattedRow.category || '',
              unit: formattedRow.unit || '',
              minimum_stock: parseFloat(formattedRow.minimum_stock) || 0,
              notes: formattedRow.notes || '',
              current_location: formattedRow.current_location || '',
              replaced_sku: formattedRow.replaced_sku || '',
              warehouses: referenceData.warehouses.map(wh => ({
                warehouse_id: wh.warehouse_id,
                quantity: parseFloat(formattedRow[wh.warehouse_id]) || 0
              })),
              cost_price: parseFloat(formattedRow.cost_price) || 0,
              cost_currency: formattedRow.cost_currency || 'ILS',
              sale_currency: formattedRow.sale_currency || 'ILS',
              import_percentage: formattedRow.import_percentage !== undefined && formattedRow.import_percentage !== null && formattedRow.import_percentage !== '' ? parseFloat(formattedRow.import_percentage) : 0,
              markup_percentage: formattedRow.markup_percentage !== undefined && formattedRow.markup_percentage !== null && formattedRow.markup_percentage !== '' ? parseFloat(formattedRow.markup_percentage) : 0,
              manual_sale_price: formattedRow.manual_sale_price && formattedRow.manual_sale_price !== '' ? parseFloat(formattedRow.manual_sale_price) : 0,
              is_manual: formattedRow.manual_sale_price && formattedRow.manual_sale_price !== '' ? true : false,
              supplier_number: formattedRow.supplier_number || '',
              supplier_part_number: formattedRow.supplier_part_number || ''
            };

            const response = await base44.functions.invoke('createPart', partPayload);
            
            if (response?.data?.error) {
              throw new Error(response.data.error);
            }
            
            createdCount++;
          } catch (e) {
            errorCount++;
            addLog(`שגיאה ביצירת מק"ט ${change.sku}: ${e.message}`, 'error');
          }
        }
      }

      setProgress(60);

      // Process updates
      if (updateItems.length > 0) {
        addLog(`מעדכן ${updateItems.length} פריטים קיימים...`, 'info');

        for (const change of updateItems) {
          try {
            const formattedRow = change.newData;
            
            const updateData = { sku: formattedRow.sku };
            const fieldsToUpdate = [
              'name', 'category', 'unit', 'minimum_stock', 'notes', 'current_location',
              'replaced_sku', 'cost_price', 'cost_currency', 'sale_currency',
              'import_percentage', 'markup_percentage', 'manual_sale_price',
              'supplier_number', 'supplier_part_number'
            ];

            fieldsToUpdate.forEach(field => {
              if (formattedRow[field] !== undefined && formattedRow[field] !== null && formattedRow[field] !== '') {
                updateData[field] = formattedRow[field];
              }
            });

            // Add warehouse stock updates
            referenceData.warehouses.forEach(wh => {
              const stockValue = formattedRow[wh.warehouse_id];
              if (stockValue !== null && stockValue !== undefined && stockValue !== '') {
                updateData[wh.warehouse_id] = parseFloat(stockValue) || 0;
              }
            });

            const response = await base44.functions.invoke('updatePart', updateData);
            
            if (response?.data?.error) {
              throw new Error(response.data.error);
            }
            
            updatedCount++;
          } catch (e) {
            errorCount++;
            addLog(`שגיאה בעדכון מק"ט ${change.sku}: ${e.message}`, 'error');
          }
        }
      }

      setProgress(100);

      addLog(`=== סיכום ייבוא ===`, "success");
      addLog(`פריטים חדשים: ${createdCount}`, "success");
      addLog(`פריטים שעודכנו: ${updatedCount}`, "success");
      addLog(`שגיאות: ${errorCount}`, errorCount > 0 ? "error" : "success");
      
      if (errorCount === 0) {
        addLog(`הייבוא הושלם בהצלחה! 🎉`, "success");
        alert(`הייבוא הושלם בהצלחה! ${createdCount} פריטים נוצרו, ${updatedCount} עודכנו.`);
      } else {
        addLog(`הייבוא הושלם עם ${errorCount} שגיאות.`, "warn");
        alert(`הייבוא הושלם עם ${errorCount} שגיאות. בדוק את היומן למידע נוסף.`);
      }

    } catch (error) {
      console.error("Import failed:", error);
      addLog(`הייבוא נכשל: ${error.message}`, "error");
      alert(`הייבוא נכשל: ${error.message}`);
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
                  העלה קובץ CSV או טקסט עם הפרדת טאב (.txt/.tsv).
                </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert className="mb-4">
                <Info className="h-4 w-4" />
                <AlertTitle>סוגי קבצים נתמכים</AlertTitle>
                <AlertDescription>
                  • <strong>CSV</strong> - יש לוודא קידוד UTF-8 (ב-Excel: שמור כ-CSV UTF-8)
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
                            CSV או טקסט (.txt/.tsv) - מקס 50MB
                        </span>
                        </label>
                        <input
                        id="file-upload"
                        name="file-upload"
                        type="file"
                        className="sr-only"
                        accept=".csv,.txt,.tsv"
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
                  disabled={isImporting || isAnalyzing}
                  size="lg"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="h-5 w-5 ml-2 animate-spin" />
                      מנתח שינויים...
                    </>
                  ) : (
                    <>
                      <Zap className="h-5 w-5 ml-2" />
                      התחל ייבוא מהיר
                    </>
                  )}
                </Button>
              </div>

              <Alert className="mt-4">
                <Zap className="h-4 w-4" />
                <AlertTitle>ייבוא מהיר ומיטבי</AlertTitle>
                <AlertDescription>
                  הקובץ יועלה לשרת והעיבוד יתבצע בצד השרת לביצועים מקסימליים. 
                  מהירות האינטרנט שלך לא משפיעה על זמן העיבוד.
                </AlertDescription>
              </Alert>
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
                <span className="font-medium">מתבצע ייבוא בשרת...</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} />
              <div className="mt-2 text-sm text-gray-600">
                הקובץ מעובד בשרת לביצועים מקסימליים
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