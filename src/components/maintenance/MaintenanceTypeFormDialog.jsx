import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";

const DEFAULT_FORM = { name: "", brand_id: "", unit_type: "", description: "", step_configs: [], estimated_duration_hours: 1, color: "#10b981" };

export default function MaintenanceTypeFormDialog({ open, onClose, onSubmit, editingType, unitBrands, maintenanceSteps }) {
  const [formData, setFormData] = useState(() => {
    if (editingType) {
      return {
        name: editingType.name || "",
        brand_id: editingType.brand_id || "",
        unit_type: editingType.unit_type || "",
        description: editingType.description || "",
        step_configs: editingType.step_configs || [],
        estimated_duration_hours: editingType.estimated_duration_hours || 1,
        color: editingType.color || "#10b981"
      };
    }
    return DEFAULT_FORM;
  });

  useEffect(() => {
    if (open) {
      if (editingType) {
        setFormData({
          name: editingType.name || "",
          brand_id: editingType.brand_id || "",
          unit_type: editingType.unit_type || "",
          description: editingType.description || "",
          step_configs: editingType.step_configs || [],
          estimated_duration_hours: editingType.estimated_duration_hours || 1,
          color: editingType.color || "#10b981"
        });
      } else {
        setFormData(DEFAULT_FORM);
      }
    }
  }, [open, editingType?.id]);

  const selectedBrand = unitBrands.find(b => b.id === formData.brand_id);
  const unitTypes = selectedBrand?.unit_types || [];

  const getStepConfig = (stepId) => formData.step_configs.find(sc => sc.step_id === stepId);

  const toggleStep = (step) => {
    const existing = getStepConfig(step.id);
    if (existing) {
      setFormData(prev => ({ ...prev, step_configs: prev.step_configs.filter(sc => sc.step_id !== step.id) }));
    } else {
      const defaultParts = (step.parts_required || []).map(p => ({ ...p }));
      setFormData(prev => ({
        ...prev,
        step_configs: [...prev.step_configs, { step_id: step.id, step_name: step.name, enabled: true, custom_parts: defaultParts }]
      }));
    }
  };

  const updateCustomPartQty = (stepId, partSku, qty) => {
    setFormData(prev => ({
      ...prev,
      step_configs: prev.step_configs.map(sc =>
        sc.step_id === stepId
          ? { ...sc, custom_parts: sc.custom_parts.map(p => p.part_sku === partSku ? { ...p, quantity: qty } : p) }
          : sc
      )
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ ...formData, brand_id: formData.brand_id || null });
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>{editingType ? "עריכת סוג תחזוקה" : "סוג תחזוקה חדש"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>שם *</Label>
              <Input value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label>שיוך למותג</Label>
              <Select value={formData.brand_id || "none"} onValueChange={v => setFormData(p => ({ ...p, brand_id: v === "none" ? "" : v, unit_type: "" }))}>
                <SelectTrigger><SelectValue placeholder="ללא מותג (כללי)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">ללא מותג (כללי)</SelectItem>
                  {unitBrands.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {formData.brand_id && unitTypes.length > 0 && (
              <div className="space-y-2">
                <Label>סוג יחידה</Label>
                <Select value={formData.unit_type || "all"} onValueChange={v => setFormData(p => ({ ...p, unit_type: v === "all" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="כל סוגי היחידה" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">כל סוגי היחידה</SelectItem>
                    {unitTypes.map(ut => <SelectItem key={ut} value={ut}>{ut}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>משך זמן משוער (שעות)</Label>
              <Input type="number" min="0.5" step="0.5" value={formData.estimated_duration_hours}
                onChange={e => setFormData(p => ({ ...p, estimated_duration_hours: parseFloat(e.target.value) || 1 }))} />
            </div>
            <div className="space-y-2">
              <Label>צבע</Label>
              <div className="flex items-center gap-2">
                <Input type="color" value={formData.color} onChange={e => setFormData(p => ({ ...p, color: e.target.value }))} className="w-12 h-9 p-1 cursor-pointer" />
                <span className="text-sm text-slate-500">{formData.color}</span>
              </div>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>תיאור</Label>
              <Textarea value={formData.description} onChange={e => setFormData(p => ({ ...p, description: e.target.value }))} rows={2} />
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <Label className="text-base font-semibold">פעולות תחזוקה</Label>
              <p className="text-xs text-slate-500 mt-0.5">סמן את הפעולות הכלולות בסוג תחזוקה זה ושנה כמויות לפי הצורך</p>
            </div>

            {maintenanceSteps.length === 0 ? (
              <div className="text-center py-6 text-slate-400 border-2 border-dashed rounded-lg text-sm">
                אין פעולות תחזוקה מוגדרות. יש להוסיף פעולות בלשונית "פעולות תחזוקה".
              </div>
            ) : (
              <div className="space-y-2">
                {maintenanceSteps.map(step => {
                  const config = getStepConfig(step.id);
                  const isEnabled = !!config;
                  return (
                    <div key={step.id} className={`border rounded-lg transition-colors ${isEnabled ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white"}`}>
                      <div className="flex items-center gap-3 p-3 cursor-pointer" onClick={() => toggleStep(step)}>
                        <Checkbox checked={isEnabled} onCheckedChange={() => {}} />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-slate-800">{step.name}</p>
                          {step.description && <p className="text-xs text-slate-500 truncate">{step.description}</p>}
                        </div>
                        {step.parts_required?.length > 0 && (
                          <Badge variant="outline" className="text-xs shrink-0">{step.parts_required.length} חלקים</Badge>
                        )}
                      </div>

                      {isEnabled && config.custom_parts?.length > 0 && (
                        <div className="px-3 pb-3 border-t border-emerald-100 pt-2 space-y-1">
                          <p className="text-xs font-medium text-slate-600 mb-2">כמויות חלקים:</p>
                          {config.custom_parts.map(part => (
                            <div key={part.part_sku} className="flex items-center gap-2 bg-white rounded p-1.5">
                              <div className="flex-1 text-xs">
                                <span className="font-mono text-slate-500">{part.part_sku}</span>
                                <span className="mx-1 text-slate-400">—</span>
                                <span>{part.part_name}</span>
                              </div>
                              <Label className="text-xs text-slate-500 shrink-0">כמות:</Label>
                              <Input
                                type="number" min="1"
                                value={part.quantity}
                                onChange={e => updateCustomPartQty(step.id, part.part_sku, parseInt(e.target.value) || 1)}
                                className="w-20 h-7 text-sm"
                                onClick={e => e.stopPropagation()}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={onClose}>ביטול</Button>
            <Button type="submit">{editingType ? "עדכן" : "צור"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}