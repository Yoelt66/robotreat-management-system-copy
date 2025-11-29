import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function UnitForm({ unit, onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    code: unit?.code || '',
    name: unit?.name || '',
    symbol: unit?.symbol || '',
    type: unit?.type || 'quantity',
    is_active: unit?.is_active !== undefined ? unit.is_active : true
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const unitTypes = [
    { value: 'quantity', label: 'כמות' },
    { value: 'weight', label: 'משקל' },
    { value: 'volume', label: 'נפח' },
    { value: 'length', label: 'אורך' },
    { value: 'area', label: 'שטח' },
    { value: 'time', label: 'זמן' }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{unit ? 'עריכת יחידת מידה' : 'יחידת מידה חדשה'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="code">קוד יחידה *</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="pieces, kg, meters..."
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">שם יחידה *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="יחידות, קילוגרם, מטרים..."
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="symbol">סמל יחידה</Label>
              <Input
                id="symbol"
                value={formData.symbol}
                onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
                placeholder="יח', ק״ג, מ'..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">סוג יחידה</Label>
              <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {unitTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="is_active">יחידה פעילה</Label>
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onCancel}>
              ביטול
            </Button>
            <Button type="submit">
              {unit ? 'עדכן יחידה' : 'צור יחידה'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}