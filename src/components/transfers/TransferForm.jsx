import React, { useState, useEffect, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, Trash2, Search, AlertTriangle, ChevronUp, ChevronDown, Plus, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Transfer } from "@/entities/Transfer";
import { getParts } from "@/functions/getParts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import AvailablePartsSearchTable from "./AvailablePartsSearchTable";

export default function TransferForm({ warehouses, stocks, transfer, onSubmit, onCancel, onDelete }) {
  const [formData, setFormData] = useState({
    from_warehouse_name: '',
    to_warehouse_name: '',
    notes: '',
    items: []
  });
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [nextTransferNumber, setNextTransferNumber] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [parts, setParts] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: 'part_sku', direction: 'asc' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Function to generate a new transfer number
  const generateTransferNumber = async () => {
    try {
      const transfers = await Transfer.list("-created_date", 1);
      let newNumber;
      
      if (transfers.length > 0 && transfers[0].transfer_number && transfers[0].transfer_number.startsWith('TRF-')) {
        const parts = transfers[0].transfer_number.split('-');
        if (parts.length > 1) {
          const lastNumber = parseInt(parts[1]) || 0;
          newNumber = `TRF-${String(lastNumber + 1).padStart(6, '0')}`;
        } else {
          newNumber = 'TRF-000001';
        }
      } else {
        const count = (await Transfer.list()).length;
        newNumber = `TRF-${String(count + 1).padStart(6, '0')}`;
      }
      
      setNextTransferNumber(newNumber);
    } catch (err) {
      console.error("Error generating transfer number:", err);
      const timestamp = Date.now().toString().slice(-6);
      setNextTransferNumber(`TRF-${timestamp}`);
    }
  };

  // Effect to load parts data
  useEffect(() => {
    const loadParts = async () => {
      try {
        const partsResponse = await getParts();
        const partsData = partsResponse?.data?.data || [];
        setParts(partsData);
      } catch (error) {
        console.error("Error loading parts:", error);
      }
    };
    loadParts();
  }, []);

  // Effect to initialize form data based on 'transfer' prop (for editing or creating)
  useEffect(() => {
    if (transfer) {
      // Editing existing transfer
      setFormData({
        from_warehouse_name: transfer.from_warehouse_name || '',
        to_warehouse_name: transfer.to_warehouse_name || '',
        notes: transfer.notes || '',
        // Create a new array of items to ensure independent state
        // Ensure part_id is present for existing items if they don't have it (e.g., loaded from old schema)
        items: transfer.items ? transfer.items.map(item => ({
          ...item,
          part_id: item.part_id || parts.find(p => p.sku === item.part_sku)?.id // Add part_id if missing
        })) : []
      });
      setNextTransferNumber(transfer.transfer_number);
    } else {
      // Creating new transfer
      setFormData({
        from_warehouse_name: '',
        to_warehouse_name: '',
        notes: '',
        items: []
      });
      generateTransferNumber(); // Generate a new transfer number for new transfers
    }
    // Clear errors and warnings when the 'transfer' prop changes
    setError('');
    setWarning('');
  }, [transfer, parts]); // Re-run this effect when the 'transfer' prop changes or parts data loads

  const sortedWarehouses = useMemo(() => {
    return [...warehouses].sort((a,b) => (a.number || 0) - (b.number || 0));
  }, [warehouses]);

  const getAvailableStock = (warehouseId, partId) => {
    // Since stock is now stored directly in the Part entity using warehouse columns,
    // we need to get the part and access the warehouse column directly
    const part = parts.find(p => p.id === partId);
    if (!part) return 0;
    
    const warehouse = warehouses.find(w => w.id === warehouseId);
    if (!warehouse) return 0;
    
    return part[warehouse.warehouse_id] || 0;
  };

  const getPartLocation = (partSku) => {
    const part = parts.find(p => p.sku === partSku);
    return part?.current_location || 'לא מוגדר';
  };

  // Handle source warehouse change - allow it even if it matches destination,
  // but reset destination in that case and never allow both to be equal.
  const handleFromWarehouseChange = (value) => {
    setFormData(prev => ({
      ...prev,
      from_warehouse_name: value,
      to_warehouse_name: prev.to_warehouse_name === value ? '' : prev.to_warehouse_name
    }));
    setError('');
    setWarning('');
  };

  // Handle destination warehouse change - allow it even if it matches source,
  // but reset source in that case and never allow both to be equal.
  const handleToWarehouseChange = (value) => {
    setFormData(prev => ({
      ...prev,
      to_warehouse_name: value,
      from_warehouse_name: prev.from_warehouse_name === value ? '' : prev.from_warehouse_name
    }));
    setError('');
    setWarning('');
  };

  // Available parts to add - computed synchronously from already-loaded parts (table instead of dropdown)
  const availableResults = useMemo(() => {
    if (!formData.from_warehouse_name || searchTerm.trim().length < 4) return [];

    const term = searchTerm.toLowerCase();
    const currentSkus = new Set(formData.items.map(item => item.part_sku));

    return parts
      .filter(part => {
        if (currentSkus.has(part.sku)) return false;
        const nameMatch = part.name && part.name.toLowerCase().includes(term);
        const skuMatch = part.sku && part.sku.toLowerCase().includes(term);
        return nameMatch || skuMatch;
      })
      .slice(0, 100);
  }, [parts, searchTerm, formData.from_warehouse_name, formData.items]);

  const handleSelectStock = (stock, quantity = 1) => {
    if (isSubmitting) return;
    const newItem = {
      part_sku: stock.part_sku,
      part_name: stock.part_name || stock.part_sku,
      part_id: stock.id,
      quantity: Number(quantity) > 0 ? Number(quantity) : 1
    };
    
    setFormData(prev => ({
      ...prev,
      items: [newItem, ...prev.items]
    }));
  };

  const removeItem = (index) => {
    if (isSubmitting) return;
    setFormData(prev => {
      const itemToRemove = sortedItems[index]; // Use sortedItems to get correct item
      return {
        ...prev,
        items: prev.items.filter((item) => item.part_sku !== itemToRemove.part_sku) // Filter by part_sku
      }
    });
    setWarning('');
  };

  const handleItemChange = (sku, field, value) => {
    if (isSubmitting) return;
    setFormData(prev => {
      const newItems = prev.items.map(item => 
        item.part_sku === sku ? { ...item, [field]: value } : item
      );
      return { ...prev, items: newItems };
    });
    setError('');
  };

  const checkNegativeStockWarning = () => {
    if (!formData.from_warehouse_name) {
      setWarning('');
      return;
    }
    
    const fromWarehouse = warehouses.find(w => w.name === formData.from_warehouse_name);
    if (!fromWarehouse) return;

    const negativeItems = formData.items.filter(item => {
      const availableStock = getAvailableStock(fromWarehouse.id, item.part_id);
      return Number(item.quantity) > availableStock;
    });

    if (negativeItems.length > 0) {
      setWarning(`אזהרה: ${negativeItems.length} פריטים יגרמו למלאי שלילי במחסן המקור`);
    } else {
      setWarning('');
    }
  };

  // Effect to re-evaluate warning when items or from_warehouse_name change
  useEffect(() => {
    checkNegativeStockWarning();
  }, [formData.items, formData.from_warehouse_name, warehouses, parts]); // Add warehouses, parts to dependencies

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (formData.from_warehouse_name === formData.to_warehouse_name) {
      setError('לא ניתן להעביר לאותו מחסן');
      return;
    }

    const fromWarehouse = warehouses.find(w => w.name === formData.from_warehouse_name);
    const toWarehouse = warehouses.find(w => w.name === formData.to_warehouse_name);
    
    if (!fromWarehouse || !toWarehouse) {
      setError('שגיאה בזיהוי המחסנים');
      return;
    }

    if (formData.items.length === 0) {
      setError('יש להוסיף פריטים להעברה');
      return;
    }

    for (const item of formData.items) {
      // Ensure part_id is present before submission
      if (!item.part_sku || !item.part_id || !item.quantity || Number(item.quantity) <= 0) {
        setError('יש למלא את כל פרטי הפריטים עם כמות חיובית');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        ...formData,
        transfer_number: nextTransferNumber,
        // Preserve existing status if editing, otherwise default to 'pending'
        status: transfer ? transfer.status : 'pending', 
        items: formData.items.map(item => ({
          part_sku: item.part_sku,
          part_name: item.part_name,
          part_id: item.part_id, // Add part_id to transfer items
          quantity: Number(item.quantity)
        }))
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStockStatusColor = (quantity) => {
    if (quantity < 0) return 'text-red-600';
    if (quantity === 0) return 'text-orange-600';
    return 'text-green-600';
  };

  const getStockStatusText = (quantity) => {
    if (quantity < 0) return 'מלאי שלילי';
    if (quantity === 0) return 'אזל מהמלאי';
    return 'זמין';
  };

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };
  
  const sortedItems = useMemo(() => {
    let sortableItems = [...formData.items];
    if (sortConfig.key) {
      sortableItems.sort((a, b) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];

        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
        }

        const strA = String(aValue || '').toLowerCase();
        const strB = String(bValue || '').toLowerCase();
        
        return sortConfig.direction === 'asc' ? strA.localeCompare(strB, 'he') : strB.localeCompare(strA, 'he');
      });
    }
    return sortableItems;
  }, [formData.items, sortConfig]);

  const SortableHeader = ({ columnKey, children }) => (
    <TableHead onClick={() => requestSort(columnKey)} className="cursor-pointer text-center">
      {children}
      {sortConfig.key === columnKey && (
        sortConfig.direction === 'asc' ? <ChevronUp className="inline h-4 w-4" /> : <ChevronDown className="inline h-4 w-4" />
      )}
    </TableHead>
  );

  const fromWarehouse = warehouses.find(w => w.name === formData.from_warehouse_name);

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full min-h-0 gap-3">
      <div className="shrink-0 space-y-3">
        <div className="flex justify-center text-sm text-gray-500">
          מספר העברה: {nextTransferNumber}
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {warning && (
          <Alert variant="default" className="border-orange-200 bg-orange-50">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-800">{warning}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>מחסן מקור</Label>
            <Select
              value={formData.from_warehouse_name}
              onValueChange={handleFromWarehouseChange}
              disabled={isSubmitting}
            >
              <SelectTrigger>
                <SelectValue placeholder="בחר מחסן מקור" />
              </SelectTrigger>
              <SelectContent>
                {sortedWarehouses.map((warehouse) => (
                  <SelectItem key={warehouse.id} value={warehouse.name}>
                    {`${warehouse.number} - ${warehouse.name}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>מחסן יעד</Label>
            <Select
              value={formData.to_warehouse_name}
              onValueChange={handleToWarehouseChange}
              disabled={isSubmitting}
            >
              <SelectTrigger>
                <SelectValue placeholder="בחר מחסן יעד" />
              </SelectTrigger>
              <SelectContent>
                {sortedWarehouses.map((warehouse) => (
                  <SelectItem key={warehouse.id} value={warehouse.name}>
                    {`${warehouse.number} - ${warehouse.name}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 gap-4 overflow-hidden">
        {/* Left side: search & available parts */}
        <div className="flex flex-col min-h-0 border rounded-md overflow-hidden">
          <div className="p-3 border-b shrink-0 bg-gray-50 space-y-1">
            <Label>חיפוש פריטים במחסן המקור</Label>
            <div className="relative">
              <Search className="absolute right-3 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                placeholder="חפש לפי שם או מק״ט (4 תווים לפחות)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                disabled={!formData.from_warehouse_name || isSubmitting}
                className="pr-9"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {!formData.from_warehouse_name ? (
              <div className="p-4 text-center text-sm text-gray-500">בחר מחסן מקור כדי לחפש פריטים</div>
            ) : searchTerm.trim().length < 4 ? (
              <div className="p-4 text-center text-sm text-gray-500">הקלד לפחות 4 תווים לחיפוש</div>
            ) : availableResults.length === 0 ? (
              <div className="p-4 text-center text-sm text-gray-500">לא נמצאו פריטים במלאי במחסן זה</div>
            ) : (
              <AvailablePartsSearchTable
                results={availableResults}
                parts={parts}
                fromWarehouse={fromWarehouse}
                getAvailableStock={getAvailableStock}
                getPartLocation={getPartLocation}
                getStockStatusColor={getStockStatusColor}
                disabled={isSubmitting}
                onAdd={(part, quantity) => handleSelectStock({ id: part.id, part_sku: part.sku, part_name: part.name }, quantity)}
                onPickSku={(sku) => setSearchTerm(sku)}
              />
            )}
          </div>
        </div>

        {/* Right side: selected items */}
        <div className="flex flex-col min-h-0 border rounded-md overflow-hidden">
          <div className="p-3 border-b shrink-0 bg-gray-50">
            <Label>פריטים שנבחרו ({formData.items.length})</Label>
          </div>
          <div className="flex-1 overflow-y-auto">
            {formData.items.length === 0 ? (
              <div className="p-4 text-center text-sm text-gray-500">טרם נבחרו פריטים</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHeader columnKey="part_sku">מק"ט</SortableHeader>
                    <SortableHeader columnKey="part_name">שם פריט</SortableHeader>
                    <TableHead className="text-center">מיקום</TableHead>
                    <TableHead className="text-center">זמין</TableHead>
                    <SortableHeader columnKey="quantity">כמות</SortableHeader>
                    <TableHead className="text-center">פעולות</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedItems.map((item, index) => {
                    const availableStock = fromWarehouse ? getAvailableStock(fromWarehouse.id, item.part_id) : 0;
                    const willBeNegative = Number(item.quantity) > availableStock;
                    const location = getPartLocation(item.part_sku);
                    
                    return (
                      <TableRow key={item.part_sku} className={willBeNegative ? 'bg-yellow-50' : ''}>
                        <TableCell className="font-mono text-center">{item.part_sku}</TableCell>
                        <TableCell className="text-center">{item.part_name}</TableCell>
                        <TableCell className="text-center">{location}</TableCell>
                        <TableCell className={`text-center font-medium ${getStockStatusColor(availableStock)}`}>
                          {availableStock}
                        </TableCell>
                        <TableCell className="w-32">
                          <div className="flex items-center justify-center gap-2">
                            <Input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => handleItemChange(item.part_sku, 'quantity', e.target.value)}
                              disabled={isSubmitting}
                              className={`w-20 text-center ${willBeNegative ? 'border-yellow-400' : ''}`}
                            />
                            {willBeNegative && (
                              <AlertTriangle className="h-4 w-4 text-yellow-600" title="כמות זו תיצור מלאי שלילי" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-red-500 hover:text-red-600"
                            disabled={isSubmitting}
                            onClick={() => removeItem(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      </div>

      <div className="shrink-0 space-y-2">
        <Label>הערות</Label>
        <Textarea
          value={formData.notes}
          onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
          placeholder="הערות נוספות להעברה"
          rows={2}
          disabled={isSubmitting}
        />
      </div>

      <div className="shrink-0 flex justify-between items-center gap-3 pt-3 border-t">
        <div>
          {transfer && onDelete && (
            <Button type="button" variant="destructive" disabled={isSubmitting} onClick={() => onDelete(transfer)}>
              <Trash2 className="h-4 w-4 ml-2" />
              מחק העברה
            </Button>
          )}
        </div>
        <div className="flex gap-3">
          <Button type="button" variant="ghost" disabled={isSubmitting} onClick={onCancel}>
            ביטול
          </Button>
          <Button 
            type="submit"
            disabled={isSubmitting || !formData.from_warehouse_name || !formData.to_warehouse_name || 
                     formData.items.length === 0 ||
                     formData.items.some(item => !item.part_sku || !item.part_id || !item.quantity || Number(item.quantity) <= 0)}
          >
            {isSubmitting && <Loader2 className="h-4 w-4 ml-2 animate-spin" />}
            {transfer ? 'עדכן העברה' : 'צור העברה'}
          </Button>
        </div>
      </div>
    </form>
  );
}