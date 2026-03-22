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
  const warehouseToDeleteRef = React.useRef(null);

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
      // Ensure all existing warehouses are in import mappings (fire & forget)
      if (warehousesData && warehousesData.length > 0) {
        ensureAllWarehousesInMappings(warehousesData).catch(console.error);
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

  const addWarehouseColumnToAllParts = async (warehouseId) => {
    try {
      const { PartCore } = await import("@/entities/PartCore");
      const allPartCores = await PartCore.list();
      const existingStocks = await PartStock.filter({ warehouse_id: warehouseId });
      const existingSkus = new Set(existingStocks.map(s => s.part_sku));

      const toCreate = allPartCores.filter(p => !existingSkus.has(p.sku));
      const batchSize = 5;
      for (let i = 0; i < toCreate.length; i += batchSize) {
        const batch = toCreate.slice(i, i + batchSize);
        await Promise.all(batch.map(p =>
          PartStock.create({ part_sku: p.sku, warehouse_id: warehouseId, quantity: 0 })
        ));
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    } catch (error) {
      console.error("Error adding warehouse stock records:", error);
    }
  };

  const removeWarehouseColumnFromAllParts = async (warehouseId, warehouseName) => {
    try {
      // PartStock records have warehouse_id field - delete all records for this warehouse
      const warehouseStockRecords = await PartStock.filter({ warehouse_id: warehouseId });
      
      let removedCount = 0;
      let errorCount = 0;
      
      const batchSize = 5;
      for (let i = 0; i < warehouseStockRecords.length; i += batchSize) {
        const batch = warehouseStockRecords.slice(i, i + batchSize);
        await Promise.all(batch.map(async (record) => {
          try {
            await PartStock.delete(record.id);
            removedCount++;
          } catch (error) {
            console.error(`Failed to delete PartStock record ${record.id}:`, error);
            errorCount++;
          }
        }));
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      if (errorCount > 0) {
        toast({
          variant: "destructive",
          title: "הסרה חלקית של מלאי מחסן",
          description: `${removedCount} רשומות נמחקו, ${errorCount} שגיאות`
        });
      }
      
    } catch (error) {
      console.error("Error removing warehouse stock records:", error);
      toast({
        variant: "destructive",
        title: "שגיאה בהסרת מלאי המחסן",
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
        
        await addWarehouseColumnToAllParts(newWarehouse.warehouse_id);
        await syncWarehouseToImportMappings(newWarehouse.warehouse_id, data.name);
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
    const target = warehouseToDeleteRef.current;
    if (!target) return;
    
    setLoading(true);
    try {
      await removeWarehouseColumnFromAllParts(target.warehouse_id, target.name);
      await syncWarehouseToImportMappings(target.warehouse_id, target.name, true);
      await Warehouse.delete(target.id);
      
      warehouseToDeleteRef.current = null;
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
                              onClick={() => { warehouseToDeleteRef.current = warehouse; setWarehouseToDelete(warehouse); }}
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

        <AlertDialog open={!!warehouseToDelete} onOpenChange={(open) => { if (!open && !loading) { warehouseToDeleteRef.current = null; setWarehouseToDelete(null); } }}>
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
                onClick={(e) => {
                  e.preventDefault();
                  handleDeleteWarehouse();
                }}
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