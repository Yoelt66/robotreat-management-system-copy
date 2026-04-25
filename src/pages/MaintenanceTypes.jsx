import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, Wrench, Clock, LayoutGrid, Upload, ListOrdered, GripVertical } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { toast } from "sonner";
import StepLibraryManager from "@/components/maintenance/StepLibraryManager";
import MaintenanceTypeFormDialog from "@/components/maintenance/MaintenanceTypeFormDialog";
import MaintenanceMatrixView from "@/components/maintenance/MaintenanceMatrixView";
import MaintenanceImportDialog from "@/components/maintenance/MaintenanceImportDialog";
import MaintenanceSequenceManager from "@/components/maintenance/MaintenanceSequenceManager";
import BrandUnitFilter from "@/components/maintenance/BrandUnitFilter";

export default function MaintenanceTypesPage() {
  const [types, setTypes] = useState([]);
  const [orderedTypes, setOrderedTypes] = useState([]);
  const [maintenanceSteps, setMaintenanceSteps] = useState([]);
  const [parts, setParts] = useState([]);
  const [unitBrands, setUnitBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingType, setEditingType] = useState(null);
  const [typeToDelete, setTypeToDelete] = useState(null);
  const [importDialogTab, setImportDialogTab] = useState(null); // "types" | "steps" | "matrix"
  const [filterBrandId, setFilterBrandId] = useState("");
  const [filterUnitType, setFilterUnitType] = useState("");

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [typesData, brandsData, stepsData, partsData] = await Promise.all([
        base44.entities.MaintenanceType.list(),
        base44.entities.UnitBrand.list(),
        base44.entities.MaintenanceStep.list(),
        base44.entities.PartCore.list(),
      ]);
      const sorted = (typesData || []).slice().sort((a, b) => a.name.localeCompare(b.name, "he", { numeric: true }));
      setTypes(sorted);
      setOrderedTypes(sorted);
      setUnitBrands(brandsData || []);
      setMaintenanceSteps(stepsData || []);
      setParts(partsData || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitType = async (data) => {
    try {
      if (editingType) {
        await base44.entities.MaintenanceType.update(editingType.id, data);
        toast.success("סוג התחזוקה עודכן");
      } else {
        await base44.entities.MaintenanceType.create(data);
        toast.success("סוג התחזוקה נוצר");
      }
      setShowForm(false);
      setEditingType(null);
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

  const handleUpdateTypeFromMatrix = async (typeId, data) => {
    try {
      await base44.entities.MaintenanceType.update(typeId, data);
      setTypes(prev => prev.map(t => t.id === typeId ? { ...t, ...data } : t));
    } catch {
      toast.error("שגיאה בשמירה");
    }
  };

  const openEdit = (type) => { setEditingType(type); setShowForm(true); };
  const openNew = () => { setEditingType(null); setShowForm(true); };
  const getBrandName = (brandId) => unitBrands.find(b => b.id === brandId)?.name || null;

  const filteredTypes = orderedTypes.filter(t => {
    if (!filterBrandId || !filterUnitType) return false;
    if ((t.brand_id || "") !== filterBrandId) return false;
    if ((t.unit_type || "") !== filterUnitType) return false;
    return true;
  });

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div></div>;
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">סוגי תחזוקה</h1>
        <p className="text-sm text-slate-500 mt-1">הגדר פעולות תחזוקה וסוגי טיפול</p>
      </div>

      <Tabs defaultValue="types">
        <TabsList className="mb-4">
          <TabsTrigger value="types"><Wrench className="h-4 w-4 ml-1" />סוגי תחזוקה</TabsTrigger>
          <TabsTrigger value="steps"><LayoutGrid className="h-4 w-4 ml-1" />פעולות תחזוקה</TabsTrigger>
          <TabsTrigger value="matrix"><LayoutGrid className="h-4 w-4 ml-1" />מטריצת טיפולים</TabsTrigger>
          <TabsTrigger value="sequences"><ListOrdered className="h-4 w-4 ml-1" />רצפי טיפולים</TabsTrigger>
        </TabsList>

        {/* ─── לשונית 1: סוגי תחזוקה ─── */}
        <TabsContent value="types" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Filters */}
            <BrandUnitFilter
              unitBrands={unitBrands}
              filterBrandId={filterBrandId}
              filterUnitType={filterUnitType}
              onBrandChange={setFilterBrandId}
              onUnitTypeChange={setFilterUnitType}
            />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setImportDialogTab("types")}>
                <Upload className="h-4 w-4 ml-2" /> ייבוא מאקסל
              </Button>
              <Button onClick={openNew}>
                <Plus className="h-4 w-4 ml-2" /> סוג תחזוקה חדש
              </Button>
            </div>
          </div>
          {!filterBrandId ? (
            <div className="text-center py-16 text-slate-400 border-2 border-dashed rounded-lg">
              <Wrench className="h-12 w-12 mx-auto mb-3 text-slate-200" />
              בחר מותג כדי להציג סוגי תחזוקה
            </div>
          ) : !filterUnitType ? (
            <div className="text-center py-16 text-slate-400 border-2 border-dashed rounded-lg">
              <Wrench className="h-12 w-12 mx-auto mb-3 text-slate-200" />
              בחר סוג יחידה כדי להציג סוגי תחזוקה
            </div>
          ) : filteredTypes.length === 0 ? (
            <div className="text-center py-16 text-slate-400 border-2 border-dashed rounded-lg">
              <Wrench className="h-12 w-12 mx-auto mb-3 text-slate-200" />
              אין סוגי תחזוקה למותג וסוג יחידה זה. לחץ על "סוג תחזוקה חדש" להתחלה.
            </div>
          ) : (
            <DragDropContext onDragEnd={(result) => {
              if (!result.destination) return;
              const reordered = Array.from(orderedTypes);
              const srcItem = filteredTypes[result.source.index];
              const dstItem = filteredTypes[result.destination.index];
              const srcIdx = reordered.findIndex(t => t.id === srcItem.id);
              const dstIdx = reordered.findIndex(t => t.id === dstItem.id);
              const [moved] = reordered.splice(srcIdx, 1);
              reordered.splice(dstIdx, 0, moved);
              setOrderedTypes(reordered);
            }}>
              <Droppable droppableId="types-grid" direction="horizontal">
                {(provided) => (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" ref={provided.innerRef} {...provided.droppableProps}>
                    {filteredTypes.map((type, index) => (
                      <Draggable key={type.id} draggableId={type.id} index={index}>
                        {(drag, snapshot) => (
                          <Card ref={drag.innerRef} {...drag.draggableProps} className={`hover:shadow-md transition-shadow ${snapshot.isDragging ? "shadow-xl ring-2 ring-emerald-300" : ""}`}>
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-3 min-w-0">
                                  <div {...drag.dragHandleProps} className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 shrink-0">
                                    <GripVertical className="h-4 w-4" />
                                  </div>
                                  <div className="w-4 h-4 rounded-full shrink-0 mt-0.5" style={{ backgroundColor: type.color || "#10b981" }} />
                                  <div className="min-w-0">
                                    <h3 className="font-semibold text-slate-800 truncate">{type.name}</h3>
                                    {type.description && <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{type.description}</p>}
                                  </div>
                                </div>
                                <div className="flex gap-1 shrink-0">
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(type)}><Pencil className="h-3.5 w-3.5" /></Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => setTypeToDelete(type)}><Trash2 className="h-3.5 w-3.5" /></Button>
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-2 mt-3">
                                <Badge variant="outline" className="text-xs gap-1">
                                  <Clock className="h-3 w-3" />
                                  {type.estimated_duration_hours || 1} שעות
                                </Badge>
                                <Badge variant="secondary" className="text-xs">{type.step_configs?.length || 0} פעולות</Badge>
                                {getBrandName(type.brand_id) ? (
                                  <Badge className="text-xs bg-blue-100 text-blue-700">{getBrandName(type.brand_id)}</Badge>
                                ) : (
                                  <Badge variant="outline" className="text-xs text-slate-400">כללי</Badge>
                                )}
                                {type.unit_type && <Badge variant="outline" className="text-xs">{type.unit_type}</Badge>}
                              </div>
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
        </TabsContent>

        {/* ─── לשונית 2: פעולות תחזוקה ─── */}
        <TabsContent value="steps">
          <div className="flex justify-end mb-3">
            <Button variant="outline" size="sm" onClick={() => setImportDialogTab("steps")}>
              <Upload className="h-4 w-4 ml-2" /> ייבוא מאקסל
            </Button>
          </div>
          <StepLibraryManager
          parts={parts}
          unitBrands={unitBrands}
          onStepsChanged={async () => {
            // Refresh only steps (for matrix view) without reloading entire page state
            try {
              const stepsData = await base44.entities.MaintenanceStep.list();
              setMaintenanceSteps(stepsData || []);
            } catch {}
          }}
        />
        </TabsContent>

        {/* ─── לשונית 3: מטריצת טיפולים ─── */}
        <TabsContent value="matrix">
          <div className="flex justify-end mb-3">
            <Button variant="outline" size="sm" onClick={() => setImportDialogTab("matrix")}>
              <Upload className="h-4 w-4 ml-2" /> ייבוא מאקסל
            </Button>
          </div>
          <MaintenanceMatrixView
            maintenanceTypes={types}
            maintenanceSteps={maintenanceSteps}
            unitBrands={unitBrands}
            onUpdateType={handleUpdateTypeFromMatrix}
          />
        </TabsContent>

        {/* ─── לשונית 4: רצפי טיפולים ─── */}
        <TabsContent value="sequences">
          <MaintenanceSequenceManager
            maintenanceTypes={types}
            unitBrands={unitBrands}
          />
        </TabsContent>
      </Tabs>

      {/* ─── Import Dialog ─── */}
      {importDialogTab && (
        <MaintenanceImportDialog
          open={!!importDialogTab}
          onClose={() => setImportDialogTab(null)}
          tabKey={importDialogTab}
          unitBrands={unitBrands}
          onImported={() => { setImportDialogTab(null); loadData(); }}
        />
      )}

      <MaintenanceTypeFormDialog
        open={showForm}
        onClose={() => { setShowForm(false); setEditingType(null); }}
        onSubmit={handleSubmitType}
        editingType={editingType}
        unitBrands={unitBrands}
        maintenanceSteps={maintenanceSteps}
      />

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