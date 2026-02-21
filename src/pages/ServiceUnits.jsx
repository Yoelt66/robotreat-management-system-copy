import React, { useState, useEffect } from "react";
import { ServiceUnit } from "@/entities/ServiceUnit";
import { Customer } from "@/entities/Customer";
import { MaintenanceType } from "@/entities/MaintenanceType";
import { UnitBrand } from "@/entities/UnitBrand";
import { getParts } from "@/functions/getParts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Plus, Pencil, Trash2, Search, Box, Settings } from "lucide-react";
import { toast } from "sonner";
import VisitSequenceEditor from "@/components/schedule/VisitSequenceEditor";

export default function ServiceUnitsPage() {
  const [units, setUnits] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [maintenanceTypes, setMaintenanceTypes] = useState([]);
  const [unitBrands, setUnitBrands] = useState([]);
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingUnit, setEditingUnit] = useState(null);
  const [unitToDelete, setUnitToDelete] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCustomer, setFilterCustomer] = useState("all");

  const [formData, setFormData] = useState({
    active: true,
    customer_id: "",
    brand_id: "",
    name: "",
    type: "",
    model: "",
    serial_number: "",
    installation_date: "",
    visit_interval_months: 3,
    current_visit_step: 1,
    visit_sequence: [],
    notes: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [unitsData, customersData, typesData, brandsData] = await Promise.all([
        ServiceUnit.list(),
        Customer.list(),
        MaintenanceType.list(),
        UnitBrand.list(),
      ]);
      setUnits(unitsData);
      setCustomers(customersData);
      setMaintenanceTypes(typesData);
      setUnitBrands(brandsData);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadPartsIfNeeded = async () => {
    if (parts.length > 0) return;
    try {
      const partsResponse = await getParts();
      setParts(partsResponse?.data?.data || []);
    } catch (error) {
      console.error("Error loading parts:", error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingUnit) {
        await ServiceUnit.update(editingUnit.id, formData);
        toast.success("היחידה עודכנה בהצלחה", { duration: 5000 });
      } else {
        await ServiceUnit.create(formData);
        toast.success("היחידה נוצרה בהצלחה", { duration: 5000 });
      }
      setShowForm(false);
      setEditingUnit(null);
      resetForm();
      await loadData();
    } catch (error) {
      console.error("Error saving unit:", error);
      toast.error("שגיאה בשמירה", { duration: 5000 });
    }
  };

  const handleDelete = async () => {
    if (!unitToDelete) return;
    try {
      await ServiceUnit.delete(unitToDelete.id);
      toast.success("היחידה נמחקה בהצלחה", { duration: 5000 });
      setUnitToDelete(null);
      await loadData();
    } catch (error) {
      console.error("Error deleting unit:", error);
      toast.error("שגיאה במחיקה", { duration: 5000 });
    }
  };

  const openEditForm = (unit) => {
    loadPartsIfNeeded();
    setEditingUnit(unit);
    setFormData({
      active: unit.active !== false,
      customer_id: unit.customer_id || "",
      brand_id: unit.brand_id || "",
      name: unit.name || "",
      type: unit.type || "",
      model: unit.model || "",
      serial_number: unit.serial_number || "",
      installation_date: unit.installation_date || "",
      visit_interval_months: unit.visit_interval_months || 3,
      current_visit_step: unit.current_visit_step || 1,
      visit_sequence: unit.visit_sequence || [],
      notes: unit.notes || "",
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setFormData({
      active: true,
      customer_id: "",
      brand_id: "",
      name: "",
      type: "",
      model: "",
      serial_number: "",
      installation_date: "",
      visit_interval_months: 3,
      current_visit_step: 1,
      visit_sequence: [],
      notes: "",
    });
  };

  // Handle brand change - copy defaults from brand
  const handleBrandChange = (brandId) => {
    const brand = unitBrands.find((b) => b.id === brandId);
    if (brand) {
      const defaultSequence = (brand.default_visit_sequence || []).map((step) => ({
        ...step,
        use_custom_parts: false,
        custom_parts: [],
      }));
      
      setFormData({
        ...formData,
        brand_id: brandId,
        type: "",
        visit_interval_months: brand.default_visit_interval_months || 3,
        visit_sequence: defaultSequence,
        current_visit_step: 1,
      });
    } else {
      setFormData({ ...formData, brand_id: brandId, type: "" });
    }
  };

  // Get available unit types for selected brand
  const getAvailableUnitTypes = () => {
    if (!formData.brand_id) return [];
    const brand = unitBrands.find((b) => b.id === formData.brand_id);
    return brand?.unit_types || [];
  };

  const getBrandName = (brandId) => {
    return unitBrands.find((b) => b.id === brandId)?.name || "-";
  };

  const getCustomerName = (customerId) => {
    return customers.find((c) => c.id === customerId)?.name || "לא ידוע";
  };

  const filteredUnits = units.filter((u) => {
    const matchesSearch =
      u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.serial_number?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCustomer = filterCustomer === "all" || u.customer_id === filterCustomer;
    return matchesSearch && matchesCustomer;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-800">יחידות שירות</h1>
        <Button onClick={() => { resetForm(); setEditingUnit(null); setShowForm(true); }}>
          <Plus className="h-4 w-4 ml-2" />
          יחידה חדשה
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="חיפוש יחידות..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-9"
              />
            </div>
            <Select value={filterCustomer} onValueChange={setFilterCustomer}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="כל הלקוחות" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הלקוחות</SelectItem>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>שם</TableHead>
                <TableHead>לקוח</TableHead>
                <TableHead>מותג</TableHead>
                <TableHead>סוג</TableHead>
                <TableHead>מספר סידורי</TableHead>
                <TableHead className="text-center">מרווח ביקורים</TableHead>
                <TableHead className="text-center">סטטוס</TableHead>
                <TableHead className="text-center">פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUnits.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-slate-500 py-8">
                    <Box className="h-12 w-12 mx-auto mb-2 text-slate-300" />
                    אין יחידות להצגה
                  </TableCell>
                </TableRow>
              ) : (
                filteredUnits.map((unit) => (
                  <TableRow key={unit.id}>
                    <TableCell className="font-medium">{unit.name}</TableCell>
                    <TableCell>{getCustomerName(unit.customer_id)}</TableCell>
                    <TableCell>{getBrandName(unit.brand_id)}</TableCell>
                    <TableCell>{unit.type || "-"}</TableCell>
                    <TableCell>{unit.serial_number || "-"}</TableCell>
                    <TableCell className="text-center">{unit.visit_interval_months || 3} חודשים</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={unit.active !== false ? "default" : "secondary"}>
                        {unit.active !== false ? "פעיל" : "לא פעיל"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openEditForm(unit)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-500 hover:text-red-600"
                          onClick={() => setUnitToDelete(unit)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Unit Form Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) { setShowForm(false); setEditingUnit(null); } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editingUnit ? "עריכת יחידה" : "יחידה חדשה"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.active}
                onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
              />
              <Label>יחידה פעילה</Label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>לקוח *</Label>
                <Select
                  value={formData.customer_id}
                  onValueChange={(value) => setFormData({ ...formData, customer_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="בחר לקוח" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>שם יחידה *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>מותג</Label>
                <Select
                  value={formData.brand_id}
                  onValueChange={handleBrandChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="בחר מותג" />
                  </SelectTrigger>
                  <SelectContent>
                    {unitBrands.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>סוג</Label>
                {getAvailableUnitTypes().length > 0 ? (
                  <Select
                    value={formData.type}
                    onValueChange={(value) => setFormData({ ...formData, type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="בחר סוג" />
                    </SelectTrigger>
                    <SelectContent>
                      {getAvailableUnitTypes().map((type) => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    placeholder={formData.brand_id ? "לא הוגדרו סוגים למותג" : "בחר מותג קודם או הזן ידנית"}
                  />
                )}
              </div>

              <div className="space-y-2">
                <Label>דגם</Label>
                <Input
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>מספר סידורי</Label>
                <Input
                  value={formData.serial_number}
                  onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>תאריך התקנה</Label>
                <Input
                  type="date"
                  value={formData.installation_date}
                  onChange={(e) => setFormData({ ...formData, installation_date: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>מרווח בין ביקורים (חודשים)</Label>
                <Input
                  type="number"
                  min="1"
                  value={formData.visit_interval_months}
                  onChange={(e) => setFormData({ ...formData, visit_interval_months: parseInt(e.target.value) || 3 })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                רצף ביקורים
              </Label>
              <VisitSequenceEditor
                sequence={formData.visit_sequence}
                onChange={(sequence) => setFormData({ ...formData, visit_sequence: sequence })}
                maintenanceTypes={maintenanceTypes}
                parts={parts}
              />
            </div>

            <div className="space-y-2">
              <Label>הערות</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditingUnit(null); }}>
                ביטול
              </Button>
              <Button type="submit">{editingUnit ? "עדכן" : "צור"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!unitToDelete} onOpenChange={() => setUnitToDelete(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>אישור מחיקה</AlertDialogTitle>
            <AlertDialogDescription>
              האם אתה בטוח שברצונך למחוק את היחידה "{unitToDelete?.name}"?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              מחק
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}