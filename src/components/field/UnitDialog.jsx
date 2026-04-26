import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, PlayCircle, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import UnitSequenceEditor from "./UnitSequenceEditor";

// פונקציה סטטית לשימוש בתוך useEffect
function getBrandDefaultSequenceStatic(brand, unitType) {
  if (!brand) return [];
  const byType = brand.default_sequences_by_unit_type || [];
  const match = byType.find(s => s.unit_type === unitType);
  if (match?.sequence?.length) return match.sequence;
  return brand.default_visit_sequence || [];
}

export default function UnitDialog({ unit, customerId, customers = [], unitBrands, maintenanceTypes, onSave, onClose }) {
  // בנה רצף ברירת מחדל מיד בפתיחה אם הרצף ריק ויש תבנית
  const buildInitialSequence = () => {
    const existing = unit?.visit_sequence || [];
    if (existing.length > 0) return existing;
    if (!unit?.brand_id || !unit?.type) return [];
    const brand = unitBrands.find(b => b.id === unit.brand_id);
    const rawSeq = getBrandDefaultSequenceStatic(brand, unit.type);
    if (!rawSeq.length) return [];
    return rawSeq.map(step => ({
      ...step,
      maintenance_type_name: maintenanceTypes.find(t => t.id === step.maintenance_type_id)?.name || "",
      step_configs: step.step_configs || [],
    }));
  };

  const [formData, setFormData] = useState({
    customer_id: customerId || unit?.customer_id || "",
    active: unit?.active !== false,
    name: unit?.name || "",
    brand_id: unit?.brand_id || "",
    type: unit?.type || "",
    model: unit?.model || "",
    serial_number: unit?.serial_number || "",
    installation_date: unit?.installation_date || "",
    visit_interval_months: unit?.visit_interval_months || 3,
    current_visit_step: unit?.current_visit_step || 1,
    visit_sequence: buildInitialSequence(),
    notes: unit?.notes || "",
  });

  const [maintenanceSteps, setMaintenanceSteps] = useState([]);
  const [showOverrideConfirm, setShowOverrideConfirm] = useState(false);
  const [calcLoading, setCalcLoading] = useState(false);
  const [calcDone, setCalcDone] = useState(false);

  // טעינת maintenanceSteps לפי brand
  useEffect(() => {
    if (!formData.brand_id) { setMaintenanceSteps([]); return; }
    base44.entities.MaintenanceStep.filter({ brand_id: formData.brand_id })
      .then(steps => setMaintenanceSteps(steps || []))
      .catch(() => setMaintenanceSteps([]));
  }, [formData.brand_id]); // eslint-disable-line react-hooks/exhaustive-deps

  // אם הרצף עדיין ריק אחרי mount (maintenanceTypes לא היה זמין בהתחלה), נסה שוב
  useEffect(() => {
    if (!maintenanceTypes.length) return;
    setFormData(prev => {
      if (prev.visit_sequence.length > 0) return prev;
      if (!prev.brand_id || !prev.type) return prev;
      const brand = unitBrands.find(b => b.id === prev.brand_id);
      const rawSeq = getBrandDefaultSequenceStatic(brand, prev.type);
      if (!rawSeq.length) return prev;
      const seq = rawSeq.map(step => ({
        ...step,
        maintenance_type_name: maintenanceTypes.find(t => t.id === step.maintenance_type_id)?.name || "",
        step_configs: step.step_configs || [],
      }));
      return { ...prev, visit_sequence: seq };
    });
  }, [maintenanceTypes.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedBrand = unitBrands.find(b => b.id === formData.brand_id);
  const availableTypes = selectedBrand?.unit_types || [];
  const relevantMaintenanceTypes = maintenanceTypes.filter(t => !t.brand_id || t.brand_id === formData.brand_id);
  const hasManualOverrides = formData.visit_sequence.some(step => step.step_configs?.some(c => c.manual_override));

  // wrapper סביב הפונקציה הסטטית לשימוש ב-render
  const getBrandDefaultSequence = getBrandDefaultSequenceStatic;

  const handleBrandChange = (brandId) => {
    const brand = unitBrands.find(b => b.id === brandId);
    setFormData({ ...formData, brand_id: brandId, type: "", visit_interval_months: brand?.default_visit_interval_months || 3 });
  };

  const doLoadBrandDefaults = () => {
    const rawSeq = getBrandDefaultSequence(selectedBrand, formData.type);
    if (!rawSeq.length) return;
    const seq = rawSeq.map(step => ({
      ...step,
      maintenance_type_name: maintenanceTypes.find(t => t.id === step.maintenance_type_id)?.name || "",
      step_configs: [],
    }));
    setFormData({ ...formData, visit_sequence: seq, visit_interval_months: selectedBrand?.default_visit_interval_months || 3 });
  };

  const handleLoadBrandDefaults = () => {
    if (hasManualOverrides) setShowOverrideConfirm(true);
    else doLoadBrandDefaults();
  };

  const handleRunCalculation = async () => {
    if (!unit?.id) return;
    setCalcLoading(true);
    setCalcDone(false);
    try {
      await base44.functions.invoke("calculateFutureSchedule", { service_unit_id: unit.id });
      setCalcDone(true);
      toast.success("חישוב לו״ז תחזוקה הושלם");
      setTimeout(() => setCalcDone(false), 4000);
    } catch {
      toast.error("שגיאה בחישוב לו״ז תחזוקה");
    } finally {
      setCalcLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <>
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>{unit ? "עריכת יחידת שירות" : "יחידת שירות חדשה"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="w-full mb-4">
                <TabsTrigger value="basic" className="flex-1">פרטים בסיסיים</TabsTrigger>
                <TabsTrigger value="sequence" className="flex-1">
                  רצף תחזוקה
                  {formData.visit_sequence.length > 0 && (
                    <Badge variant="secondary" className="mr-1 text-xs">{formData.visit_sequence.length}</Badge>
                  )}
                  {hasManualOverrides && (
                    <Badge variant="outline" className="mr-1 text-xs border-amber-400 text-amber-600">ידני</Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4">
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                  <Switch checked={formData.active} onCheckedChange={v => setFormData({ ...formData, active: v })} />
                  <Label className="cursor-pointer">יחידה פעילה</Label>
                </div>

                {!customerId && (
                  <div className="space-y-2">
                    <Label>לקוח *</Label>
                    <Select value={formData.customer_id} onValueChange={v => setFormData({ ...formData, customer_id: v })}>
                      <SelectTrigger><SelectValue placeholder="בחר לקוח" /></SelectTrigger>
                      <SelectContent>
                        {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>שם יחידה *</Label>
                    <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required placeholder='לדוגמה: "אסטרונאוט חלב A3"' />
                  </div>
                  <div className="space-y-2">
                    <Label>מותג</Label>
                    <Select value={formData.brand_id || "none"} onValueChange={v => handleBrandChange(v === "none" ? "" : v)}>
                      <SelectTrigger><SelectValue placeholder="בחר מותג" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">ללא מותג</SelectItem>
                        {unitBrands.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>סוג</Label>
                    {availableTypes.length > 0 ? (
                      <Select value={formData.type || "none"} onValueChange={v => setFormData({ ...formData, type: v === "none" ? "" : v })}>
                        <SelectTrigger><SelectValue placeholder="בחר סוג" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">לא מוגדר</SelectItem>
                          {availableTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })} placeholder="הזן סוג" />
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>דגם</Label>
                    <Input value={formData.model} onChange={e => setFormData({ ...formData, model: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>מספר סידורי</Label>
                    <Input value={formData.serial_number} onChange={e => setFormData({ ...formData, serial_number: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>תאריך התקנה</Label>
                    <Input type="date" value={formData.installation_date} onChange={e => setFormData({ ...formData, installation_date: e.target.value })} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>הערות</Label>
                  <Textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} rows={2} />
                </div>
              </TabsContent>

              <TabsContent value="sequence" className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <Label className="text-base font-semibold">רצף ביקורי תחזוקה</Label>
                    <p className="text-xs text-slate-500 mt-0.5">הגדר סדר סוגי התחזוקה עם אינטרוול בין כל ביקור</p>
                  </div>
                  <div className="flex gap-2">
                    {getBrandDefaultSequence(selectedBrand, formData.type).length > 0 && (
                      <Button type="button" variant="outline" size="sm" onClick={handleLoadBrandDefaults}>
                        <RefreshCw className="h-4 w-4 ml-2" />טען ברירת מחדל ({selectedBrand.name})
                      </Button>
                    )}
                    {unit?.id && (
                      <Button type="button" variant="outline" size="sm" onClick={handleRunCalculation} disabled={calcLoading}>
                        {calcLoading ? <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                          : calcDone ? <CheckCircle2 className="h-4 w-4 ml-2 text-emerald-600" />
                          : <PlayCircle className="h-4 w-4 ml-2" />}
                        חשב לו״ז עתידי
                      </Button>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                  <Label className="text-sm text-blue-700 shrink-0">אינטרוול ברירת מחדל:</Label>
                  <Input type="number" min="1"
                    value={formData.visit_interval_months}
                    onChange={e => setFormData({ ...formData, visit_interval_months: parseInt(e.target.value) || 1 })}
                    className="w-20 h-8 text-sm" />
                  <span className="text-sm text-blue-600">חודשים</span>
                </div>

                <UnitSequenceEditor
                  sequence={formData.visit_sequence}
                  onChange={seq => setFormData({ ...formData, visit_sequence: seq })}
                  maintenanceTypes={relevantMaintenanceTypes.length > 0 ? relevantMaintenanceTypes : maintenanceTypes}
                  maintenanceSteps={maintenanceSteps}
                  defaultInterval={formData.visit_interval_months}
                />
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
              <Button type="button" variant="outline" onClick={onClose}>ביטול</Button>
              <Button type="submit">{unit ? "עדכן יחידה" : "צור יחידה"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showOverrideConfirm} onOpenChange={setShowOverrideConfirm}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>קיימות הגדרות ידניות</AlertDialogTitle>
            <AlertDialogDescription>
              ברצף הנוכחי קיימות הגדרות שנוספו ידנית. טעינת ברירת המחדל תמחק אותן ותאפס את הרצף. האם להמשיך?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול — שמור הגדרות ידניות</AlertDialogCancel>
            <AlertDialogAction onClick={() => { doLoadBrandDefaults(); setShowOverrideConfirm(false); }}
              className="bg-amber-600 hover:bg-amber-700">
              כן, טען ברירת מחדל ואפס
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}