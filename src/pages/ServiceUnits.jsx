import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Search, Box, CheckCircle2, Circle, Pencil, Trash2, Settings2 } from "lucide-react";
import { toast } from "sonner";
import UnitDialog from "@/components/field/UnitDialog";

export default function ServiceUnitsPage() {
  const [units, setUnits] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [unitBrands, setUnitBrands] = useState([]);
  const [maintenanceTypes, setMaintenanceTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCustomer, setFilterCustomer] = useState("all");
  const [showDialog, setShowDialog] = useState(false);
  const [editingUnit, setEditingUnit] = useState(null);
  const [unitToDelete, setUnitToDelete] = useState(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [unitsData, customersData, brandsData, typesData] = await Promise.all([
        base44.entities.ServiceUnit.list(),
        base44.entities.Customer.list(),
        base44.entities.UnitBrand.list(),
        base44.entities.MaintenanceType.list(),
      ]);
      setUnits(unitsData || []);
      setCustomers(customersData || []);
      setUnitBrands(brandsData || []);
      setMaintenanceTypes(typesData || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (data) => {
    try {
      if (editingUnit) {
        await base44.entities.ServiceUnit.update(editingUnit.id, data);
        toast.success("היחידה עודכנה");
      } else {
        await base44.entities.ServiceUnit.create(data);
        toast.success("היחידה נוצרה");
      }
      setShowDialog(false);
      setEditingUnit(null);
      loadData();
    } catch {
      toast.error("שגיאה בשמירה");
    }
  };

  const handleDelete = async () => {
    if (!unitToDelete) return;
    try {
      await base44.entities.ServiceUnit.delete(unitToDelete.id);
      toast.success("היחידה נמחקה");
      setUnitToDelete(null);
      loadData();
    } catch {
      toast.error("שגיאה במחיקה");
    }
  };

  const getBrandName = (id) => unitBrands.find(b => b.id === id)?.name || "-";
  const getCustomerName = (id) => customers.find(c => c.id === id)?.name || "לא ידוע";

  const filtered = units.filter(u => {
    const matchSearch = u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.serial_number?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCustomer = filterCustomer === "all" || u.customer_id === filterCustomer;
    return matchSearch && matchCustomer;
  });

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div></div>;

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">יחידות שירות</h1>
          <p className="text-sm text-slate-500 mt-1">{units.length} יחידות רשומות</p>
        </div>
        <Button onClick={() => { setEditingUnit(null); setShowDialog(true); }}>
          <Plus className="h-4 w-4 ml-2" />
          יחידה חדשה
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input placeholder="חיפוש..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pr-9" />
        </div>
        <Select value={filterCustomer} onValueChange={setFilterCustomer}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="כל הלקוחות" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל הלקוחות</SelectItem>
            {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <Box className="h-12 w-12 mx-auto mb-3 text-slate-200" />
            אין יחידות להצגה
          </div>
        ) : (
          filtered.map(unit => (
            <Card key={unit.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="shrink-0">
                    {unit.active !== false
                      ? <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                      : <Circle className="h-5 w-5 text-slate-300" />}
                  </div>
                  <div className="flex-1 grid grid-cols-2 sm:grid-cols-5 gap-2 text-sm min-w-0">
                    <div className="font-semibold text-slate-800 truncate">{unit.name}</div>
                    <div className="text-slate-600 truncate">{getCustomerName(unit.customer_id)}</div>
                    <div className="text-slate-500">{getBrandName(unit.brand_id)}{unit.type ? ` · ${unit.type}` : ""}</div>
                    <div className="text-slate-400 text-xs">{unit.serial_number || 'ללא מ"ס'}</div>
                    <div className="text-slate-400 text-xs flex items-center gap-1">
                      <Settings2 className="h-3 w-3" />
                      {unit.visit_sequence?.length > 0 ? `${unit.visit_sequence.length} שלבים` : `כל ${unit.visit_interval_months || 3} ח'`}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingUnit(unit); setShowDialog(true); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => setUnitToDelete(unit)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {showDialog && (
        <UnitDialog
          unit={editingUnit}
          customers={customers}
          unitBrands={unitBrands}
          maintenanceTypes={maintenanceTypes}
          onSave={handleSave}
          onClose={() => { setShowDialog(false); setEditingUnit(null); }}
        />
      )}

      <AlertDialog open={!!unitToDelete} onOpenChange={() => setUnitToDelete(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>מחיקת יחידה</AlertDialogTitle>
            <AlertDialogDescription>האם למחוק את "{unitToDelete?.name}"?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">מחק</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}