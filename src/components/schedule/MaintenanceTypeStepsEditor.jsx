import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, GripVertical, Search, ChevronUp, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export default function MaintenanceTypeStepsEditor({ steps, onChange, parts }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeStepIndex, setActiveStepIndex] = useState(null);

  const addStep = () => {
    onChange([...steps, {
      step_number: steps.length + 1,
      name: "",
      description: "",
      explanation: "",
      parts: [],
    }]);
  };

  const removeStep = (index) => {
    onChange(steps.filter((_, i) => i !== index).map((s, i) => ({ ...s, step_number: i + 1 })));
  };

  const moveStep = (index, direction) => {
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= steps.length) return;
    const updated = [...steps];
    [updated[index], updated[target]] = [updated[target], updated[index]];
    updated.forEach((s, i) => { s.step_number = i + 1; });
    onChange(updated);
  };

  const updateStep = (index, field, value) => {
    const updated = [...steps];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const addPartToStep = (stepIndex, part) => {
    const updated = [...steps];
    const currentParts = updated[stepIndex].parts || [];
    const existing = currentParts.find(p => p.part_sku === part.sku);
    if (existing) {
      existing.quantity = (existing.quantity || 1) + 1;
    } else {
      currentParts.push({ part_sku: part.sku, part_name: part.name, quantity: 1 });
    }
    updated[stepIndex].parts = currentParts;
    onChange(updated);
    setSearchTerm("");
    setActiveStepIndex(null);
  };

  const removePartFromStep = (stepIndex, partSku) => {
    const updated = [...steps];
    updated[stepIndex].parts = updated[stepIndex].parts.filter(p => p.part_sku !== partSku);
    onChange(updated);
  };

  const updatePartQuantity = (stepIndex, partSku, quantity) => {
    const updated = [...steps];
    const part = updated[stepIndex].parts.find(p => p.part_sku === partSku);
    if (part) part.quantity = quantity;
    onChange(updated);
  };

  const filteredParts = parts.filter(
    p => p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {steps.length === 0 ? (
        <div className="text-center py-8 text-slate-500 border-2 border-dashed rounded-lg">לא הוגדרו שלבים</div>
      ) : (
        steps.map((step, index) => (
          <Card key={index}>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-4">
                <GripVertical className="h-5 w-5 text-slate-400" />
                <span className="font-semibold text-slate-700">שלב {step.step_number}</span>
                <div className="mr-auto flex gap-1">
                  <Button type="button" variant="ghost" size="icon" disabled={index === 0} onClick={() => moveStep(index, "up")}>
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" disabled={index === steps.length - 1} onClick={() => moveStep(index, "down")}>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="text-red-500 hover:text-red-600" onClick={() => removeStep(index)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>שם הפעולה</Label>
                    <Input value={step.name} onChange={e => updateStep(index, "name", e.target.value)} placeholder='לדוגמה: "בדיקת לחץ"' />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>תיאור הפעולה</Label>
                  <Textarea value={step.description} onChange={e => updateStep(index, "description", e.target.value)} rows={2} placeholder="תיאור קצר של הפעולה" />
                </div>

                <div className="space-y-2">
                  <Label>הסבר מפורט לביצוע</Label>
                  <Textarea value={step.explanation || ""} onChange={e => updateStep(index, "explanation", e.target.value)} rows={3} placeholder="שלבי ביצוע מפורטים, הוראות בטיחות וכד'" />
                </div>

                <div className="space-y-2">
                  <Label>חלקים נדרשים לפעולה</Label>
                  <Popover open={activeStepIndex === index}>
                    <PopoverTrigger asChild>
                      <div className="relative">
                        <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
                        <Input
                          placeholder="חפש חלק להוספה (מינ' 2 תווים)..."
                          value={activeStepIndex === index ? searchTerm : ""}
                          onChange={e => { setSearchTerm(e.target.value); setActiveStepIndex(index); }}
                          onFocus={() => setActiveStepIndex(index)}
                          onBlur={() => setTimeout(() => setActiveStepIndex(null), 200)}
                          className="pr-9"
                        />
                      </div>
                    </PopoverTrigger>
                    {searchTerm.length >= 2 && activeStepIndex === index && (
                      <PopoverContent className="w-80 p-0" align="start">
                        <div className="max-h-60 overflow-y-auto">
                          {filteredParts.slice(0, 10).map(part => (
                            <div key={part.id} className="p-2 hover:bg-slate-100 cursor-pointer border-b last:border-b-0" onClick={() => addPartToStep(index, part)}>
                              <p className="font-medium text-sm">{part.sku}</p>
                              <p className="text-xs text-slate-500">{part.name}</p>
                            </div>
                          ))}
                          {filteredParts.length === 0 && <div className="p-4 text-center text-slate-500 text-sm">לא נמצאו חלקים</div>}
                        </div>
                      </PopoverContent>
                    )}
                  </Popover>

                  {step.parts?.length > 0 && (
                    <div className="space-y-2 mt-2">
                      {step.parts.map(part => (
                        <div key={part.part_sku} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
                          <div className="flex-1">
                            <p className="text-sm font-medium">{part.part_sku}</p>
                            <p className="text-xs text-slate-500">{part.part_name}</p>
                          </div>
                          <Input
                            type="number" min="1"
                            value={part.quantity}
                            onChange={e => updatePartQuantity(index, part.part_sku, parseInt(e.target.value) || 1)}
                            className="w-20"
                          />
                          <Button type="button" variant="ghost" size="icon" onClick={() => removePartFromStep(index, part.part_sku)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))
      )}

      <Button type="button" variant="outline" onClick={addStep} className="w-full">
        <Plus className="h-4 w-4 ml-2" />
        הוסף פעולה
      </Button>
    </div>
  );
}