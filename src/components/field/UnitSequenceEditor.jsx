import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, ArrowUp, ArrowDown, ChevronDown, ChevronUp } from "lucide-react";
import UnitStepConfigEditor from "./UnitStepConfigEditor.jsx";

export default function UnitSequenceEditor({ sequence, onChange, maintenanceTypes = [], maintenanceSteps = [], defaultInterval = 3 }) {
  const [expandedStep, setExpandedStep] = useState(null);

  const addStep = () => {
    onChange([...sequence, {
      step_number: sequence.length + 1,
      maintenance_type_id: "",
      maintenance_type_name: "",
      interval_months: defaultInterval,
      step_configs: [],
    }]);
  };

  const removeStep = (index) => {
    onChange(sequence.filter((_, i) => i !== index).map((s, i) => ({ ...s, step_number: i + 1 })));
  };

  const moveStep = (index, dir) => {
    const target = dir === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= sequence.length) return;
    const updated = [...sequence];
    [updated[index], updated[target]] = [updated[target], updated[index]];
    updated.forEach((s, i) => { s.step_number = i + 1; });
    onChange(updated);
  };

  const updateStep = (index, patch) => {
    const updated = [...sequence];
    updated[index] = { ...updated[index], ...patch };
    onChange(updated);
  };

  const handleTypeChange = (index, typeId) => {
    const type = maintenanceTypes.find(t => t.id === typeId);
    updateStep(index, { maintenance_type_id: typeId, maintenance_type_name: type?.name || "", step_configs: [] });
  };

  const getStepsForType = (typeId) => {
    const type = maintenanceTypes.find(t => t.id === typeId);
    if (!type) return [];
    return maintenanceSteps.filter(s =>
      (!s.brand_id || s.brand_id === type.brand_id) &&
      (!s.unit_type || !type.unit_type || s.unit_type === type.unit_type)
    ).sort((a, b) => (a.sort_order ?? 9999) - (b.sort_order ?? 9999));
  };

  return (
    <div className="space-y-3">
      {sequence.length === 0 ? (
        <div className="text-center py-6 text-slate-500 border-2 border-dashed rounded-lg text-sm">
          לא הוגדר רצף תחזוקה — ניתן להוסיף שלבים
        </div>
      ) : (
        sequence.map((step, index) => {
          const stepsForType = getStepsForType(step.maintenance_type_id);
          const isExpanded = expandedStep === index;
          const hasManualOverride = step.step_configs?.some(c => c.manual_override);

          return (
            <div key={index} className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="flex items-center gap-3 p-3 bg-slate-50">
                <div className="flex flex-col gap-1 shrink-0">
                  <Button type="button" variant="ghost" size="icon" className="h-5 w-5" disabled={index === 0} onClick={() => moveStep(index, "up")}>
                    <ArrowUp className="h-3 w-3" />
                  </Button>
                  <span className="text-xs font-bold text-slate-500 text-center">{step.step_number}</span>
                  <Button type="button" variant="ghost" size="icon" className="h-5 w-5" disabled={index === sequence.length - 1} onClick={() => moveStep(index, "down")}>
                    <ArrowDown className="h-3 w-3" />
                  </Button>
                </div>

                <div className="flex-1 min-w-0">
                  <Select value={step.maintenance_type_id || ""} onValueChange={v => handleTypeChange(index, v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="בחר סוג תחזוקה" />
                    </SelectTrigger>
                    <SelectContent>
                      {maintenanceTypes.map(t => (
                        <SelectItem key={t.id} value={t.id}>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: t.color || "#10b981" }} />
                            {t.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Label className="text-xs text-slate-400 whitespace-nowrap">כל</Label>
                  <Input type="number" min="1"
                    value={step.interval_months ?? defaultInterval}
                    onChange={e => updateStep(index, { interval_months: parseInt(e.target.value) || 1 })}
                    className="w-16 h-8 text-sm text-center" />
                  <span className="text-xs text-slate-500">ח׳</span>
                </div>

                {step.maintenance_type_id && stepsForType.length > 0 && (
                  <Button type="button" variant="ghost" size="sm"
                    className={`text-xs h-8 px-2 shrink-0 ${hasManualOverride ? "text-amber-600" : "text-slate-500"}`}
                    onClick={() => setExpandedStep(isExpanded ? null : index)}>
                    {isExpanded ? <ChevronUp className="h-3.5 w-3.5 ml-1" /> : <ChevronDown className="h-3.5 w-3.5 ml-1" />}
                    פעולות ({stepsForType.length}){hasManualOverride && " ⚠"}
                  </Button>
                )}

                <Button type="button" variant="ghost" size="icon" onClick={() => removeStep(index)}
                  className="shrink-0 text-red-500 hover:text-red-600 h-8 w-8">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              {isExpanded && step.maintenance_type_id && (
                <div className="px-3 pb-3 pt-1 bg-white border-t border-slate-100">
                  <p className="text-[10px] text-slate-400 mb-2 font-medium">פעולות תחזוקה לשלב זה:</p>
                  <UnitStepConfigEditor
                    stepConfigs={step.step_configs || []}
                    allStepDefs={stepsForType}
                    onChange={newConfigs => updateStep(index, { step_configs: newConfigs })}
                  />
                </div>
              )}
            </div>
          );
        })
      )}

      <Button type="button" variant="outline" onClick={addStep} className="w-full">
        <Plus className="h-4 w-4 ml-2" />הוסף שלב לרצף
      </Button>
    </div>
  );
}