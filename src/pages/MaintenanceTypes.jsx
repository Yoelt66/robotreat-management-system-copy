import React, { useState, useEffect } from "react";
import { MaintenanceType } from "@/entities/MaintenanceType";
import { getParts } from "@/functions/getParts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Plus, Pencil, Trash2, Wrench, Clock } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import MaintenanceTypeStepsEditor from "@/components/schedule/MaintenanceTypeStepsEditor";

export default function MaintenanceTypesPage() {
  const [types, setTypes] = useState([]);
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingType, setEditingType] = useState(null);
  const [typeToDelete, setTypeToDelete] = useState(null);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    steps: [],
    default_parts: [],
    estimated_duration_hours: 1,
    color: "#10b981",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [typesData, partsResponse] = await Promise.all([
        MaintenanceType.list(),
        getParts(),
      ]);
      setTypes(typesData);
      setParts(partsResponse?.data?.data || []);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingType) {
        await MaintenanceType.update(editingType.id, formData);
        toast({ title: "סוג התחזוקה עודכן בהצלחה" });
      } else {
        await MaintenanceType.create(formData);
        toast({ title: "סוג התחזוקה נוצר בהצלחה" });
      }
      setShowForm(false);
      setEditingType(null);
      resetForm();
      await loadData();
    } catch (error) {
      console.error("Error saving type:", error);
      toast({ variant: "destructive", title: "שגיאה בשמירה" });
    }
  };

  const handleDelete = async () => {
    if (!typeToDelete) return;
    try {
      await MaintenanceType.delete(typeToDelete.id);
      toast({ title: "סוג התחזוקה נמחק בהצלחה" });
      setTypeToDelete(null);
      await loadData();
    } catch (error) {
      console.error("Error deleting type:", error);
      toast({ variant: "destructive", title: "שגיאה במחיקה" });
    }
  };

  const openEditForm = (type) => {
    setEditingType(type);
    setFormData({
      name: type.name || "",
      description: type.description || "",
      steps: type.steps || [],
      default_parts: type.default_parts || [],
      estimated_duration_hours: type.estimated_duration_hours || 1,
      color: type.color || "#10b981",
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      steps: [],
      default_parts: [],
      estimated_duration_hours: 1,
      color: "#10b981",
    });
  };

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
        <h1 className="text-2xl font-bold text-slate-800">סוגי תחזוקה</h1>
        <Button onClick={() => { resetForm(); setEditingType(null); setShowForm(true); }}>
          <Plus className="h-4 w-4 ml-2" />
          סוג חדש
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>שם</TableHead>
                <TableHead>תיאור</TableHead>
                <TableHead className="text-center">שלבים</TableHead>
                <TableHead className="text-center">משך משוער</TableHead>
                <TableHead className="text-center">צבע</TableHead>
                <TableHead className="text-center">פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {types.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-slate-500 py-8">
                    <Wrench className="h-12 w-12 mx-auto mb-2 text-slate-300" />
                    אין סוגי תחזוקה להצגה
                  </TableCell>
                </TableRow>
              ) : (
                types.map((type) => (
                  <TableRow key={type.id}>
                    <TableCell className="font-medium">{type.name}</TableCell>
                    <TableCell>{type.description || "-"}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">{type.steps?.length || 0} שלבים</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Clock className="h-4 w-4 text-slate-400" />
                        {type.estimated_duration_hours || 1} שעות
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div
                        className="w-6 h-6 rounded-full mx-auto border"
                        style={{ backgroundColor: type.color || "#10b981" }}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openEditForm(type)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-500 hover:text-red-600"
                          onClick={() => setTypeToDelete(type)}
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

      {/* Type Form Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) { setShowForm(false); setEditingType(null); } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editingType ? "עריכת סוג תחזוקה" : "סוג תחזוקה חדש"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>שם *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>משך זמן משוער (שעות)</Label>
                <Input
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={formData.estimated_duration_hours}
                  onChange={(e) => setFormData({ ...formData, estimated_duration_hours: parseFloat(e.target.value) || 1 })}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>תיאור</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label>צבע</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="w-12 h-10 p-1"
                  />
                  <Input
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="flex-1"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>שלבי התחזוקה</Label>
              <MaintenanceTypeStepsEditor
                steps={formData.steps}
                onChange={(steps) => setFormData({ ...formData, steps })}
                parts={parts}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditingType(null); }}>
                ביטול
              </Button>
              <Button type="submit">{editingType ? "עדכן" : "צור"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!typeToDelete} onOpenChange={() => setTypeToDelete(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>אישור מחיקה</AlertDialogTitle>
            <AlertDialogDescription>
              האם אתה בטוח שברצונך למחוק את סוג התחזוקה "{typeToDelete?.name}"?
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