import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { getParts } from "@/functions/getParts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Wrench, Clock, Filter } from "lucide-react";
import { toast } from "sonner";
import MaintenanceTypeStepsEditor from "@/components/schedule/MaintenanceTypeStepsEditor";

const DEFAULT_FORM = { name: "", brand_id: "", description: "", steps: [], estimated_duration_hours: 1, color: "#10b981" };

export default function MaintenanceTypesPage() {
  const [types, setTypes] = useState([]);
  const [parts, setParts] = useState([]);
  const [unitBrands, setUnitBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingType, setEditingType] = useState(null);
  const [typeToDelete, setTypeToDelete] = useState(null);
  const [filterBrand, setFilterBrand] = useState("all");
  const [formData, setFormData] = useState(DEFAULT_FORM);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [typesData, brandsData, partsResponse] = await Promise.all([
        base44.entities.MaintenanceType.list(),
        base44.entities.UnitBrand.list(),
        getParts(),
      ]);
      setTypes(typesData || []);
      setUnitBrands(brandsData || []);
      setParts(partsResponse?.data?.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = { ...formData, brand_id: formData.brand_id || null };
      if (editingType) {
        await base44.entities.MaintenanceType.update(editingType.id, data);
        toast.success("סוג התחזוקה עודכן");
      } else {
        await base44.entities.MaintenanceType.create(data);
        toast.success("סוג התחזוקה נוצר");
      }
      setShowForm(false);
      loadData();
    } catch {
      toast.error("שגיאה בשמירה");
    }
  };

  const handleDelete = async () => {
    if (!typeToDelete) return;
    try {
      await base44.entities.MaintenanceType.delete(typeToDelete.id);
      toast.success("נמחק");
      setTypeToDelete(null);
      loadData();
    } catch {
      toast.error("שגיאה במחיקה");
    }
  };

  const openEdit = (type) => {
    setEditingType(type);
    setFormData({ name: type.name || "", brand_id: type.brand_id || "", description: type.description || "", steps: type.steps || [], estimated_duration_hours: type.estimated_duration_hours || 1, color: type.color || "#10b981" });
    setShowForm(true);
  };

  const openNew = () => {
    setEditingType(null);
    setFormData(DEFAULT_FORM);
    setShowForm(true);
  };

  const getBrandName = (brandId) => unitBrands.find(b => b.id === brandId)?.name || null;

  const filteredTypes = filterBrand === "all"
    ? types
    : filterBrand === "none"
    ? types.filter(t => !t.brand_id)
    : types.filter(t => t.brand_id === filterBrand);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div></div>;
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">סוגי תחזוקה</h1>
          <p className="text-sm text-slate-500 mt-1">הגדר סוגי תחזוקה עם שלבים, פעולות וחלקים נדרשים</p>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 ml-2" />
          סוג תחזוקה חדש
        </Button>
      </div>

      {/* Filter by brand */}
      <div className="flex items-center gap-3">
        <Filter className="h-4 w-4 text-slate-400 shrink-0" />
        <Select value={filterBrand} onValueChange={setFilterBrand}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="סנן לפי מותג" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל המותגים</SelectItem>
            <SelectItem value="none">ללא מותג (כללי)</SelectItem>
            {unitBrands.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-sm text-slate-400">{filteredTypes.length} סוגים</span>
      </div>

      {/* Types grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredTypes.length === 0 ? (
          <div className="col-span-full text-center py-16 text-slate-400">
            <Wrench className="h-12 w-12 mx-auto mb-3 text-slate-200" />
            אין סוגי תחזוקה להצגה
          </div>
        ) : (
          filteredTypes.map(type => (
            <Card key={type.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-4 h-4 rounded-full shrink-0 mt-0.5" style={{ backgroundColor: type.color || "#10b981" }} />
                    <div className="min-w-0">
                      <h3 className="font-semibold text-slate-800 truncate">{type.name}</h3>
                      {type.description && <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{type.description}</p>}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(type)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => setTypeToDelete(type)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mt-3">
                  <Badge variant="outline" className="text-xs gap-1">
                    <Clock className="h-3 w-3" />
                    {type.estimated_duration_hours || 1} שעות
                  </Badge>
                  <Badge variant="secondary" className="text-xs">{type.steps?.length || 0} פעולות</Badge>
                  {getBrandName(type.brand_id) ? (
                    <Badge className="text-xs bg-blue-100 text-blue-700">{getBrandName(type.brand_id)}</Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs text-slate-400">כללי</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={open => { if (!open) setShowForm(false); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editingType ? "עריכת סוג תחזוקה" : "סוג תחזוקה חדש"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>שם *</Label>
                <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
              </div>

              <div className="space-y-2">
                <Label>שיוך למותג</Label>
                <Select value={formData.brand_id || "none"} onValueChange={v => setFormData({ ...formData, brand_id: v === "none" ? "" : v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="ללא מותג (כללי)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">ללא מותג (כללי לכולם)</SelectItem>
                    {unitBrands.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>משך זמן משוער (שעות)</Label>
                <Input type="number" min="0.5" step="0.5" value={formData.estimated_duration_hours}
                  onChange={e => setFormData({ ...formData, estimated_duration_hours: parseFloat(e.target.value) || 1 })} />
              </div>

              <div className="space-y-2">
                <Label>צבע</Label>
                <div className="flex items-center gap-2">
                  <Input type="color" value={formData.color} onChange={e => setFormData({ ...formData, color: e.target.value })} className="w-12 h-9 p-1 cursor-pointer" />
                  <span className="text-sm text-slate-500">{formData.color}</span>
                </div>
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label>תיאור</Label>
                <Textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} rows={2} />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-base font-semibold">פעולות התחזוקה</Label>
              <p className="text-xs text-slate-500">הגדר את שלבי הביצוע, הסברים וחלקים נדרשים לכל פעולה</p>
              <MaintenanceTypeStepsEditor
                steps={formData.steps}
                onChange={steps => setFormData({ ...formData, steps })}
                parts={parts}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>ביטול</Button>
              <Button type="submit">{editingType ? "עדכן" : "צור"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!typeToDelete} onOpenChange={() => setTypeToDelete(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>מחיקת סוג תחזוקה</AlertDialogTitle>
            <AlertDialogDescription>האם למחוק את "{typeToDelete?.name}"?</AlertDialogDescription>
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