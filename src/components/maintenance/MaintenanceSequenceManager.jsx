import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, GripVertical, Save, Info, Copy } from "lucide-react";
import { toast } from "sonner";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import BrandUnitFilter from "@/components/maintenance/BrandUnitFilter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

function SequenceEditor({ sequence, maintenanceTypes, onChange, selectedBrandName }) {
  const addStep = () => {
    const nextNum = sequence.length + 1;
    const isDelaval = selectedBrandName?.toLowerCase().includes("delaval");
    onChange([...sequence, { step_number: nextNum, maintenance_type_id: "", interval_months: isDelaval ? 4 : 3 }]);
  };

  const removeStep = (idx) => {
    const updated = sequence.filter((_, i) => i !== idx).map((s, i) => ({ ...s, step_number: i + 1 }));
    onChange(updated);
  };

  const updateStep = (idx, field, value) => {
    const updated = sequence.map((s, i) => i === idx ? { ...s, [field]: value } : s);
    onChange(updated);
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    const reordered = Array.from(sequence);
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    onChange(reordered.map((s, i) => ({ ...s, step_number: i + 1 })));
  };

  return (
    <div className="space-y-2">
      {sequence.length === 0 && (
        <div className="text-center py-8 text-slate-400 border-2 border-dashed rounded-lg text-sm">
          אין שלבים ברצף. לחץ "הוסף שלב" להתחלה.
        </div>
      )}
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="sequence-list">
          {(provided) => (
            <div className="space-y-2" ref={provided.innerRef} {...provided.droppableProps}>
              {sequence.map((step, idx) => (
                <Draggable key={idx} draggableId={`seq-step-${idx}`} index={idx}>
                  {(drag, snapshot) => (
                    <div
                      ref={drag.innerRef}
                      {...drag.draggableProps}
                      className={`flex items-center gap-2 bg-white border rounded-lg p-3 ${snapshot.isDragging ? "shadow-lg ring-2 ring-emerald-300" : ""}`}
                    >
                      <div {...drag.dragHandleProps} className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 shrink-0">
                        <GripVertical className="h-5 w-5" />
                      </div>
                      <div className="flex items-center justify-center w-7 h-7 bg-emerald-100 text-emerald-700 rounded-full text-sm font-bold shrink-0">
                        {step.step_number}
                      </div>
                      <Select
                        value={step.maintenance_type_id || "none"}
                        onValueChange={v => updateStep(idx, "maintenance_type_id", v === "none" ? "" : v)}
                      >
                        <SelectTrigger className="flex-1 h-9 text-sm">
                          <SelectValue placeholder="בחר סוג תחזוקה..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— בחר —</SelectItem>
                          {maintenanceTypes.map(t => (
                            <SelectItem key={t.id} value={t.id}>
                              <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.color || "#10b981" }} />
                                {t.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-xs text-slate-500 whitespace-nowrap">מרווח:</span>
                        <Input
                          type="number"
                          min="1"
                          max="120"
                          value={step.interval_months}
                          onChange={e => updateStep(idx, "interval_months", parseInt(e.target.value) || 1)}
                          className="w-16 h-9 text-sm"
                        />
                        <span className="text-xs text-slate-500">חודשים</span>
                      </div>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-600 shrink-0" onClick={() => removeStep(idx)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
      <Button type="button" variant="outline" size="sm" onClick={addStep} className="w-full gap-2 border-dashed">
        <Plus className="h-4 w-4" />
        הוסף שלב
      </Button>
    </div>
  );
}

export default function MaintenanceSequenceManager({ maintenanceTypes, unitBrands }) {
  const [selectedBrandId, setSelectedBrandId] = useState("");
  const [selectedUnitType, setSelectedUnitType] = useState("");
  const [sequence, setSequence] = useState([]);
  const [saving, setSaving] = useState(false);
  const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
  const [cloneSourceBrandId, setCloneSourceBrandId] = useState("");
  const [cloneSourceUnitType, setCloneSourceUnitType] = useState("");

  const selectedBrand = unitBrands.find(b => b.id === selectedBrandId);

  const loadSequence = async (brandId, unitType) => {
    if (!brandId || !unitType) { setSequence([]); return; }
    const freshBrand = await base44.entities.UnitBrand.get(brandId);
    const seqs = freshBrand?.default_sequences_by_unit_type || [];
    const found = seqs.find(s => s.unit_type === unitType);
    setSequence(found ? [...found.sequence] : []);
  };

  useEffect(() => {
    loadSequence(selectedBrandId, selectedUnitType);
  }, [selectedBrandId, selectedUnitType]);

  const handleBrandChange = (brandId) => {
    setSelectedBrandId(brandId);
    setSelectedUnitType("");
    setSequence([]);
  };

  const handleSave = async () => {
    if (!selectedBrandId || !selectedUnitType) return;
    const invalid = sequence.filter(s => !s.maintenance_type_id);
    if (invalid.length > 0) {
      toast.error("יש שלבים ללא סוג תחזוקה. אנא בחר סוג לכל שלב.");
      return;
    }

    setSaving(true);
    try {
      const freshBrand = await base44.entities.UnitBrand.get(selectedBrandId);
      const existing = freshBrand?.default_sequences_by_unit_type || [];
      const updated = existing.filter(s => s.unit_type !== selectedUnitType);
      updated.push({ unit_type: selectedUnitType, sequence });
      await base44.entities.UnitBrand.update(selectedBrandId, { default_sequences_by_unit_type: updated });
      await loadSequence(selectedBrandId, selectedUnitType);
      toast.success("הרצף נשמר בהצלחה");
    } catch (e) {
      toast.error("שגיאה בשמירה: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const [clonePreview, setClonePreview] = useState([]);

  const loadClonePreview = async (brandId, unitType) => {
    if (!brandId || !unitType) { setClonePreview([]); return; }
    const sourceBrand = await base44.entities.UnitBrand.get(brandId);
    const seqs = sourceBrand?.default_sequences_by_unit_type || [];
    const found = seqs.find(s => s.unit_type === unitType);
    setClonePreview(found?.sequence || []);
  };

  const handleClone = () => {
    if (clonePreview.length === 0) {
      toast.error("לא נמצא רצף במקור שנבחר");
      return;
    }
    setSequence(clonePreview.map((s, i) => ({ ...s, step_number: i + 1 })));
    setCloneDialogOpen(false);
    setCloneSourceBrandId("");
    setCloneSourceUnitType("");
    setClonePreview([]);
    toast.success("הרצף שוכפל — אל תשכח לשמור");
  };

  const cloneSourceBrand = unitBrands.find(b => b.id === cloneSourceBrandId);
  const cloneSourceUnitTypes = cloneSourceBrand?.unit_types || [];

  // Filter maintenance types for selected brand/unit_type
  const relevantTypes = maintenanceTypes.filter(t => {
    if (!t.brand_id && !t.unit_type) return true; // generic
    if (selectedBrandId && t.brand_id === selectedBrandId) {
      if (!selectedUnitType) return true;
      if (!t.unit_type || t.unit_type === selectedUnitType) return true;
    }
    return false;
  });

  return (
    <div className="space-y-5" dir="rtl">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <p className="text-sm text-slate-500">
          הגדר רצף ביקורים תקופתי לכל שילוב של מותג + סוג יחידה, כולל מרווחים בחודשים בין כל שלב.
        </p>
      </div>

      {/* Brand + Unit type selector */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <BrandUnitFilter
          unitBrands={unitBrands}
          filterBrandId={selectedBrandId}
          filterUnitType={selectedUnitType}
          onBrandChange={handleBrandChange}
          onUnitTypeChange={setSelectedUnitType}
        />
        {selectedBrandId && selectedUnitType && (
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">{sequence.length} שלבים</Badge>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setCloneDialogOpen(true)}>
              <Copy className="h-4 w-4" />
              שכפל רצף
            </Button>
            <Button onClick={handleSave} disabled={saving} size="sm" className="gap-2">
              <Save className="h-4 w-4" />
              {saving ? "שומר..." : "שמור רצף"}
            </Button>
          </div>
        )}
      </div>

      {/* Sequence editor */}
      {!selectedBrandId ? (
        <div className="text-center py-16 text-slate-400 border-2 border-dashed rounded-lg">
          <Info className="h-10 w-10 mx-auto mb-2 text-slate-300" />
          בחר מותג וסוג יחידה כדי לערוך את רצף הטיפולים
        </div>
      ) : !selectedUnitType ? (
        <div className="text-center py-12 text-slate-400 border-2 border-dashed rounded-lg">
          בחר סוג יחידה כדי להמשיך
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-slate-700">
              רצף טיפולים — {selectedBrand?.name} / {selectedUnitType}
            </h3>
            <div className="flex items-center gap-1 text-xs text-slate-500 bg-slate-50 px-2 py-1 rounded-full border">
              <Info className="h-3 w-3" />
              המרווח הוא הזמן לפני שלב זה
            </div>
          </div>
          <SequenceEditor
            sequence={sequence}
            maintenanceTypes={maintenanceTypes}
            onChange={setSequence}
            selectedBrandName={selectedBrand?.name}
          />
        </div>
      )}

      {/* Clone Dialog */}
      <Dialog open={cloneDialogOpen} onOpenChange={setCloneDialogOpen}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader>
            <DialogTitle>שכפל רצף ממקור אחר</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>מותג מקור</Label>
              <Select value={cloneSourceBrandId} onValueChange={v => { setCloneSourceBrandId(v); setCloneSourceUnitType(""); }}>
                <SelectTrigger>
                  <SelectValue placeholder="בחר מותג..." />
                </SelectTrigger>
                <SelectContent>
                  {unitBrands.map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>סוג יחידה מקור</Label>
              <Select value={cloneSourceUnitType} onValueChange={v => { setCloneSourceUnitType(v); loadClonePreview(cloneSourceBrandId, v); }} disabled={!cloneSourceBrandId}>
                <SelectTrigger>
                  <SelectValue placeholder="בחר סוג יחידה..." />
                </SelectTrigger>
                <SelectContent>
                  {cloneSourceUnitTypes.map(ut => (
                    <SelectItem key={ut} value={ut}>{ut}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {clonePreview.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-slate-500">תצוגה מקדימה ({clonePreview.length} שלבים)</Label>
                <div className="rounded-lg border bg-slate-50 divide-y max-h-52 overflow-y-auto">
                  {clonePreview.map((step, i) => {
                    const mt = maintenanceTypes.find(t => t.id === step.maintenance_type_id);
                    return (
                      <div key={i} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                        <span className="w-5 h-5 flex items-center justify-center bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold shrink-0">{i + 1}</span>
                        {mt?.color && <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: mt.color }} />}
                        <span className="flex-1 truncate">{mt?.name || <span className="text-slate-400 italic">לא ידוע</span>}</span>
                        <span className="text-xs text-slate-400 shrink-0">{step.interval_months} חודשים</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {cloneSourceUnitType && clonePreview.length === 0 && (
              <p className="text-sm text-amber-600 bg-amber-50 rounded-lg px-3 py-2">לא נמצא רצף לשילוב זה</p>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCloneDialogOpen(false)}>ביטול</Button>
            <Button onClick={handleClone} disabled={!cloneSourceBrandId || !cloneSourceUnitType} className="gap-2">
              <Copy className="h-4 w-4" />
              שכפל
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}