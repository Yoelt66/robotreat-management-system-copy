import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";

export default function UnitSequenceEditor({ sequence, onChange, maintenanceTypes, defaultInterval = 3 }) {
  const addStep = () => {
    onChange([...sequence, {
      step_number: sequence.length + 1,
      maintenance_type_id: "",
      interval_months: defaultInterval,
      custom_parts: [],
      use_custom_parts: false,
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

  const updateStep = (index, field, value) => {
    const updated = [...sequence];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      {sequence.length === 0 ? (
        <div className="text-center py-6 text-slate-500 border-2 border-dashed rounded-lg text-sm">
          לא הוגדר רצף תחזוקה — ניתן להוסיף שלבים
        </div>
      ) : (
        sequence.map((step, index) => (
          <div key={index} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
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
              <Select value={step.maintenance_type_id || ""} onValueChange={v => updateStep(index, "maintenance_type_id", v)}>
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

            <div className="flex items-center gap-2 shrink-0">
              <div className="flex flex-col items-center gap-1">
                <Label className="text-xs text-slate-400 whitespace-nowrap">אינטרוול</Label>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    min="1"
                    value={step.interval_months ?? defaultInterval}
                    onChange={e => updateStep(index, "interval_months", parseInt(e.target.value) || 1)}
                    className="w-16 h-8 text-sm text-center"
                  />
                  <span className="text-xs text-slate-500">ח׳</span>
                </div>
              </div>
            </div>

            <Button type="button" variant="ghost" size="icon" onClick={() => removeStep(index)} className="shrink-0 text-red-500 hover:text-red-600">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))
      )}

      <Button type="button" variant="outline" onClick={addStep} className="w-full">
        <Plus className="h-4 w-4 ml-2" />
        הוסף שלב לרצף
      </Button>
    </div>
  );
}