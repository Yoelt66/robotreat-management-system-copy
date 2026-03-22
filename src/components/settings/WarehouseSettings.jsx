import React, { useState, useEffect } from "react";
import { Warehouse } from "@/entities/Warehouse";
import { PartStock } from "@/entities/PartStock";
import { ImportMapping } from "@/entities/ImportMapping";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Search, Edit, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/components/ui/use-toast";

import WarehouseForm from "../warehouses/WarehouseForm";

export default function WarehouseSettings() {
  const [warehouses, setWarehouses] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedWarehouse, setSelectedWarehouse] = useState(null);
  const [partsData, setPartsData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [warehouseToDelete, setWarehouseToDelete] = useState(null);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [warehousesData, partsList] = await Promise.all([
        loadWarehouses(),
        PartStock.list()
      ]);
      setPartsData(partsList);
      // Ensure all existing warehouses are in import mappings
      if (warehousesData && warehousesData.length > 0) {
        await ensureAllWarehousesInMappings(warehousesData);
      }
    } catch (err) {
      console.error("Error loading data:", err);
      setError("אירעה שגיאה בטעינת נתוני המחסנים והמלאי.");
    } finally {
      setLoading(false);
    }
  };

  const loadWarehouses = async () => {
    try {
      let warehousesData = await Warehouse.list();
      
      // Sort warehouses by number
      warehousesData.sort((a, b) => (a.number || 0) - (b.number || 0));
      
      setWarehouses(warehousesData);
      setError("");
      return warehousesData;
    } catch (err) {
      console.error("Error loading warehouses:", err);
      setError("אירעה שגיאה בטעינת רשימת המחסנים");
      return [];
    }
  };

  const updatePartEntityFile = async (warehouses) => {
    try {
      console.log("Building new Part entity schema with warehouses:", warehouses);
      
      // Build the Part entity schema with current warehouses
      const partSchema = {
        "name": "Part",
        "type": "object",
        "properties": {
          "part_id": {"type": "string", "description": "מזהה ייחודי לפריט"},
          "sku": {"type": "string", "description": "מספר קטלוגי"},
          "name": {"type": "string", "description": "שם הפריט"},
          "category": {"type": "string", "description": "קטגורייה של הפריט"},
          "minimum_stock": {"type": "number", "description": "מלאי מינימלי להתראה"},
          "unit": {"type": "string", "description": "יחידת מידה של הפריט"},
          "notes": {"type": "string", "description": "הערות נוספות לפריט"},
          "replaced_sku": {"type": "string", "description": "מספר קטלוגי של פריט שהוחלף על ידי פריט זה"},
          "current_location": {"type": "string", "description": "מיקום נוכחי של הפריט במחסן"},
          "supplier_part_number": {"type": "string", "description": "מספר הפריט אצל הספק"},
          "supplier_number": {"type": "string", "description": "מספר הספק של הפריט"},
          "cost_price": {"type": "number", "description": "מחיר עלות הפריט"},
          "last_count_date": {"type": "string", "format": "date", "description": "תאריך ספירת מלאי אחרונה"},
          "cost_currency": {"type": "string", "enum": ["ILS", "USD", "EUR", "GBP"], "default": "ILS", "description": "מטבע מחיר העלות"},
          "sale_currency": {"type": "string", "enum": ["ILS", "USD", "EUR", "GBP"], "default": "ILS", "description": "מטבע מחיר המכירה"},
          "import_percentage": {"type": "number", "description": "אחוז עלויות ייבוא", "default": 15},
          "markup_percentage": {"type": "number", "description": "אחוז רווח למחיר מכירה", "default": 30},
          "exchange_rate": {"type": "number", "description": "שער חליפין לחישוב המחיר בין מטבע העלות למטבע המכירה", "default": 1},
          "manual_sale_price": {"type": "number", "description": "מחיר מכירה ידני"},
          "is_manual": {"type": "boolean", "default": false, "description": "האם המחיר נקבע ידנית"},
          "last_updated": {"type": "string", "format": "date", "description": "תאריך עדכון אחרון של המחירים"}
        },
        "required": ["sku", "name", "category", "unit"]
      };

      // Add warehouse columns dynamically
      warehouses.forEach(warehouse => {
        partSchema.properties[warehouse.warehouse_id] = {
          "type": "number",
          "default": 0,
          "description": `כמות במחסן ${warehouse.name}`
        };
      });

      console.log("New Part schema will be:", partSchema);
      
      const schemaJson = JSON.stringify(partSchema, null, 2);
      
      try {
        await navigator.clipboard.writeText(schemaJson);
        toast({
          title: "סכמת Part עודכנה",
          description: "הסכמה החדשה הועתקה ללוח. יש לעדכן את entities/Part.json ידנית",
          duration: 8000
        });
      } catch (clipboardError) {
        console.error("Failed to copy to clipboard:", clipboardError);
        toast({
          title: "סכמת Part עודכנה",
          description: "יש לעדכן את entities/Part.json ידנית - בדוק את הקונסול",
          duration: 8000
        });
      }
      
      console.log("=== COPY THIS TO entities/Part.json ===");
      console.log(schemaJson);
      console.log("=== END PART SCHEMA ===");
      
    } catch (error) {
      console.error("Error updating Part entity schema:", error);
      toast({
        variant: "destructive",
        title: "שגיאה בעדכון סכמת Part",
        description: error.message
      });
    }
  };

  const addWarehouseColumnToAllParts = async (warehouseId, warehouseName) => {
    try {
      console.log(`Adding warehouse column ${warehouseId} to all part records...`);
      
      const allParts = await PartStock.list();
      console.log(`Found ${allParts.length} part records to update`);
      
      let updatedCount = 0;
      let errorCount = 0;
      
      const batchSize = 5;
      for (let i = 0; i < allParts.length; i += batchSize) {
        const batch = allParts.slice(i, i + batchSize);
        
        await Promise.all(batch.map(async (part) => {
          try {
            if (!part.hasOwnProperty(warehouseId)) {
              const updateData = { [warehouseId]: 0 };
              await PartStock.update(part.id, updateData);
              updatedCount++;
            } else {
              console.log(`Part ${part.id} already has ${warehouseId} column, skipping`);
            }
          } catch (error) {
            console.error(`Failed to add ${warehouseId} column to part ${part.id}:`, error);
            errorCount++;
          }
        }));
        
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      console.log(`Warehouse column addition completed: ${updatedCount} updated, ${errorCount} errors`);
      
      if (errorCount > 0) {
        toast({
          variant: "destructive",
          title: "עדכון חלקי של המלאי",
          description: `${updatedCount} רשומות עודכנו, ${errorCount} שגיאות`
        });
      } else {
        toast({
          title: "עמודת מחסן נוספה",
          description: `עמודת ${warehouseName} נוספה ל-${updatedCount} רשומות מלאי`
        });
      }
      
    } catch (error) {
      console.error("Error adding warehouse column to parts:", error);
      toast({
        variant: "destructive",
        title: "שגיאה בעדכון המלאי",
        description: error.message
      });
    }
  };

  const removeWarehouseColumnFromAllParts = async (warehouseId, warehouseName) => {
    try {
      console.log(`Removing warehouse column ${warehouseId} from all part records...`);
      
      const allParts = await PartStock.list();
      console.log(`Found ${allParts.length} part records to update`);
      
      let removedCount = 0;
      let errorCount = 0;
      
      const batchSize = 5;
      for (let i = 0; i < allParts.length; i += batchSize) {
        const batch = allParts.slice(i, i + batchSize);
        
        await Promise.all(batch.map(async (part) => {
          try {
            if (part.hasOwnProperty(warehouseId)) {
              const updateData = { [warehouseId]: null };
              await PartStock.update(part.id, updateData);
              removedCount++;
              console.log(`Removed ${warehouseId} column from part ${part.id}`);
            } else {
              console.log(`Part ${part.id} doesn't have ${warehouseId} column, skipping`);
            }
          } catch (error) {
            console.error(`Failed to remove ${warehouseId} column from part ${part.id}:`, error);
            errorCount++;
          }
        }));
        
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      console.log(`Warehouse column removal completed: ${removedCount} updated, ${errorCount} errors`);
      
      if (errorCount > 0) {
        toast({
          variant: "destructive",
          title: "הסרה חלקית של עמודת מחסן",
          description: `${removedCount} רשומות עודכנו, ${errorCount} שגיאות`
        });
      } else {
        toast({
          title: "עמודת מחסן הוסרה",
          description: `עמודת ${warehouseName} הוסרה מ-${removedCount} רשומות מלאי`
        });
      }
      
    } catch (error) {
      console.error("Error removing warehouse column from parts:", error);
      toast({
        variant: "destructive",
        title: "שגיאה בהסרת עמודת מחסן",
        description: error.message
      });
    }
  };

  const syncWarehouseToImportMappings = async (warehouseId, warehouseName, remove = false) => {
    try {
      const mappings = await ImportMapping.list();
      for (const mapping of mappings) {
        const fields = Array.isArray(mapping.mapping) ? mapping.mapping : [];
        const exists = fields.some(f => f.key === warehouseId);

        if (!remove && !exists) {
          // Add warehouse field to mapping
          const maxColumn = fields.filter(f => f.checked && f.column).reduce((max, f) => Math.max(max, f.column || 0), 0);
          const newField = { key: warehouseId, label: `מלאי: ${warehouseName}`, checked: true, is_required: false, column: maxColumn + 1 };
          await ImportMapping.update(mapping.id, { mapping: [...fields, newField] });
        } else if (remove && exists) {
          // Remove warehouse field from mapping
          const updatedFields = fields.filter(f => f.key !== warehouseId);
          await ImportMapping.update(mapping.id, { mapping: updatedFields });
        }
      }
    } catch (err) {
      console.error("Error syncing warehouse to import mappings:", err);
    }
  };

  const ensureAllWarehousesInMappings = async (allWarehouses) => {
    try {
      const mappings = await ImportMapping.list();
      for (const mapping of mappings) {
        const fields = Array.isArray(mapping.mapping) ? mapping.mapping : [];
        let updated = [...fields];
        let changed = false;
        let maxColumn = fields.filter(f => f.checked && f.column).reduce((max, f) => Math.max(max, f.column || 0), 0);

        for (const wh of allWarehouses) {
          if (!updated.some(f => f.key === wh.warehouse_id)) {
            maxColumn++;
            updated.push({ key: wh.warehouse_id, label: `מלאי: ${wh.name}`, checked: true, is_required: false, column: maxColumn });
            changed = true;
          }
        }
        if (changed) {
          await ImportMapping.update(mapping.id, { mapping: updated });
        }
      }
    } catch (err) {
      console.error("Error ensuring warehouses in mappings:", err);
    }
  };

  const handleSubmit = async (data) => {
    setIsCreating(true);
    try {
      if (selectedWarehouse) {
        await Warehouse.update(selectedWarehouse.id, data);
        toast({ title: "המחסן עודכן בהצלחה" });
      } else {
        const warehouseId = `WH-${String(data.number).padStart(3, '0')}`;
        const newWarehouseData = {
          ...data,
          warehouse_id: warehouseId
        };
        
        const newWarehouse = await Warehouse.create(newWarehouseData);
        
        const updatedWarehouses = await Warehouse.list();
        
        await updatePartEntityFile(updatedWarehouses);
        await addWarehouseColumnToAllParts(newWarehouse.warehouse_id, data.name);
        await syncWarehouseToImportMappings(newWarehouse.warehouse_id, data.name);
        
        toast({ 
          title: "מחסן חדש נוסף",
          description: `מחסן ${data.name} נוסף ועמודת מלאי נוצרה`
        });
      }
      
      setShowForm(false);
      setSelectedWarehouse(null);
      await loadData();
      
    } catch (error) {
      console.error("Error saving warehouse:", error);
      toast({
        variant: "destructive",
        title: "שגיאה בשמירת המחסן",
        description: error.message || "אירעה שגיאה לא צפויה"
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleEdit = (warehouse) => {
    setSelectedWarehouse(warehouse);
    setShowForm(true);
  };

  const handleDeleteWarehouse = async () => {
    if (!warehouseToDelete) return;
    
    setLoading(true);
    try {
      console.log(`Deleting warehouse: ${warehouseToDelete.name} (${warehouseToDelete.warehouse_id})`);
      
      await removeWarehouseColumnFromAllParts(warehouseToDelete.warehouse_id, warehouseToDelete.name);
      await Warehouse.delete(warehouseToDelete.id);

      const updatedWarehouses = await Warehouse.list();
      await updatePartEntityFile(updatedWarehouses);
      
      toast({ 
        title: "מחסן נמחק בהצלחה",
        description: `מחסן ${warehouseToDelete.name} נמחק ועמודת המלאי הוסרה`,
        duration: 5000
      });
      
      setWarehouseToDelete(null);
      await loadData();
      
    } catch (error) {
      console.error("Error deleting warehouse:", error);
      toast({
        variant: "destructive",
        title: "שגיאה במחיקת המחסן", 
        description: error.message || "אירעה שגיאה לא צפויה"
      });
    } finally {
      setLoading(false);
    }
  };

  const isWarehouseEmpty = (warehouse) => {
    if (!partsData.length || !warehouse.warehouse_id) return true;
    return !partsData.some(s => s.warehouse_id === warehouse.warehouse_id && (s.quantity || 0) > 0);
  };

  const getWarehouseStockCount = (warehouse) => {
    if (!partsData.length || !warehouse.warehouse_id) return 0;
    return partsData
      .filter(s => s.warehouse_id === warehouse.warehouse_id)
      .reduce((total, s) => total + (s.quantity || 0), 0);
  };

  const filteredWarehouses = warehouses.filter(warehouse =>
    warehouse.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    warehouse.number?.toString().includes(searchTerm) ||
    warehouse.warehouse_id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>ניהול מחסנים</CardTitle>
        <Button 
          onClick={() => {
            setSelectedWarehouse(null);
            setShowForm(true);
          }}
          disabled={isCreating || loading}
        >
          <Plus className="w-4 h-4 ml-2" /> 
          {isCreating ? "יוצר מחסן..." : "הוסף מחסן"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="relative">
          <Search className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            placeholder="חיפוש מחסנים..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pr-9"
            disabled={loading || isCreating}
          />
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {showForm && (
          <WarehouseForm
            warehouse={selectedWarehouse}
            existingWarehouses={warehouses}
            onSubmit={handleSubmit}
            onCancel={() => {
              setShowForm(false);
              setSelectedWarehouse(null);
            }}
            onDelete={selectedWarehouse && isWarehouseEmpty(selectedWarehouse) ? 
              () => setWarehouseToDelete(selectedWarehouse) : null
            }
            loading={isCreating}
          />
        )}

        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-center">מזהה מחסן</TableHead>
                <TableHead className="text-center">מספר מחסן</TableHead>
                <TableHead className="text-center">שם המחסן</TableHead>
                <TableHead className="text-center">סטטוס מלאי</TableHead>
                <TableHead className="text-center">סה"כ פריטים</TableHead>
                <TableHead className="text-center">פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && !filteredWarehouses.length ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                    טוען נתונים...
                  </TableCell>
                </TableRow>
              ) : filteredWarehouses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                    לא נמצאו מחסנים.
                  </TableCell>
                </TableRow>
              ) : (
                filteredWarehouses.map((warehouse) => {
                  const isEmpty = isWarehouseEmpty(warehouse);
                  const stockCount = getWarehouseStockCount(warehouse);
                  
                  return (
                    <TableRow key={warehouse.id}>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="font-mono text-xs">
                          {warehouse.warehouse_id || 'לא מוגדר'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="font-mono">
                          {warehouse.number}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center font-medium">
                        {warehouse.name}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={isEmpty ? "secondary" : "default"}>
                          {isEmpty ? "ריק" : "יש מלאי"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={isEmpty ? "text-gray-500" : "text-green-600 font-medium"}>
                          {stockCount} יח'
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(warehouse)}
                            disabled={loading || isCreating}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {isEmpty && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-500 hover:text-red-600"
                              onClick={() => setWarehouseToDelete(warehouse)}
                              disabled={loading || isCreating}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        <AlertDialog open={!!warehouseToDelete} onOpenChange={() => setWarehouseToDelete(null)}>
          <AlertDialogContent dir="rtl">
            <AlertDialogHeader>
              <AlertDialogTitle>אישור מחיקת מחסן</AlertDialogTitle>
              <AlertDialogDescription>
                האם אתה בטוח שברצונך למחוק את המחסן "{warehouseToDelete?.name}"?
                פעולה זו בלתי הפיכה ותסיר גם את עמודת המלאי של המחסן מכל הפריטים.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={loading}>ביטול</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteWarehouse}
                className="bg-red-600 hover:bg-red-700"
                disabled={loading}
              >
                <Trash2 className="h-4 w-4 ml-2" />
                {loading ? "מוחק..." : "מחק מחסן"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}