import React, { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import BrandUnitFilter from "@/components/maintenance/BrandUnitFilter";
import { Plus, Pencil, Trash2, Search, X, ChevronDown, ChevronUp, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

const DEFAULT_STEP = { name: "", description: "", explanation: "", brand_id: "", unit_type: "", parts_required: [] };

function PartSearchInput({ parts, onAdd }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = query.length >= 4
    ? parts.filter(p => p.name?.toLowerCase().includes(query.toLowerCase()) || p.sku?.toLowerCase().includes(query.toLowerCase())).slice(0, 10)
    : [];

  return (
    <div className="relative" ref={ref}>
      <div className="relative">
        <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
        <Input
          placeholder="חפש חלק להוספה (מינ' 4 תווים)..."
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(e.target.value.length >= 4); }}
          onFocus={() => { if (query.length >= 4) setOpen(true); }}
          className="pr-9"
        />
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-50 w-full bg-white border rounded-lg shadow-lg mt-1 max-h-60 overflow-y-auto">
          {filtered.map(part => (
            <div key={part.id} className="p-2 hover:bg-slate-100 cursor-pointer border-b last:border-b-0"
              onMouseDown={() => { onAdd(part); setQuery(""); setOpen(false); }}>
              <p className="font-medium text-sm">{part.sku}</p>
              <p className="text-xs text-slate-500">{part.name}</p>
            </div>
          ))}
        </div>
      )}
      {open && query.length >= 4 && filtered.length === 0 && (
        <div className="absolute z-50 w-full bg-white border rounded-lg shadow-lg mt-1 p-3 text-center text-sm text-slate-500">לא נמצאו חלקים</div>
      )}
    </div>
  );
}

export default function StepLibraryManager({ parts, unitBrands = [], onStepsChanged }) {
  const [steps, setSteps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingStep, setEditingStep] = useState(null);
  const [stepToDelete, setStepToDelete] = useState(null);
  const [formData, setFormData] = useState(DEFAULT_STEP);
  const [expandedId, setExpandedId] = useState(null);
  const [filterBrandId, setFilterBrandId] = useState("");
  const [filterUnitType, setFilterUnitType] = useState("");
  const [orderedSteps, setOrderedSteps] = useState([]);

  useEffect(() => { loadSteps(); }, []);

  const loadSteps = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.MaintenanceStep.list();
      setSteps(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openNew = () => { setEditingStep(null); setFormData(DEFAULT_STEP); setShowForm(true); };
  const openEdit = (step) => { setEditingStep(step); setFormData({ name: step.name || "", description: step.description || "", explanation: step.explanation || "", brand_id: step.brand_id || "", unit_type: step.unit_type || "", parts_required: step.parts_required || [] }); setShowForm(true); };

  const selectedBrand = unitBrands.find(b => b.id === formData.brand_id);
  const unitTypes = selectedBrand?.unit_types || [];

  const filteredSteps = steps.filter(step => {
    if (!filterBrandId) return false;
    if (filterBrandId && step.brand_id !== filterBrandId) return false;
    if (filterUnitType && step.unit_type !== filterUnitType) return false;
    return true;
  });

  // Keep ordered list in sync with filteredSteps (preserve drag order)
  useEffect(() => {
    setOrderedSteps(prev => {
      const prevIds = prev.map(s => s.id);
      const filteredIds = filteredSteps.map(s => s.id);
      // If same set, keep order; otherwise reset
      if (prevIds.length === filteredIds.length && prevIds.every(id => filteredIds.includes(id))) return prev;
      return filteredSteps;
    });
  }, [filteredSteps.map(s => s.id).join(",")]);

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    const reordered = Array.from(orderedSteps);
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    setOrderedSteps(reordered);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingStep) {
        await base44.entities.MaintenanceStep.update(editingStep.id, formData);
        toast.success("הפעולה עודכנה");
      } else {
        await base44.entities.MaintenanceStep.create(formData);
        toast.success("הפעולה נוצרה");
      }
      setShowForm(false);
      loadSteps();
      if (onStepsChanged) onStepsChanged();
    } catch {
      toast.error("שגיאה בשמירה");
    }
  };

  const handleDelete = async () => {
    if (!stepToDelete) return;
    try {
      await base44.entities.MaintenanceStep.delete(stepToDelete.id);
      toast.success("נמחק");
      setStepToDelete(null);
      loadSteps();
      if (onStepsChanged) onStepsChanged();
    } catch {
      toast.error("שגיאה במחיקה");
    }
  };

  const addPart = (part) => {
    const exists = formData.parts_required.find(p => p.part_sku === part.sku);
    if (exists) { toast.info("החלק כבר קיים"); return; }
    setFormData(prev => ({ ...prev, parts_required: [...prev.parts_required, { part_sku: part.sku, part_name: part.name, quantity: 1 }] }));
  };

  const removePart = (sku) => setFormData(prev => ({ ...prev, parts_required: prev.parts_required.filter(p => p.part_sku !== sku) }));
  const updatePartQty = (sku, qty) => setFormData(prev => ({ ...prev, parts_required: prev.parts_required.map(p => p.part_sku === sku ? { ...p, quantity: qty } : p) }));

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-3 flex-wrap">
        <div className="flex-1">
          <BrandUnitFilter
            unitBrands={unitBrands}
            filterBrandId={filterBrandId}
            filterUnitType={filterUnitType}
            onBrandChange={v => { setFilterBrandId(v); setFilterUnitType(""); }}
            onUnitTypeChange={setFilterUnitType}
          />
        </div>
        <Button onClick={openNew} size="sm">
          <Plus className="h-4 w-4 ml-1" /> פעולה חדשה
        </Button>
      </div>

      {!filterBrandId ? (
        <div className="text-center py-16 text-slate-400 border-2 border-dashed rounded-lg">בחר מותג כדי להציג פעולות תחזוקה</div>
      ) : orderedSteps.length === 0 ? (
        <div className="text-center py-12 text-slate-400 border-2 border-dashed rounded-lg">לא נמצאו פעולות תחזוקה</div>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="steps-list">
            {(provided) => (
              <div className="space-y-2" ref={provided.innerRef} {...provided.droppableProps}>
                {orderedSteps.map((step, index) => (
                  <Draggable key={step.id} draggableId={step.id} index={index}>
                    {(drag, snapshot) => (
                      <Card ref={drag.innerRef} {...drag.draggableProps} className={`hover:shadow-sm transition-shadow ${snapshot.isDragging ? "shadow-lg ring-2 ring-emerald-300" : ""}`}>
                        <CardContent className="p-3">
                          <div className="flex items-center gap-2">
                            <div {...drag.dragHandleProps} className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500">
                              <GripVertical className="h-5 w-5" />
                            </div>
                            <button type="button" onClick={() => setExpandedId(expandedId === step.id ? null : step.id)} className="flex-1 flex items-center gap-2 text-right flex-wrap">
                              {expandedId === step.id ? <ChevronUp className="h-4 w-4 text-slate-400 shrink-0" /> : <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />}
                              <span className="font-medium text-slate-800">{step.name}</span>
                              {step.parts_required?.length > 0 && (
                                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{step.parts_required.length} חלקים</span>
                              )}
                              {step.brand_id && unitBrands.find(b => b.id === step.brand_id) && (
                                <Badge className="text-xs bg-blue-100 text-blue-700 font-normal">{unitBrands.find(b => b.id === step.brand_id).name}</Badge>
                              )}
                              {step.unit_type && (
                                <Badge variant="outline" className="text-xs font-normal">{step.unit_type}</Badge>
                              )}
                            </button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(step)}><Pencil className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => setStepToDelete(step)}><Trash2 className="h-3.5 w-3.5" /></Button>
                          </div>
                          {expandedId === step.id && (
                            <div className="mt-3 pt-3 border-t space-y-2">
                              {step.description && <p className="text-sm text-slate-600">{step.description}</p>}
                              {step.explanation && <p className="text-xs text-slate-500 bg-slate-50 p-2 rounded">{step.explanation}</p>}
                              {step.parts_required?.length > 0 && (
                                <div className="space-y-1">
                                  <p className="text-xs font-medium text-slate-500">חלקים:</p>
                                  {step.parts_required.map(p => (
                                    <div key={p.part_sku} className="flex justify-between text-xs bg-slate-50 px-2 py-1 rounded">
                                      <span>{p.part_name} ({p.part_sku})</span>
                                      <span className="font-medium">× {p.quantity}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}

      <Dialog open={showForm} onOpenChange={open => !open && setShowForm(false)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editingStep ? "עריכת פעולת תחזוקה" : "פעולת תחזוקה חדשה"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>שם הפעולה *</Label>
              <Input value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} required placeholder='לדוגמה: "החלפת חלקים מתכלים"' />
            </div>
            <div className="grid grid-cols-2 gap-4">
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
            </div>
            <div className="space-y-2">
              <Label>תיאור קצר</Label>
              <Textarea value={formData.description} onChange={e => setFormData(p => ({ ...p, description: e.target.value }))} rows={2} placeholder="תיאור קצר של הפעולה" />
            </div>
            <div className="space-y-2">
              <Label>הסבר מפורט לביצוע</Label>
              <Textarea value={formData.explanation} onChange={e => setFormData(p => ({ ...p, explanation: e.target.value }))} rows={3} placeholder="שלבי ביצוע מפורטים, הוראות בטיחות וכד'" />
            </div>
            <div className="space-y-2">
              <Label>חלקים נדרשים</Label>
              <PartSearchInput parts={parts} onAdd={addPart} />
              {formData.parts_required.length > 0 && (
                <div className="space-y-2 mt-2">
                  {formData.parts_required.map(part => (
                    <div key={part.part_sku} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{part.part_sku}</p>
                        <p className="text-xs text-slate-500">{part.part_name}</p>
                      </div>
                      <Label className="text-xs">כמות:</Label>
                      <Input type="number" min="1" value={part.quantity}
                        onChange={e => updatePartQty(part.part_sku, parseInt(e.target.value) || 1)}
                        className="w-20" />
                      <Button type="button" variant="ghost" size="icon" onClick={() => removePart(part.part_sku)}>
                        <X className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>ביטול</Button>
              <Button type="submit">{editingStep ? "עדכן" : "צור"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!stepToDelete} onOpenChange={() => setStepToDelete(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>מחיקת פעולה</AlertDialogTitle>
            <AlertDialogDescription>האם למחוק את "{stepToDelete?.name}"?</AlertDialogDescription>
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