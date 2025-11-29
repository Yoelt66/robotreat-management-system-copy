import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, Plus, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format } from 'date-fns';

export default function DeliveryNoteForm({ parts, warehouses, onSubmit, onCancel, loading }) {
  const [formData, setFormData] = useState({
    note_number: '',
    supplier: '',
    delivery_date: format(new Date(), 'yyyy-MM-dd'),
    warehouse_id: '',
    notes: '',
    items: [{ part_sku: '', quantity: 1 }]
  });
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index][field] = value;
    setFormData(prev => ({ ...prev, items: newItems }));
  };

  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { part_sku: '', quantity: 1 }]
    }));
  };

  const removeItem = (index) => {
    const newItems = formData.items.filter((_, i) => i !== index);
    setFormData(prev => ({ ...prev, items: newItems }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!formData.note_number || !formData.supplier || !formData.delivery_date || !formData.warehouse_id) {
      setError('נא למלא את כל שדות התעודה (מספר, ספק, תאריך, ומחסן).');
      return;
    }

    if (formData.items.some(item => !item.part_sku || !item.quantity || item.quantity <= 0)) {
      setError('נא למלא את כל פרטי הפריטים ולוודא שהכמות חיובית.');
      return;
    }

    const warehouse = warehouses.find(w => w.id === formData.warehouse_id);
    const dataToSubmit = {
      ...formData,
      warehouse_name: warehouse ? `${warehouse.number} - ${warehouse.name}` : '',
      items: formData.items.map(item => ({
        ...item,
        part_name: parts.find(p => p.sku === item.part_sku)?.name || '',
        quantity: Number(item.quantity)
      }))
    };
    
    onSubmit(dataToSubmit);
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>תעודת משלוח חדשה</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-6 pt-6">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="note_number">מספר תעודה</Label>
              <Input id="note_number" name="note_number" value={formData.note_number} onChange={handleChange} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier">ספק</Label>
              <Input id="supplier" name="supplier" value={formData.supplier} onChange={handleChange} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="delivery_date">תאריך קבלה</Label>
              <Input id="delivery_date" name="delivery_date" type="date" value={formData.delivery_date} onChange={handleChange} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="warehouse_id">מחסן יעד</Label>
              <Select onValueChange={(value) => handleSelectChange('warehouse_id', value)} value={formData.warehouse_id} required>
                <SelectTrigger>
                  <SelectValue placeholder="בחר מחסן" />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map(w => <SelectItem key={w.id} value={w.id}>{w.number} - {w.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-4">
            <Label>פריטים</Label>
            {formData.items.map((item, index) => (
              <div key={index} className="grid grid-cols-1 md:grid-cols-8 gap-4 items-end p-3 border rounded-lg">
                <div className="md:col-span-4 space-y-2">
                  <Label className="text-xs">פריט</Label>
                  <Select value={item.part_sku} onValueChange={(value) => handleItemChange(index, 'part_sku', value)}>
                    <SelectTrigger><SelectValue placeholder="בחר פריט..." /></SelectTrigger>
                    <SelectContent>
                      {parts.map(p => <SelectItem key={p.id} value={p.sku}>{p.name} ({p.sku})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-3 space-y-2">
                  <Label className="text-xs">כמות</Label>
                  <Input type="number" min="1" value={item.quantity} onChange={(e) => handleItemChange(index, 'quantity', e.target.value)} />
                </div>
                <div className="md:col-span-1">
                  <Button type="button" variant="ghost" size="icon" className="text-red-500" onClick={() => removeItem(index)} disabled={formData.items.length <= 1}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addItem}>
              <Plus className="h-4 w-4 ml-2" /> הוסף שורה
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">הערות</Label>
            <Textarea id="notes" name="notes" value={formData.notes} onChange={handleChange} placeholder="הערות נוספות..." />
          </div>
        </CardContent>
        <CardFooter className="flex justify-start gap-2">
          <Button type="submit" disabled={loading}>{loading ? "מעדכן..." : "שמור ועדכן מלאי"}</Button>
          <Button type="button" variant="ghost" onClick={onCancel} disabled={loading}>ביטול</Button>
        </CardFooter>
      </form>
    </Card>
  );
}