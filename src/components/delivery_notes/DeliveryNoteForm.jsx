import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, Plus, Trash2, Search, Package, X, FileText } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from 'date-fns';

export default function DeliveryNoteForm({ parts, warehouses, onSubmit, onCancel, loading }) {
  const [formData, setFormData] = useState({
    note_number: '',
    supplier: '',
    delivery_date: format(new Date(), 'yyyy-MM-dd'),
    warehouse_id: '',
    notes: '',
    items: []
  });
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const sortedWarehouses = useMemo(() => {
    return [...warehouses].sort((a, b) => (a.number || 0) - (b.number || 0));
  }, [warehouses]);

  const searchResults = useMemo(() => {
    if (searchTerm.length < 2) return [];
    const term = searchTerm.toLowerCase();
    const existingSkus = new Set(formData.items.map(i => i.part_sku));
    return parts
      .filter(p => 
        !existingSkus.has(p.sku) &&
        (p.name?.toLowerCase().includes(term) || p.sku?.toLowerCase().includes(term))
      )
      .slice(0, 10);
  }, [searchTerm, parts, formData.items]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAddPart = (part) => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { part_sku: part.sku, part_name: part.name, quantity: 1 }]
    }));
    setSearchTerm('');
  };

  const handleItemQuantityChange = (sku, quantity) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map(item => 
        item.part_sku === sku ? { ...item, quantity: Number(quantity) } : item
      )
    }));
  };

  const removeItem = (sku) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter(item => item.part_sku !== sku)
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!formData.note_number || !formData.supplier || !formData.delivery_date || !formData.warehouse_id) {
      setError('נא למלא את כל שדות התעודה (מספר, ספק, תאריך, ומחסן).');
      return;
    }

    if (formData.items.length === 0) {
      setError('נא להוסיף לפחות פריט אחד לתעודה.');
      return;
    }

    if (formData.items.some(item => !item.quantity || item.quantity <= 0)) {
      setError('נא לוודא שכל הכמויות חיוביות.');
      return;
    }

    const warehouse = warehouses.find(w => w.id === formData.warehouse_id);
    const dataToSubmit = {
      ...formData,
      warehouse_name: warehouse ? `${warehouse.number} - ${warehouse.name}` : '',
      items: formData.items.map(item => ({
        part_sku: item.part_sku,
        part_name: item.part_name,
        quantity: Number(item.quantity)
      }))
    };
    
    onSubmit(dataToSubmit);
  };

  const totalItems = formData.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);

  return (
    <Card className="border-2 border-blue-100 shadow-lg">
      <CardHeader className="bg-gradient-to-l from-blue-50 to-white border-b">
        <CardTitle className="flex items-center gap-2 text-blue-900">
          <FileText className="h-5 w-5" />
          תעודת משלוח חדשה
        </CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-6 pt-6">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {/* Basic Info Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="note_number" className="font-medium">מספר תעודה *</Label>
              <Input 
                id="note_number" 
                name="note_number" 
                value={formData.note_number} 
                onChange={handleChange} 
                placeholder="לדוגמא: 12345"
                className="text-lg"
                required 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier" className="font-medium">ספק *</Label>
              <Input 
                id="supplier" 
                name="supplier" 
                value={formData.supplier} 
                onChange={handleChange} 
                placeholder="שם הספק"
                required 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="delivery_date" className="font-medium">תאריך קבלה *</Label>
              <Input 
                id="delivery_date" 
                name="delivery_date" 
                type="date" 
                value={formData.delivery_date} 
                onChange={handleChange} 
                required 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="warehouse_id" className="font-medium">מחסן יעד *</Label>
              <Select onValueChange={(value) => handleSelectChange('warehouse_id', value)} value={formData.warehouse_id} required>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="בחר מחסן" />
                </SelectTrigger>
                <SelectContent>
                  {sortedWarehouses.map(w => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.number} - {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Items Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-lg font-semibold flex items-center gap-2">
                <Package className="h-5 w-5 text-blue-600" />
                פריטים
                {formData.items.length > 0 && (
                  <Badge variant="secondary" className="mr-2">
                    {formData.items.length} פריטים | {totalItems} יחידות
                  </Badge>
                )}
              </Label>
            </div>

            {/* Search Input */}
            <Popover open={searchResults.length > 0}>
              <PopoverTrigger asChild>
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <Input
                    placeholder="חפש פריט להוספה (שם או מק״ט)..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pr-10 h-12 text-lg"
                  />
                </div>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <ul className="max-h-64 overflow-y-auto">
                  {searchResults.map(part => (
                    <li 
                      key={part.id}
                      onClick={() => handleAddPart(part)}
                      className="p-3 hover:bg-blue-50 cursor-pointer border-b last:border-0 flex justify-between items-center"
                    >
                      <div>
                        <div className="font-medium">{part.name}</div>
                        <div className="text-sm text-gray-500 font-mono">{part.sku}</div>
                      </div>
                      <Plus className="h-5 w-5 text-blue-600" />
                    </li>
                  ))}
                </ul>
              </PopoverContent>
            </Popover>

            {/* Items List */}
            {formData.items.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed">
                <Package className="h-12 w-12 mx-auto text-gray-300 mb-2" />
                <p className="text-gray-500">חפש והוסף פריטים לתעודה</p>
              </div>
            ) : (
              <div className="space-y-2">
                {formData.items.map((item) => (
                  <div 
                    key={item.part_sku} 
                    className="flex items-center gap-3 p-3 bg-white border rounded-lg hover:border-blue-200 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{item.part_name}</div>
                      <div className="text-sm text-gray-500 font-mono">{item.part_sku}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-sm text-gray-500 whitespace-nowrap">כמות:</Label>
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleItemQuantityChange(item.part_sku, e.target.value)}
                        className="w-20 text-center"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeItem(item.part_sku)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes" className="font-medium">הערות</Label>
            <Textarea 
              id="notes" 
              name="notes" 
              value={formData.notes} 
              onChange={handleChange} 
              placeholder="הערות נוספות..."
              rows={2}
            />
          </div>
        </CardContent>
        
        <CardFooter className="flex justify-between gap-3 bg-gray-50 border-t">
          <Button 
            type="button" 
            variant="ghost" 
            onClick={onCancel} 
            disabled={loading}
            className="gap-2"
          >
            <X className="h-4 w-4" />
            ביטול
          </Button>
          <Button 
            type="submit" 
            disabled={loading || formData.items.length === 0}
            size="lg"
            className="gap-2"
          >
            {loading ? (
              "מעדכן..."
            ) : (
              <>
                <Package className="h-4 w-4" />
                שמור ועדכן מלאי
              </>
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}