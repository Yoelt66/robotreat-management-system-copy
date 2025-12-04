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
    const newStep = {
      step_number: steps.length + 1,
      name: "",
      description: "",
      parts: [],
    };
    onChange([...steps, newStep]);
  };

  const removeStep = (index) => {
    const newSteps = steps.filter((_, i) => i !== index).map((step, i) => ({
      ...step,
      step_number: i + 1,
    }));
    onChange(newSteps);
  };

  const moveStep = (index, direction) => {
    const newSteps = [...steps];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newSteps.length) return;
    
    [newSteps[index], newSteps[targetIndex]] = [newSteps[targetIndex], newSteps[index]];
    newSteps.forEach((s, i) => { s.step_number = i + 1; });
    onChange(newSteps);
  };

  const updateStep = (index, field, value) => {
    const newSteps = [...steps];
    newSteps[index] = { ...newSteps[index], [field]: value };
    onChange(newSteps);
  };

  const addPartToStep = (stepIndex, part) => {
    const newSteps = [...steps];
    const currentParts = newSteps[stepIndex].parts || [];
    
    const existingPart = currentParts.find((p) => p.part_sku === part.sku);
    if (existingPart) {
      existingPart.quantity = (existingPart.quantity || 1) + 1;
    } else {
      currentParts.push({
        part_sku: part.sku,
        part_name: part.name,
        quantity: 1,
      });
    }
    
    newSteps[stepIndex].parts = currentParts;
    onChange(newSteps);
    setSearchTerm("");
    setActiveStepIndex(null);
  };

  const removePartFromStep = (stepIndex, partSku) => {
    const newSteps = [...steps];
    newSteps[stepIndex].parts = newSteps[stepIndex].parts.filter((p) => p.part_sku !== partSku);
    onChange(newSteps);
  };

  const updatePartQuantity = (stepIndex, partSku, quantity) => {
    const newSteps = [...steps];
    const part = newSteps[stepIndex].parts.find((p) => p.part_sku === partSku);
    if (part) {
      part.quantity = quantity;
    }
    onChange(newSteps);
  };

  const filteredParts = parts.filter(
    (p) =>
      p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {steps.length === 0 ? (
        <div className="text-center py-8 text-slate-500 border-2 border-dashed rounded-lg">
          לא הוגדרו שלבים
        </div>
      ) : (
        steps.map((step, index) => (
          <Card key={index}>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-4">
                <GripVertical className="h-5 w-5 text-slate-400" />
                <span className="font-semibold">שלב {step.step_number}</span>
                <div className="mr-auto flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={index === 0}
                    onClick={() => moveStep(index, "up")}
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={index === steps.length - 1}
                    onClick={() => moveStep(index, "down")}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-red-500 hover:text-red-600"
                    onClick={() => removeStep(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>שם השלב</Label>
                  <Input
                    value={step.name}
                    onChange={(e) => updateStep(index, "name", e.target.value)}
                    placeholder="לדוגמה: בדיקת לחץ"
                  />
                </div>

                <div className="space-y-2">
                  <Label>תיאור</Label>
                  <Textarea
                    value={step.description}
                    onChange={(e) => updateStep(index, "description", e.target.value)}
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label>חלקים נדרשים</Label>
                  
                  <Popover open={activeStepIndex === index}>
                    <PopoverTrigger asChild>
                      <div className="relative">
                        <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
                        <Input
                          placeholder="חפש חלק להוספה..."
                          value={activeStepIndex === index ? searchTerm : ""}
                          onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setActiveStepIndex(index);
                          }}
                          onFocus={() => setActiveStepIndex(index)}
                          className="pr-9"
                        />
                      </div>
                    </PopoverTrigger>
                    {searchTerm.length >= 2 && activeStepIndex === index && (
                      <PopoverContent className="w-80 p-0" align="start">
                        <div className="max-h-60 overflow-y-auto">
                          {filteredParts.slice(0, 10).map((part) => (
                            <div
                              key={part.id}
                              className="p-2 hover:bg-slate-100 cursor-pointer border-b last:border-b-0"
                              onClick={() => addPartToStep(index, part)}
                            >
                              <p className="font-medium">{part.sku}</p>
                              <p className="text-sm text-slate-500">{part.name}</p>
                            </div>
                          ))}
                          {filteredParts.length === 0 && (
                            <div className="p-4 text-center text-slate-500">לא נמצאו חלקים</div>
                          )}
                        </div>
                      </PopoverContent>
                    )}
                  </Popover>

                  {step.parts?.length > 0 && (
                    <div className="space-y-2 mt-2">
                      {step.parts.map((part) => (
                        <div
                          key={part.part_sku}
                          className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg"
                        >
                          <div className="flex-1">
                            <p className="text-sm font-medium">{part.part_sku}</p>
                            <p className="text-xs text-slate-500">{part.part_name}</p>
                          </div>
                          <Input
                            type="number"
                            min="1"
                            value={part.quantity}
                            onChange={(e) =>
                              updatePartQuantity(index, part.part_sku, parseInt(e.target.value) || 1)
                            }
                            className="w-20"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removePartFromStep(index, part.part_sku)}
                          >
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
        הוסף שלב
      </Button>
    </div>
  );
}