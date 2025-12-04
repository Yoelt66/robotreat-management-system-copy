import React, { useState, useEffect } from "react";
import { UnitBrand } from "@/entities/UnitBrand";
import { MaintenanceType } from "@/entities/MaintenanceType";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, Box, ChevronUp, ChevronDown, X } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

export default function UnitBrandSettings() {
  const [brands, setBrands] = useState([]);
  const [maintenanceTypes, setMaintenanceTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingBrand, setEditingBrand] = useState(null);
  const [brandToDelete, setBrandToDelete] = useState(null);
  const [newUnitType, setNewUnitType] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    unit_types: [],
    default_visit_interval_months: 3,
    default_visit_sequence: [],
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [brandsData, typesData] = await Promise.all([
        UnitBrand.list(),
        MaintenanceType.list(),
      ]);
      setBrands(brandsData);
      setMaintenanceTypes(typesData);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingBrand) {
        await UnitBrand.update(editingBrand.id, formData);
        toast({ title: "המותג עודכן בהצלחה" });
      } else {
        await UnitBrand.create(formData);
        toast({ title: "המותג נוצר בהצלחה" });
      }
      setShowForm(false);
      setEditingBrand(null);
      resetForm();
      await loadData();
    } catch (error) {
      console.error("Error saving brand:", error);
      toast({ variant: "destructive", title: "שגיאה בשמירה" });
    }
  };

  const handleDelete = async () => {
    if (!brandToDelete) return;
    try {
      await UnitBrand.delete(brandToDelete.id);
      toast({ title: "המותג נמחק בהצלחה" });
      setBrandToDelete(null);
      await loadData();
    } catch (error) {
      console.error("Error deleting brand:", error);
      toast({ variant: "destructive", title: "שגיאה במחיקה" });
    }
  };

  const openEditForm = (brand) => {
    setEditingBrand(brand);
    setFormData({
      name: brand.name || "",
      unit_types: brand.unit_types || [],
      default_visit_interval_months: brand.default_visit_interval_months || 3,
      default_visit_sequence: brand.default_visit_sequence || [],
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setFormData({
      name: "",
      unit_types: [],
      default_visit_interval_months: 3,
      default_visit_sequence: [],
    });
    setNewUnitType("");
  };

  // Unit Types Management
  const handleAddUnitType = () => {
    if (newUnitType.trim() && !formData.unit_types.includes(newUnitType.trim())) {
      setFormData({
        ...formData,
        unit_types: [...formData.unit_types, newUnitType.trim()],
      });
      setNewUnitType("");
    }
  };

  const handleRemoveUnitType = (type) => {
    setFormData({
      ...formData,
      unit_types: formData.unit_types.filter((t) => t !== type),
    });
  };

  // Sequence Management
  const handleAddSequenceStep = (maintenanceTypeId) => {
    if (!maintenanceTypeId) return;
    const newStep = {
      step_number: formData.default_visit_sequence.length + 1,
      maintenance_type_id: maintenanceTypeId,
    };
    setFormData({
      ...formData,
      default_visit_sequence: [...formData.default_visit_sequence, newStep],
    });
  };

  const handleRemoveSequenceStep = (stepNumber) => {
    const newSequence = formData.default_visit_sequence
      .filter((s) => s.step_number !== stepNumber)
      .map((s, idx) => ({ ...s, step_number: idx + 1 }));
    setFormData({ ...formData, default_visit_sequence: newSequence });
  };

  const handleMoveSequenceStep = (stepNumber, direction) => {
    const newSequence = [...formData.default_visit_sequence];
    const idx = newSequence.findIndex((s) => s.step_number === stepNumber);
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= newSequence.length) return;
    
    [newSequence[idx], newSequence[targetIdx]] = [newSequence[targetIdx], newSequence[idx]];
    newSequence.forEach((s, i) => { s.step_number = i + 1; });
    setFormData({ ...formData, default_visit_sequence: newSequence });
  };

  const getMaintenanceTypeName = (typeId) => {
    const type = maintenanceTypes.find((t) => t.id === typeId);
    return type?.name || "לא ידוע";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">מותגי יחידות</h2>
          <p className="text-sm text-slate-500">ניהול מותגים וסוגי יחידות עם רצף ביקורים ברירת מחדל</p>
        </div>
        <Button onClick={() => { resetForm(); setEditingBrand(null); setShowForm(true); }}>
          <Plus className="h-4 w-4 ml-2" />
          מותג חדש
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>שם המותג</TableHead>
                <TableHead>סוגי יחידות</TableHead>
                <TableHead className="text-center">מרווח ביקורים</TableHead>
                <TableHead className="text-center">שלבי רצף</TableHead>
                <TableHead className="text-center">פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {brands.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-slate-500 py-8">
                    <Box className="h-12 w-12 mx-auto mb-2 text-slate-300" />
                    אין מותגים להצגה
                  </TableCell>
                </TableRow>
              ) : (
                brands.map((brand) => (
                  <TableRow key={brand.id}>
                    <TableCell className="font-medium">{brand.name}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(brand.unit_types || []).map((type) => (
                          <Badge key={type} variant="outline">{type}</Badge>
                        ))}
                        {(!brand.unit_types || brand.unit_types.length === 0) && (
                          <span className="text-slate-400">-</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {brand.default_visit_interval_months || 3} חודשים
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">
                        {brand.default_visit_sequence?.length || 0} שלבים
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openEditForm(brand)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-500 hover:text-red-600"
                          onClick={() => setBrandToDelete(brand)}
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

      {/* Brand Form Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) { setShowForm(false); setEditingBrand(null); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editingBrand ? "עריכת מותג" : "מותג חדש"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>שם המותג *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>מרווח ביקורים (חודשים)</Label>
                <Input
                  type="number"
                  min="1"
                  value={formData.default_visit_interval_months}
                  onChange={(e) => setFormData({ ...formData, default_visit_interval_months: parseInt(e.target.value) || 3 })}
                />
              </div>
            </div>

            {/* Unit Types */}
            <div className="space-y-2">
              <Label>סוגי יחידות</Label>
              <div className="flex gap-2">
                <Input
                  value={newUnitType}
                  onChange={(e) => setNewUnitType(e.target.value)}
                  placeholder="הוסף סוג יחידה..."
                  onKeyPress={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddUnitType(); } }}
                />
                <Button type="button" onClick={handleAddUnitType}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {formData.unit_types.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.unit_types.map((type) => (
                    <Badge key={type} variant="secondary" className="gap-1">
                      {type}
                      <button type="button" onClick={() => handleRemoveUnitType(type)}>
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Default Visit Sequence */}
            <div className="space-y-2">
              <Label>רצף ביקורים ברירת מחדל</Label>
              <div className="flex gap-2">
                <Select onValueChange={handleAddSequenceStep}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="בחר סוג תחזוקה להוספה..." />
                  </SelectTrigger>
                  <SelectContent>
                    {maintenanceTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {formData.default_visit_sequence.length > 0 && (
                <div className="border rounded-lg divide-y mt-2">
                  {formData.default_visit_sequence.map((step, idx) => (
                    <div key={step.step_number} className="flex items-center gap-2 p-2">
                      <span className="text-sm font-medium w-8">{step.step_number}.</span>
                      <span className="flex-1">{getMaintenanceTypeName(step.maintenance_type_id)}</span>
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={idx === 0}
                          onClick={() => handleMoveSequenceStep(step.step_number, "up")}
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={idx === formData.default_visit_sequence.length - 1}
                          onClick={() => handleMoveSequenceStep(step.step_number, "down")}
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-red-500"
                          onClick={() => handleRemoveSequenceStep(step.step_number)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditingBrand(null); }}>
                ביטול
              </Button>
              <Button type="submit">{editingBrand ? "עדכן" : "צור"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!brandToDelete} onOpenChange={() => setBrandToDelete(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>אישור מחיקה</AlertDialogTitle>
            <AlertDialogDescription>
              האם אתה בטוח שברצונך למחוק את המותג "{brandToDelete?.name}"?
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