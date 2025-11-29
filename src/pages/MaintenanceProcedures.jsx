
import React, { useState, useEffect } from "react";
import { ProcedureTemplate } from "@/entities/ProcedureTemplate";
import { MaintenanceStep } from "@/entities/MaintenanceStep";
import { Part } from "@/entities/Part";
import { Button } from "@/components/ui/button";
import { Plus, Edit, Trash2, ListChecks, Wrench, ChevronDown, Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "@/components/ui/use-toast";
import ProcedureTemplateForm from "../components/maintenance/ProcedureTemplateForm";
import MaintenanceStepForm from "../components/maintenance/MaintenanceStepForm";
import ImportStepsDialog from "../components/maintenance/ImportStepsDialog";
import ProcedureManagementWindow from "../components/maintenance/ProcedureManagementWindow";
import FixPartNames from '../components/maintenance/FixPartNames'; // New import

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

export default function MaintenanceProceduresPage() {
  const [deviceType, setDeviceType] = useState('Astronaut_A4');
  const [templates, setTemplates] = useState([]);
  const [steps, setSteps] = useState([]);
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [showStepForm, setShowStepForm] = useState(false);
  const [editingStep, setEditingStep] = useState(null);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showProcedureManagement, setShowProcedureManagement] = useState(false);

  useEffect(() => {
    loadBaseData();
  }, []);

  useEffect(() => {
    if (deviceType) {
      loadDeviceSpecificData();
    }
  }, [deviceType]);

  const loadBaseData = async () => {
    setLoading(true);
    try {
      const partsData = await Part.list().catch(() => []);
      setParts(partsData);
    } catch (error) {
      console.error("Error loading base data:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadDeviceSpecificData = async () => {
    if (!deviceType) return;
    setLoading(true);
    try {
      const [templatesData, stepsData] = await Promise.all([
        ProcedureTemplate.filter({ device_type: deviceType }),
        MaintenanceStep.filter({ device_type: deviceType })
      ]);
      setTemplates(templatesData || []);
      setSteps(stepsData || []);
    } catch (error) {
      console.error(`Error loading data for ${deviceType}:`, error);
    } finally {
      setLoading(false);
    }
  };

  const handleTemplateSubmit = async (formData) => {
    try {
      if (editingTemplate) {
        await ProcedureTemplate.update(editingTemplate.id, formData);
        toast({ title: "נוהל עודכן בהצלחה" });
      } else {
        await ProcedureTemplate.create(formData);
        toast({ title: "נוהל חדש נוצר" });
      }
      setShowTemplateForm(false);
      setEditingTemplate(null);
      await loadDeviceSpecificData();
    } catch (error) {
      console.error("Error saving template:", error);
      toast({ variant: "destructive", title: "שגיאה בשמירת הנוהל" });
    }
  };

  const handleDeleteTemplate = async (templateId) => {
    if (confirm('האם אתה בטוח שברצונך למחוק נוהל זה?')) {
      try {
        await ProcedureTemplate.delete(templateId);
        toast({ title: "הנוהל נמחק" });
        await loadDeviceSpecificData();
      } catch (error) {
        console.error("Error deleting template:", error);
        toast({ variant: "destructive", title: "שגיאה במחיקת הנוהל" });
      }
    }
  };

  const handleStepSubmit = async (formData) => {
    try {
      if (editingStep) {
        await MaintenanceStep.update(editingStep.id, formData);
        toast({ title: "שלב עודכן בהצלחה" });
      } else {
        await MaintenanceStep.create(formData);
        toast({ title: "שלב חדש נוצר" });
      }
      setShowStepForm(false);
      setEditingStep(null);
      await loadDeviceSpecificData();
    } catch (error) {
      console.error("Error saving step:", error);
      toast({ variant: "destructive", title: "שגיאה בשמירת השלב" });
    }
  };

  const handleDeleteStep = async (stepId) => {
    // Optional: Check if step is used in any templates before deleting
    const allTemplates = await ProcedureTemplate.list(); // Check all templates, not just for current device
    const templatesUsingStep = allTemplates.filter(t => (t.steps || []).some(s => s.step_id === stepId));
    const confirmationMessage = templatesUsingStep.length > 0
      ? `שלב זה בשימוש ב-${templatesUsingStep.length} נהלים. האם אתה בטוח שברצונך למחוק אותו? הפעולה תסיר אותו מכל הנהלים המשתמשים בו.`
      : 'האם אתה בטוח שברצונך למחוק שלב זה?';

    if (confirm(confirmationMessage)) {
      try {
        await MaintenanceStep.delete(stepId);
        // Also remove the stepId from any templates that use it
        for (const template of templatesUsingStep) {
            const newSteps = (template.steps || []).filter(s => s.step_id !== stepId);
            await ProcedureTemplate.update(template.id, { steps: newSteps });
        }
        toast({ title: "השלב נמחק" });
        await loadDeviceSpecificData();
      } catch (error) {
        console.error("Error deleting step:", error);
        toast({ variant: "destructive", title: "שגיאה במחיקת השלב" });
      }
    }
  };

  return (
    <div className="p-6" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6"> {/* Changed max-w-4xl to max-w-7xl */}
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">נהלי תחזוקה</h1>
          <div className="flex gap-3">
            <Button 
              onClick={() => setShowProcedureManagement(true)}
              className="bg-green-600 hover:bg-green-700"
            >
              <ListChecks className="w-4 h-4 ml-2" />
              ניהול נהלים מתקדם
            </Button>
            <div className="w-64">
              <Select value={deviceType} onValueChange={setDeviceType}>
                <SelectTrigger>
                  <SelectValue placeholder="בחר סוג מכשיר" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(deviceTypeLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <FixPartNames /> {/* New component added */}

        {/* Templates Section */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2"><ListChecks /> נהלי תחזוקה</CardTitle>
            <Button onClick={() => { setEditingTemplate(null); setShowTemplateForm(true); }}>
              <Plus className="w-4 h-4 ml-2" /> נוהל חדש
            </Button>
          </CardHeader>
          <CardContent>
            {loading && <p>טוען נהלים...</p>}
            {!loading && templates.length === 0 && <p className="text-gray-500 text-center py-4">אין נהלים עבור מכשיר זה.</p>}
            <div className="space-y-2">
              {templates.map(template => (
                <div key={template.id} className="flex items-center justify-between p-3 border rounded-lg bg-white">
                  <div>
                    <p className="font-medium">{template.name}</p>
                    <p className="text-sm text-gray-500">{(template.steps || []).length} שלבים</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="icon" onClick={() => { setEditingTemplate(template); setShowTemplateForm(true); }}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="destructive" size="icon" onClick={() => handleDeleteTemplate(template.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        
        {/* Steps Bank Section */}
        <Card>
          <Collapsible>
            <CollapsibleTrigger className="w-full">
              <CardHeader className="flex flex-row items-center justify-between cursor-pointer hover:bg-gray-50">
                <CardTitle className="flex items-center gap-2"><Wrench /> בנק השלבים ({steps.length})</CardTitle>
                <ChevronDown className="h-5 w-5 transition-transform [&[data-state=open]]:rotate-180" />
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                <div className="flex justify-end mb-4 gap-2">
                  <Button variant="outline" onClick={() => setShowImportDialog(true)}>
                    <Upload className="w-4 h-4 ml-2" /> ייבוא שלבים
                  </Button>
                  <Button variant="outline" onClick={() => { setEditingStep(null); setShowStepForm(true); }}>
                    <Plus className="w-4 h-4 ml-2" /> שלב חדש
                  </Button>
                </div>
                {loading && <p>טוען שלבים...</p>}
                {!loading && steps.length === 0 && <p className="text-gray-500 text-center py-4">אין שלבים עבור מכשיר זה.</p>}
                <div className="space-y-2">
                  {steps.map(step => (
                    <div key={step.id} className="flex items-center justify-between p-3 border rounded-lg bg-white">
                      <p className="flex-1">{step.description}</p>
                      <div className="flex gap-2">
                        <Button variant="outline" size="icon" onClick={() => { setEditingStep(step); setShowStepForm(true); }}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="destructive" size="icon" onClick={() => handleDeleteStep(step.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>

        {/* Dialog for Template Form */}
        <Dialog open={showTemplateForm} onOpenChange={setShowTemplateForm}>
          <DialogContent className="max-w-2xl" dir="rtl">
            <DialogHeader>
              <DialogTitle>{editingTemplate ? 'עריכת נוהל' : 'נוהל חדש'}</DialogTitle>
            </DialogHeader>
            <ProcedureTemplateForm
              template={editingTemplate}
              allSteps={steps}
              deviceType={deviceType}
              onSubmit={handleTemplateSubmit}
              onCancel={() => setShowTemplateForm(false)}
            />
          </DialogContent>
        </Dialog>
        
        {/* Dialog for Step Form */}
        <Dialog open={showStepForm} onOpenChange={setShowStepForm}>
          <DialogContent dir="rtl">
            <DialogHeader>
              <DialogTitle>{editingStep ? 'עריכת שלב' : 'שלב חדש'}</DialogTitle>
            </DialogHeader>
            <MaintenanceStepForm
              step={editingStep}
              parts={parts}
              deviceType={deviceType}
              onSubmit={handleStepSubmit}
              onCancel={() => setShowStepForm(false)}
            />
          </DialogContent>
        </Dialog>
        
        {/* Dialog for Import Steps */}
        <ImportStepsDialog
          open={showImportDialog}
          onOpenChange={setShowImportDialog}
          deviceType={deviceType}
          onImportComplete={loadDeviceSpecificData}
        />

        {/* Dialog for Procedure Management */}
        <ProcedureManagementWindow
          open={showProcedureManagement}
          onOpenChange={setShowProcedureManagement}
          deviceType={deviceType}
          onDataChange={loadDeviceSpecificData}
        />
      </div>
    </div>
  );
}
