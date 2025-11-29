import React, { useState } from 'react';
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, AlertTriangle, Package, Plus } from "lucide-react";

export default function MaintenanceStep({ data, onUpdate }) {
  const [procedureSteps, setProcedureSteps] = useState(data.procedure_steps || []);

  const handleStepToggle = (stepIndex, isCompleted) => {
    const updatedSteps = [...procedureSteps];
    updatedSteps[stepIndex].is_completed = isCompleted;
    
    // If step is completed and has required parts, add them to parts_used (only if should_add is true)
    if (isCompleted && updatedSteps[stepIndex].parts_required?.length > 0) {
      const currentPartsUsed = data.parts_used || [];
      const newPartsToAdd = [];

      updatedSteps[stepIndex].parts_required.forEach(part => {
        // Only add part if should_add is true
        if (part.should_add) {
          // Check if this part is already in parts_used
          const existingPart = currentPartsUsed.find(p => p.part_number === part.part_sku);
          if (!existingPart) {
            newPartsToAdd.push({
              part_id: '', // Will be filled when available
              part_number: part.part_sku,
              name: part.part_name || part.part_sku,
              quantity: part.quantity || 1,
              has_serial: false,
              old_serial: '',
              new_serial: ''
            });
          }
        }
      });

      if (newPartsToAdd.length > 0) {
        onUpdate({
          procedure_steps: updatedSteps,
          parts_used: [...currentPartsUsed, ...newPartsToAdd]
        });
      } else {
        onUpdate({ procedure_steps: updatedSteps });
      }
    } else if (!isCompleted) {
      // If step is uncompleted, remove its parts from parts_used
      const currentPartsUsed = data.parts_used || [];
      const stepPartSkus = updatedSteps[stepIndex].parts_required?.map(p => p.part_sku) || [];
      const filteredPartsUsed = currentPartsUsed.filter(part => 
        !stepPartSkus.includes(part.part_number)
      );

      onUpdate({
        procedure_steps: updatedSteps,
        parts_used: filteredPartsUsed
      });
    } else {
      onUpdate({ procedure_steps: updatedSteps });
    }

    setProcedureSteps(updatedSteps);
  };

  const handlePartShouldAddToggle = (stepIndex, partIndex, shouldAdd) => {
    const updatedSteps = [...procedureSteps];
    updatedSteps[stepIndex].parts_required[partIndex].should_add = shouldAdd;
    
    // If step is completed and we're unchecking should_add, remove the part from parts_used
    if (!shouldAdd && updatedSteps[stepIndex].is_completed) {
      const currentPartsUsed = data.parts_used || [];
      const partSku = updatedSteps[stepIndex].parts_required[partIndex].part_sku;
      const filteredPartsUsed = currentPartsUsed.filter(part => part.part_number !== partSku);
      
      onUpdate({
        procedure_steps: updatedSteps,
        parts_used: filteredPartsUsed
      });
    } else {
      onUpdate({ procedure_steps: updatedSteps });
    }
    
    setProcedureSteps(updatedSteps);
  };

  const addPartManually = (stepIndex, part) => {
    if (!part.should_add) return; // Don't add if checkbox is unchecked
    
    const currentPartsUsed = data.parts_used || [];
    const existingPart = currentPartsUsed.find(p => p.part_number === part.part_sku);
    
    if (!existingPart) {
      const newPart = {
        part_id: '',
        part_number: part.part_sku,
        name: part.part_name || part.part_sku,
        quantity: part.quantity || 1,
        has_serial: false,
        old_serial: '',
        new_serial: ''
      };
      
      onUpdate({
        parts_used: [...currentPartsUsed, newPart]
      });
    }
  };

  const completedSteps = procedureSteps.filter(step => step.is_completed).length;
  const totalSteps = procedureSteps.length;
  const optionalSteps = procedureSteps.filter(step => step.is_optional).length;
  const requiredSteps = totalSteps - optionalSteps;
  const completedRequiredSteps = procedureSteps.filter(step => step.is_completed && !step.is_optional).length;

  if (!data.selected_procedure_name || procedureSteps.length === 0) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          לא נבחר נוהל תחזוקה או שהנוהל אינו מכיל שלבים.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 p-4 rounded-lg">
        <h3 className="text-lg font-semibold mb-2">{data.selected_procedure_name}</h3>
        <div className="flex gap-4 text-sm">
          <Badge variant="outline">
            <CheckCircle className="w-3 h-3 ml-1" />
            {completedSteps} מתוך {totalSteps} שלבים הושלמו
          </Badge>
          <Badge variant={completedRequiredSteps === requiredSteps ? "default" : "secondary"}>
            שלבים חובה: {completedRequiredSteps}/{requiredSteps}
          </Badge>
          {optionalSteps > 0 && (
            <Badge variant="outline">
              שלבים אופציונליים: {optionalSteps}
            </Badge>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {procedureSteps.map((step, index) => (
          <Card key={index} className={`p-4 ${step.is_completed ? 'bg-green-50 border-green-200' : ''}`}>
            <div className="flex items-start gap-3">
              <Checkbox
                id={`step-${index}`}
                checked={step.is_completed}
                onCheckedChange={(checked) => handleStepToggle(index, checked)}
                className="mt-1"
              />
              <div className="flex-1">
                <div className="flex items-start justify-between">
                  <label 
                    htmlFor={`step-${index}`}
                    className={`text-sm font-medium cursor-pointer ${
                      step.is_completed ? 'line-through text-gray-600' : ''
                    }`}
                  >
                    {step.description}
                    {step.is_optional && (
                      <Badge variant="secondary" className="mr-2 text-xs">
                        אופציונלי
                      </Badge>
                    )}
                  </label>
                </div>
                
                {step.safety_note && 
                 step.safety_note.trim() && 
                 step.safety_note.toLowerCase() !== 'n/a' && (
                  <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
                    <div className="flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-yellow-600" />
                      <span className="font-medium text-yellow-800">הערות:</span>
                    </div>
                    <p className="text-yellow-700 mt-1">{step.safety_note}</p>
                  </div>
                )}

                {step.parts_required && step.parts_required.length > 0 && (
                  <div className="mt-2 p-2 bg-gray-50 border border-gray-200 rounded">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-gray-700 flex items-center gap-1">
                        <Package className="w-3 h-3" />
                        חלקים נדרשים:
                      </span>
                    </div>
                    <div className="space-y-2">
                      {step.parts_required.map((part, partIndex) => (
                        <div key={partIndex} className="flex items-center justify-between text-xs bg-white p-2 rounded border">
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={part.should_add !== false}
                              onCheckedChange={(checked) => handlePartShouldAddToggle(index, partIndex, checked)}
                              className="h-3 w-3"
                            />
                            <div className={part.should_add === false ? 'text-gray-400 line-through' : ''}>
                              <div className="font-medium">{part.part_name || part.part_sku}</div>
                              <div className="text-gray-500">מק"ט: {part.part_sku} - כמות: {part.quantity || 1}</div>
                            </div>
                          </div>
                          {!step.is_completed && part.should_add !== false && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => addPartManually(index, part)}
                              className="text-xs h-6 px-2"
                            >
                              <Plus className="w-3 h-3 ml-1" />
                              הוסף
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {completedRequiredSteps < requiredSteps && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            עדיין נותרו {requiredSteps - completedRequiredSteps} שלבים חובה שטרם הושלמו.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}