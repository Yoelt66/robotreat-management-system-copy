import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/components/ui/use-toast";
import { Package } from "lucide-react";

export default function ProcedureTemplateForm({ template, allSteps, deviceType, onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    name: '',
    steps: [],
    device_type: deviceType,
  });

  useEffect(() => {
    // If template data is passed, update the form state
    if (template) {
      setFormData({
        name: template.name || '',
        steps: template.steps || [],
        device_type: template.device_type || deviceType,
        id: template.id
      });
    } else {
       setFormData({
        name: '',
        steps: [],
        device_type: deviceType,
      });
    }
  }, [template, deviceType]);
  
  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleStepToggle = (stepId, checked) => {
    let newSteps = [...formData.steps];
    if (checked) {
      // Add step if it doesn't exist
      if (!newSteps.some(s => s.step_id === stepId)) {
        newSteps.push({ step_id: stepId, is_optional: false });
      }
    } else {
      // Remove step
      newSteps = newSteps.filter(s => s.step_id !== stepId);
    }
    handleInputChange('steps', newSteps);
  };
  
  const handleOptionalToggle = (stepId, checked) => {
    const newSteps = formData.steps.map(step => 
      step.step_id === stepId ? { ...step, is_optional: checked } : step
    );
    handleInputChange('steps', newSteps);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast({ variant: 'destructive', title: 'יש להזין שם לנוהל' });
      return;
    }
    onSubmit(formData);
  };

  const isStepSelected = (stepId) => formData.steps.some(s => s.step_id === stepId);
  const isStepOptional = (stepId) => formData.steps.find(s => s.step_id === stepId)?.is_optional || false;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="template_name">שם הנוהל *</Label>
        <Input
          id="template_name"
          value={formData.name}
          onChange={(e) => handleInputChange('name', e.target.value)}
          placeholder="למשל: טיפול 6 חודשים"
          required
        />
      </div>
      <div>
        <Label>שלבי תחזוקה</Label>
        <ScrollArea className="h-72 w-full rounded-md border">
          <div className="p-4 space-y-2">
            {allSteps.map(step => (
              <div key={step.id} className="flex items-center gap-4 p-2 rounded hover:bg-gray-50">
                <Checkbox
                  id={`select-step-${step.id}`}
                  checked={isStepSelected(step.id)}
                  onCheckedChange={(checked) => handleStepToggle(step.id, checked)}
                />
                <div className="flex-1 grid gap-1.5 leading-none">
                  <label htmlFor={`select-step-${step.id}`} className="font-medium cursor-pointer">
                    {step.description}
                  </label>
                  {step.parts_required && step.parts_required.length > 0 && (
                     <div className="text-xs text-gray-500 flex items-center gap-1">
                      <Package className="w-3 h-3" />
                      {step.parts_required.length} חלקים
                    </div>
                  )}
                </div>
                {isStepSelected(step.id) && (
                  <div className="flex items-center space-x-2 pr-2 border-r">
                     <label
                      htmlFor={`optional-step-${step.id}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      אופציונלי
                    </label>
                    <Checkbox
                      id={`optional-step-${step.id}`}
                      checked={isStepOptional(step.id)}
                      onCheckedChange={(checked) => handleOptionalToggle(step.id, checked)}
                    />
                  </div>
                )}
              </div>
            ))}
             {allSteps.length === 0 && (
              <div className="text-center text-gray-500 py-10">
                אין שלבים מוגדרים עבור סוג מכשיר זה.
                <br/>
                נא להוסיף שלבים ב'בנק השלבים' תחילה.
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
      <div className="flex justify-start gap-3 pt-4 border-t">
        <Button type="submit">{template ? 'עדכן נוהל' : 'צור נוהל'}</Button>
        <Button type="button" variant="outline" onClick={onCancel}>ביטול</Button>
      </div>
    </form>
  );
}