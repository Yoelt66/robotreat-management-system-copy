import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ImportFieldMapping from "../import/ImportFieldMapping";
import { toast } from "@/components/ui/use-toast";
import { Warehouse } from "@/entities/Warehouse";
import { Switch } from "@/components/ui/switch";
import { AlertCircle, Loader2 } from "lucide-react";

const generateDefaultMapping = async () => {
  let warehouses = [];
  try {
    warehouses = await Warehouse.list() || [];
  } catch (e) {
    console.error("Could not load warehouses for default mapping", e);
  }

  const defaultFields = [
    { key: 'sku', label: 'מקט', checked: true, is_required: true },
    { key: 'name', label: 'שם פריט', checked: true, is_required: true },
    { key: 'category', label: 'קטגוריה', checked: true, is_required: false },
    { key: 'unit', label: 'יחידת מידה', checked: true, is_required: false },
    { key: 'minimum_stock', label: 'מלאי מינימום', checked: true, is_required: false },
    { key: 'notes', label: 'הערות', checked: true, is_required: false },
    { key: 'cost_price', label: 'מחיר עלות', checked: true, is_required: false },
    { key: 'current_location', label: 'מיקום נוכחי', checked: false, is_required: false },
    { key: 'supplier_part_number', label: 'מקט אצל ספק', checked: false, is_required: false },
    { key: 'replaced_sku', label: 'מקט חלופי', checked: false, is_required: false },
  ];

  const warehouseFields = warehouses.map(w => ({
    key: w.warehouse_id,
    label: `מלאי: ${w.name}`,
    checked: true,
    is_required: false
  }));

  const allFields = [...defaultFields, ...warehouseFields];

  let columnCounter = 1;
  return allFields.map(field => {
    if (field.checked) {
      return { ...field, column: columnCounter++ };
    }
    return { ...field, column: '' };
  });
};

export default function ImportMappingForm({ mappingData, onSave, onCancel }) {
  const [name, setName] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [mapping, setMapping] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeMapping = async () => {
      setLoading(true);
      if (mappingData) {
        setName(mappingData.name || "");
        setIsDefault(mappingData.is_default || false);
        setMapping(Array.isArray(mappingData.mapping) ? mappingData.mapping : await generateDefaultMapping());
      } else {
        const defaultMapping = await generateDefaultMapping();
        setMapping(defaultMapping);
        setName("");
        setIsDefault(false);
      }
      setLoading(false);
    };
    initializeMapping();
  }, [mappingData]);

  const handleSave = () => {
    if (!name.trim()) {
      toast({
        variant: "destructive",
        title: "שם הגדרה חסר",
        description: "יש לספק שם להגדרת המיפוי.",
      });
      return;
    }
    onSave({ name, mapping, is_default: isDefault, id: mappingData?.id });
  };

  const handleResetToDefault = async () => {
    setLoading(true);
    const defaultMapping = await generateDefaultMapping();
    setMapping(defaultMapping);
    setLoading(false);
    toast({ title: "המיפוי אופס לברירת המחדל" });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="ml-2">טוען הגדרות...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="mappingName">שם הגדרת המיפוי</Label>
        <Input
          id="mappingName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="לדוגמה: ייבוא פריטים מספק X"
        />
      </div>

      <div className="flex items-center space-x-2">
        <Switch id="is-default" checked={isDefault} onCheckedChange={setIsDefault} />
        <Label htmlFor="is-default">הגדר כברירת מחדל לייבוא</Label>
      </div>

      <ImportFieldMapping mapping={mapping} onMappingChange={setMapping} />

      <div className="flex justify-between items-center pt-4 border-t">
        <Button variant="outline" onClick={handleResetToDefault}>
          אפס לברירת מחדל
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel}>
            ביטול
          </Button>
          <Button onClick={handleSave}>שמור הגדרה</Button>
        </div>
      </div>
    </div>
  );
}