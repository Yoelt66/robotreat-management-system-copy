import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, GripVertical, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export default function VisitSequenceEditor({ sequence, onChange, maintenanceTypes, parts }) {
  const [searchTerm, setSearchTerm] = useState("");

  const addStep = () => {
    const newStep = {
      step_number: sequence.length + 1,
      maintenance_type_id: "",
      custom_parts: [],
      use_custom_parts: false,
    };
    onChange([...sequence, newStep]);
  };

  const removeStep = (index) => {
    const newSequence = sequence.filter((_, i) => i !== index).map((step, i) => ({
      ...step,
      step_number: i + 1,
    }));
    onChange(newSequence);
  };

  const updateStep = (index, field, value) => {
    const newSequence = [...sequence];
    newSequence[index] = { ...newSequence[index], [field]: value };
    onChange(newSequence);
  };

  const addPartToStep = (stepIndex, part) => {
    const newSequence = [...sequence];
    const currentParts = newSequence[stepIndex].custom_parts || [];
    
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
    
    newSequence[stepIndex].custom_parts = currentParts;
    onChange(newSequence);
    setSearchTerm("");
  };

  const removePartFromStep = (stepIndex, partSku) => {
    const newSequence = [...sequence];
    newSequence[stepIndex].custom_parts = newSequence[stepIndex].custom_parts.filter(
      (p) => p.part_sku !== partSku
    );
    onChange(newSequence);
  };

  const updatePartQuantity = (stepIndex, partSku, quantity) => {
    const newSequence = [...sequence];
    const part = newSequence[stepIndex].custom_parts.find((p) => p.part_sku === partSku);
    if (part) {
      part.quantity = quantity;
    }
    onChange(newSequence);
  };

  const filteredParts = parts.filter(
    (p) =>
      p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {sequence.length === 0 ? (
        <div className="text-center py-8 text-slate-500 border-2 border-dashed rounded-lg">
          לא הוגדר רצף ביקורים
        </div>
      ) : (
        sequence.map((step, index) => (
          <Card key={index} className="relative">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-4">
                <GripVertical className="h-5 w-5 text-slate-400" />
                <span className="font-semibold">שלב {step.step_number}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="mr-auto text-red-500 hover:text-red-600"
                  onClick={() => removeStep(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>סוג תחזוקה</Label>
                  <Select
                    value={step.maintenance_type_id}
                    onValueChange={(value) => updateStep(index, "maintenance_type_id", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="בחר סוג תחזוקה" />
                    </SelectTrigger>
                    <SelectContent>
                      {maintenanceTypes.map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={step.use_custom_parts}
                    onCheckedChange={(checked) => updateStep(index, "use_custom_parts", checked)}
                  />
                  <Label>השתמש בחלקים מותאמים אישית</Label>
                </div>

                {step.use_custom_parts && (
                  <div className="space-y-2 border-t pt-4">
                    <Label>חלקים</Label>
                    
                    <Popover>
                      <PopoverTrigger asChild>
                        <div className="relative">
                          <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
                          <Input
                            placeholder="חפש חלק להוספה..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pr-9"
                          />
                        </div>
                      </PopoverTrigger>
                      {searchTerm.length >= 2 && (
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

                    {step.custom_parts?.length > 0 && (
                      <div className="space-y-2 mt-2">
                        {step.custom_parts.map((part) => (
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
                )}
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