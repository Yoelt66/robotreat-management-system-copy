
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Save, X, Package, AlertTriangle, Check, Square } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { ProcedureTemplate } from "@/entities/ProcedureTemplate";
import { MaintenanceStep } from "@/entities/MaintenanceStep";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const deviceTypeLabels = {
  Astronaut_A3: "Astronaut A3",
  Astronaut_A3N: "Astronaut A3N",
  Astronaut_A4: "Astronaut A4",
  Delaval_2008: "Delaval 2008",
  Delaval_2011: "Delaval 2011",
  Milk_tank: "מיכל חלב",
  CRS: "CRS+",
  Juno_100: "Juno 100",
  Juno_150: "Juno 150",
  Luna: "Luna",
  other: "אחר"
};

export default function ProcedureManagementWindow({ open, onOpenChange, deviceType, onDataChange }) {
  const [procedures, setProcedures] = useState([]);
  const [steps, setSteps] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newProcedureName, setNewProcedureName] = useState('');
  const [editingProcedureId, setEditingProcedureId] = useState(null);
  const [editingProcedureName, setEditingProcedureName] = useState('');

  // Track changes for batch save
  const [pendingChanges, setPendingChanges] = useState({});

  useEffect(() => {
    if (open && deviceType) {
      loadData();
    }
  }, [open, deviceType]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [proceduresData, stepsData] = await Promise.all([
        ProcedureTemplate.filter({ device_type: deviceType }),
        MaintenanceStep.filter({ device_type: deviceType })
      ]);
      setProcedures(proceduresData || []);
      setSteps(stepsData || []);
      setPendingChanges({});
    } catch (error) {
      console.error("Error loading data:", error);
      toast({ variant: "destructive", title: "שגיאה בטעינת הנתונים" });
    } finally {
      setLoading(false);
    }
  };

  const handleAddProcedure = async () => {
    if (!newProcedureName.trim()) {
      toast({ variant: "destructive", title: "יש להזין שם לנוהל" });
      return;
    }

    try {
      const newProcedure = await ProcedureTemplate.create({
        name: newProcedureName.trim(),
        device_type: deviceType,
        steps: [],
        is_active: true
      });
      
      setNewProcedureName('');
      toast({ title: "נוהל חדש נוצר בהצלחה" });
      await loadData();
    } catch (error) {
      console.error("Error creating procedure:", error);
      toast({ variant: "destructive", title: "שגיאה ביצירת הנוהל" });
    }
  };

  const handleDeleteProcedure = async (procedureId) => {
    if (confirm('האם אתה בטוח שברצונך למחוק נוהל זה?')) {
      try {
        await ProcedureTemplate.delete(procedureId);
        // Remove from pending changes if it was modified
        const newPendingChanges = { ...pendingChanges };
        delete newPendingChanges[procedureId];
        setPendingChanges(newPendingChanges);
        
        toast({ title: "הנוהל נמחק בהצלחה" });
        await loadData();
      } catch (error) {
        console.error("Error deleting procedure:", error);
        toast({ variant: "destructive", title: "שגיאה במחיקת הנוהל" });
      }
    }
  };

  const handleUpdateProcedureName = async (procedureId) => {
    if (!editingProcedureName.trim()) {
      toast({ variant: "destructive", title: "יש להזין שם לנוהל" });
      return;
    }

    try {
      const procedure = procedures.find(p => p.id === procedureId);
      await ProcedureTemplate.update(procedureId, {
        ...procedure,
        name: editingProcedureName.trim()
      });
      
      setEditingProcedureId(null);
      setEditingProcedureName('');
      toast({ title: "שם הנוהל עודכן בהצלחה" });
      await loadData();
    } catch (error) {
      console.error("Error updating procedure name:", error);
      toast({ variant: "destructive", title: "שגיאה בעדכון שם הנוהל" });
    }
  };

  const handleStepToggle = (procedureId, stepId, isChecked) => {
    const procedure = procedures.find(p => p.id === procedureId);
    let updatedSteps = [...((pendingChanges[procedureId]?.steps) || (procedure.steps || []))];
    
    if (isChecked) {
      // Add step if it doesn't exist
      if (!updatedSteps.some(s => s.step_id === stepId)) {
        updatedSteps.push({ step_id: stepId, is_optional: false });
      }
    } else {
      // Remove step
      updatedSteps = updatedSteps.filter(s => s.step_id !== stepId);
    }
    
    // Update pending changes
    setPendingChanges(prev => ({
      ...prev,
      [procedureId]: {
        ...(prev[procedureId] || procedure), // Use existing pending or original procedure
        steps: updatedSteps
      }
    }));
  };

  const handleOptionalToggle = (procedureId, stepId, isOptional) => {
    const procedure = procedures.find(p => p.id === procedureId);
    const currentSteps = pendingChanges[procedureId]?.steps || procedure.steps || [];
    
    const updatedSteps = currentSteps.map(step =>
      step.step_id === stepId ? { ...step, is_optional: isOptional } : step
    );
    
    // Update pending changes
    setPendingChanges(prev => ({
      ...prev,
      [procedureId]: {
        ...(prev[procedureId] || procedure), // Use existing pending or original procedure
        steps: updatedSteps
      }
    }));
  };

  const handleBulkStepToggle = (stepId, isChecked) => {
    const newPendingChanges = { ...pendingChanges };
    
    procedures.forEach(procedure => {
      let updatedSteps = [...((newPendingChanges[procedure.id]?.steps) || (procedure.steps || []))];
      
      if (isChecked) {
        // Add step to all procedures if it doesn't exist
        if (!updatedSteps.some(s => s.step_id === stepId)) {
          updatedSteps.push({ step_id: stepId, is_optional: false });
        }
      } else {
        // Remove step from all procedures
        updatedSteps = updatedSteps.filter(s => s.step_id !== stepId);
      }
      
      newPendingChanges[procedure.id] = {
        ...(newPendingChanges[procedure.id] || procedure), // Use existing pending or original procedure
        steps: updatedSteps
      };
    });
    
    setPendingChanges(newPendingChanges);
  };

  const isStepInProcedure = (procedureId, stepId) => {
    const pendingProcedure = pendingChanges[procedureId];
    if (pendingProcedure) {
      return (pendingProcedure.steps || []).some(s => s.step_id === stepId);
    }
    const procedure = procedures.find(p => p.id === procedureId);
    return (procedure?.steps || []).some(s => s.step_id === stepId);
  };

  const isStepOptional = (procedureId, stepId) => {
    const pendingProcedure = pendingChanges[procedureId];
    if (pendingProcedure) {
      const step = (pendingProcedure.steps || []).find(s => s.step_id === stepId);
      return step?.is_optional || false;
    }
    const procedure = procedures.find(p => p.id === procedureId);
    const step = (procedure?.steps || []).find(s => s.step_id === stepId);
    return step?.is_optional || false;
  };

  const isStepInAllProcedures = (stepId) => {
    return procedures.every(procedure => isStepInProcedure(procedure.id, stepId));
  };

  const isStepInSomeProcedures = (stepId) => {
    return procedures.some(procedure => isStepInProcedure(procedure.id, stepId));
  };

  const handleSaveChanges = async () => {
    if (Object.keys(pendingChanges).length === 0) {
      toast({ title: "אין שינויים לשמירה" });
      return;
    }

    setSaving(true);
    try {
      // Save all pending changes
      for (const [procedureId, updatedProcedure] of Object.entries(pendingChanges)) {
        // Only update if there are actual changes (e.g., steps array changed)
        const originalProcedure = procedures.find(p => p.id === procedureId);
        if (JSON.stringify(originalProcedure?.steps) !== JSON.stringify(updatedProcedure.steps)) {
          await ProcedureTemplate.update(procedureId, updatedProcedure);
        }
      }
      
      setPendingChanges({});
      toast({ title: `${Object.keys(pendingChanges).length} נהלים נשמרו בהצלחה` });
      await loadData();
    } catch (error) {
      console.error("Error saving changes:", error);
      toast({ variant: "destructive", title: "שגיאה בשמירת השינויים" });
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (Object.keys(pendingChanges).length > 0) {
      if (confirm('יש שינויים שלא נשמרו. האם אתה בטוח שברצונך לסגור?')) {
        setPendingChanges({});
        setEditingProcedureId(null);
        setEditingProcedureName('');
        setNewProcedureName('');
        onOpenChange(false);
        if (onDataChange) {
          onDataChange();
        }
      }
    } else {
      setEditingProcedureId(null);
      setEditingProcedureName('');
      setNewProcedureName('');
      onOpenChange(false);
      if (onDataChange) {
        onDataChange();
      }
    }
  };

  const getBulkCheckboxState = (stepId) => {
    const inAll = isStepInAllProcedures(stepId);
    const inSome = isStepInSomeProcedures(stepId);
    
    if (inAll) return 'checked';
    if (inSome) return 'indeterminate';
    return 'unchecked';
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] overflow-hidden" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            ניהול נהלי תחזוקה - {deviceTypeLabels[deviceType] || deviceType}
            {Object.keys(pendingChanges).length > 0 && (
              <Badge variant="secondary" className="mr-2">
                {Object.keys(pendingChanges).length} שינויים ממתינים
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col overflow-hidden" style={{ height: 'calc(95vh - 200px)' }}>
          {/* Add New Procedure */}
          <Card className="mb-4 flex-shrink-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">הוסף נוהל חדש</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3">
                <Input
                  placeholder="שם הנוהל החדש..."
                  value={newProcedureName}
                  onChange={(e) => setNewProcedureName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddProcedure()}
                />
                <Button onClick={handleAddProcedure} disabled={loading}>
                  <Plus className="w-4 h-4 ml-2" />
                  הוסף
                </Button>
              </div>
            </CardContent>
          </Card>

          {loading ? (
            <div className="flex justify-center items-center flex-1">
              <div className="text-center">טוען נתונים...</div>
            </div>
          ) : (
            <div className="flex-1 overflow-auto border rounded-lg">
              <div className="overflow-y-scroll overflow-x-auto" style={{ maxHeight: 'calc(95vh - 350px)', scrollbarGutter: 'stable' }}>
                <Table>
                  <TableHeader className="sticky top-0 bg-white border-b-2 z-10">
                    <TableRow>
                      <TableHead className="text-right font-semibold sticky right-0 bg-white z-20 border-l-2 min-w-[250px] max-w-[250px]">
                        שלבי תחזוקה ({steps.length})
                      </TableHead>
                      <TableHead className="text-center font-semibold bg-blue-50 min-w-[100px]">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-xs">בחר הכל</span>
                          <span className="text-xs text-gray-500">פעולות</span>
                        </div>
                      </TableHead>
                      {procedures.map((procedure) => (
                        <TableHead key={procedure.id} className="text-center font-semibold min-w-[150px]">
                          <div className="flex flex-col items-center gap-2">
                            {editingProcedureId === procedure.id ? (
                              <div className="flex gap-1 w-full">
                                <Input
                                  value={editingProcedureName}
                                  onChange={(e) => setEditingProcedureName(e.target.value)}
                                  className="text-sm h-8"
                                  onKeyPress={(e) => e.key === 'Enter' && handleUpdateProcedureName(procedure.id)}
                                />
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleUpdateProcedureName(procedure.id)}
                                  className="h-8 w-8 p-0"
                                >
                                  <Save className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setEditingProcedureId(null);
                                    setEditingProcedureName('');
                                  }}
                                  className="h-8 w-8 p-0"
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center gap-1">
                                <button
                                  onClick={() => {
                                    setEditingProcedureId(procedure.id);
                                    setEditingProcedureName(procedure.name);
                                  }}
                                  className="text-sm hover:underline max-w-full truncate"
                                  title={procedure.name}
                                >
                                  {procedure.name}
                                </button>
                                <div className="flex gap-1">
                                  <Badge variant="outline" className="text-xs">
                                    {(pendingChanges[procedure.id]?.steps || procedure.steps || []).length} שלבים
                                  </Badge>
                                  {pendingChanges[procedure.id] && (
                                    <Badge variant="secondary" className="text-xs">
                                      שונה
                                    </Badge>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleDeleteProcedure(procedure.id)}
                                    className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                  >
                                    <X className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {steps.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={procedures.length + 2} className="text-center py-8 text-gray-500">
                          אין שלבים זמינים עבור סוג מכשיר זה.
                          <br />
                          נא להוסיף שלבים ב'בנק השלבים' תחילה.
                        </TableCell>
                      </TableRow>
                    ) : (
                      steps.map((step) => {
                        const bulkState = getBulkCheckboxState(step.id);
                        return (
                          <TableRow key={step.id} className="hover:bg-gray-50">
                            <TableCell className="font-medium sticky right-0 bg-white border-l-2">
                              <div className="space-y-1">
                                <div className="text-sm">{step.description}</div>
                                {step.parts_required && step.parts_required.length > 0 && (
                                  <div className="flex items-center gap-1 text-xs text-gray-500">
                                    <Package className="w-3 h-3" />
                                    {step.parts_required.length} חלקים
                                  </div>
                                )}
                                {step.safety_note && (
                                  <div className="flex items-center gap-1 text-xs text-orange-600">
                                    <AlertTriangle className="w-3 h-3" />
                                    הערת בטיחות
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-center bg-blue-50">
                              <div className="flex flex-col items-center gap-2">
                                <button
                                  onClick={() => handleBulkStepToggle(step.id, bulkState !== 'checked')}
                                  className="flex items-center justify-center w-5 h-5 border-2 border-blue-500 rounded hover:bg-blue-100"
                                  title={bulkState === 'checked' ? 'הסר מכל הנהלים' : 'הוסף לכל הנהלים'}
                                >
                                  {bulkState === 'checked' && <Check className="w-3 h-3 text-blue-600" />}
                                  {bulkState === 'indeterminate' && <Square className="w-2 h-2 bg-blue-400" />}
                                </button>
                                <span className="text-xs text-gray-600">
                                  {bulkState === 'checked' ? 'בכל' : bulkState === 'indeterminate' ? 'בחלק' : 'באף'}
                                </span>
                              </div>
                            </TableCell>
                            {procedures.map((procedure) => (
                              <TableCell key={procedure.id} className="text-center">
                                <div className="flex flex-col items-center gap-2">
                                  <Checkbox
                                    checked={isStepInProcedure(procedure.id, step.id)}
                                    onCheckedChange={(checked) => handleStepToggle(procedure.id, step.id, checked)}
                                  />
                                  {isStepInProcedure(procedure.id, step.id) && (
                                    <div className="flex items-center gap-1">
                                      <Checkbox
                                        checked={isStepOptional(procedure.id, step.id)}
                                        onCheckedChange={(checked) => handleOptionalToggle(procedure.id, step.id, checked)}
                                      />
                                      <span className="text-xs text-gray-600">אופציונלי</span>
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                            ))}
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={handleClose}>
            סגור
          </Button>
          <Button 
            onClick={handleSaveChanges}
            disabled={saving || Object.keys(pendingChanges).length === 0}
          >
            {saving ? 'שומר...' : `שמור שינויים${Object.keys(pendingChanges).length > 0 ? ` (${Object.keys(pendingChanges).length})` : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
