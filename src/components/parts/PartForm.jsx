import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Currency } from "@/entities/Currency";

export default function PartForm({ part, categories, suppliers, currencies, units, warehouses, onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    category: '',
    minimum_stock: 0,
    unit: '',
    notes: '',
    replaced_sku: '',
    current_location: '',
    supplier_part_number: '',
    supplier_number: '',
    requires_serial_number: false, // Added new field
    cost_price: 0,
    cost_currency: 'ILS',
    sale_currency: 'ILS',
    import_percentage: 0,
    markup_percentage: 0,
    manual_sale_price: 0,
    is_manual: false
  });

  const [errors, setErrors] = useState({});
  const [availableCurrencies, setAvailableCurrencies] = useState([]);
  const [calculatedSalePrice, setCalculatedSalePrice] = useState(0);
  const [exchangeRate, setExchangeRate] = useState(1);

  useEffect(() => {
    // Use currencies from props if available, otherwise load them
    if (currencies && currencies.length > 0) {
      setAvailableCurrencies(currencies);
    } else {
      loadCurrencies();
    }
  }, [currencies]);

  useEffect(() => {
    if (part) {
      setFormData({
        sku: part.sku || '',
        name: part.name || '',
        category: part.category || '',
        minimum_stock: part.minimum_stock || 0,
        unit: part.unit || '',
        notes: part.notes || '',
        replaced_sku: part.replaced_sku || '',
        current_location: part.current_location || '',
        supplier_part_number: part.supplier_part_number || '',
        supplier_number: part.supplier_number || '',
        requires_serial_number: part.requires_serial_number || false,
        cost_price: part.cost_price || 0,
        cost_currency: part.cost_currency && part.cost_currency !== '' ? part.cost_currency : 'ILS',
        sale_currency: part.sale_currency && part.sale_currency !== '' ? part.sale_currency : 'ILS',
        import_percentage: part.import_percentage !== undefined && part.import_percentage !== null ? part.import_percentage : 15,
        markup_percentage: part.markup_percentage !== undefined && part.markup_percentage !== null ? part.markup_percentage : 30,
        manual_sale_price: part.manual_sale_price || 0,
        is_manual: part.is_manual || false
      });
    }
  }, [part]);

  useEffect(() => {
    updateExchangeRateAndCalculatePrice();
  }, [formData.cost_currency, formData.sale_currency, formData.cost_price, formData.import_percentage, formData.markup_percentage, availableCurrencies]);

  const loadCurrencies = async () => {
    try {
      const currencyData = await Currency.list();
      setAvailableCurrencies(currencyData);
    } catch (error) {
      console.error("Error loading currencies:", error);
    }
  };

  const updateExchangeRateAndCalculatePrice = async () => { // Renamed function
    if (!availableCurrencies.length) return;
    
    let newExchangeRate = 1;
    
    if (formData.cost_currency !== formData.sale_currency) {
      const costCurrency = availableCurrencies.find(c => c.code === formData.cost_currency);
      const saleCurrency = availableCurrencies.find(c => c.code === formData.sale_currency);
      
      if (costCurrency && saleCurrency) {
        newExchangeRate = costCurrency.rate_to_ils / saleCurrency.rate_to_ils;
      }
    }
    
    setExchangeRate(newExchangeRate);
    
    // Calculate sale price for display only
    const costPrice = parseFloat(formData.cost_price) || 0;
    const importPercentage = parseFloat(formData.import_percentage) || 0;
    const markupPercentage = parseFloat(formData.markup_percentage) || 0;
    
    const costWithImport = costPrice * (1 + importPercentage / 100);
    const costWithMarkup = costWithImport * (1 + markupPercentage / 100);
    const finalSalePrice = costWithMarkup * newExchangeRate;
    
    setCalculatedSalePrice(Math.round(finalSalePrice * 100) / 100);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    let finalValue = type === 'checkbox' ? checked : value;
    
    // Convert empty strings to 0 for percentage fields
    if ((name === 'import_percentage' || name === 'markup_percentage') && value === '') {
      finalValue = 0;
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: finalValue
    }));
    
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSelectChange = (name, value) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validate = () => {
    const newErrors = {};
    
    if (!formData.sku.trim()) newErrors.sku = 'מספר קטלוגי נדרש';
    if (!formData.name.trim()) newErrors.name = 'שם הפריט נדרש';
    if (!formData.category) newErrors.category = 'קטגוריה נדרשת';
    if (!formData.unit) newErrors.unit = 'יחידת מידה נדרשת';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validate()) {
      // Don't include calculated fields in the submitted data, formData already holds the relevant fields.
      onSubmit(formData);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>פרטי פריט בסיסיים</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sku">מספר קטלוגי *</Label>
              <Input
                id="sku"
                name="sku"
                value={formData.sku}
                onChange={handleChange}
                disabled={!!part}
                className={errors.sku ? 'border-red-500' : ''}
              />
              {errors.sku && <p className="text-red-500 text-sm">{errors.sku}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">שם הפריט *</Label>
              <Input
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className={errors.name ? 'border-red-500' : ''}
              />
              {errors.name && <p className="text-red-500 text-sm">{errors.name}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">קטגוריה *</Label>
              <Select value={formData.category} onValueChange={(value) => handleSelectChange('category', value)}>
                <SelectTrigger className={errors.category ? 'border-red-500' : ''}>
                  <SelectValue placeholder="בחר קטגוריה" />
                </SelectTrigger>
                <SelectContent>
                  {(categories || []).map((category) => (
                    <SelectItem key={category.code} value={category.code}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.category && <p className="text-red-500 text-sm">{errors.category}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="unit">יחידת מידה *</Label>
              <Select value={formData.unit} onValueChange={(value) => handleSelectChange('unit', value)}>
                <SelectTrigger className={errors.unit ? 'border-red-500' : ''}>
                  <SelectValue placeholder="בחר יחידת מידה" />
                </SelectTrigger>
                <SelectContent>
                  {(units || []).map((unit) => (
                    <SelectItem key={unit.code} value={unit.code}>
                      {unit.name} ({unit.symbol})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.unit && <p className="text-red-500 text-sm">{errors.unit}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="minimum_stock">מלאי מינימלי</Label>
              <Input
                id="minimum_stock"
                name="minimum_stock"
                type="number"
                value={formData.minimum_stock}
                onChange={handleChange}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="current_location">מיקום במחסן</Label>
              <Input
                id="current_location"
                name="current_location"
                value={formData.current_location}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="flex items-center space-x-2 space-x-reverse">
            <Switch
              id="requires_serial_number"
              checked={formData.requires_serial_number}
              onCheckedChange={(checked) => handleSelectChange('requires_serial_number', checked)} // Use handleSelectChange for consistency with other boolean changes, or a dedicated handler.
            />
            <Label htmlFor="requires_serial_number">דורש מספר סידורי חובה</Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">הערות</Label>
            <Textarea
              id="notes"
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>פרטי ספק</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="supplier_number">מספר ספק</Label>
              <Select value={formData.supplier_number} onValueChange={(value) => handleSelectChange('supplier_number', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="בחר ספק" />
                </SelectTrigger>
                <SelectContent>
                  {(suppliers || []).map((supplier) => (
                    <SelectItem key={supplier.supplier_number} value={supplier.supplier_number}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="supplier_part_number">מספר פריט אצל הספק</Label>
              <Input
                id="supplier_part_number"
                name="supplier_part_number"
                value={formData.supplier_part_number}
                onChange={handleChange}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="replaced_sku">פריט מוחלף (מק״ט)</Label>
              <Input
                id="replaced_sku"
                name="replaced_sku"
                value={formData.replaced_sku}
                onChange={handleChange}
                placeholder="מק״ט של פריט שהוחלף"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>מחירים</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cost_price">מחיר עלות</Label>
              <Input
                id="cost_price"
                name="cost_price"
                type="number"
                step="0.01"
                value={formData.cost_price}
                onChange={handleChange}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cost_currency">מטבע עלות</Label>
              {availableCurrencies.length > 0 ? (
                <Select value={formData.cost_currency} onValueChange={(value) => handleSelectChange('cost_currency', value)}>
                  <SelectTrigger>
                    <SelectValue>
                      {availableCurrencies.find(c => c.code === formData.cost_currency)?.name || formData.cost_currency}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {availableCurrencies.map((currency) => (
                      <SelectItem key={currency.code} value={currency.code}>
                        {currency.name} ({currency.symbol})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="p-2 bg-gray-100 rounded border">{formData.cost_currency || 'טוען...'}</div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="import_percentage">אחוז ייבוא (%)</Label>
              <Input
                id="import_percentage"
                name="import_percentage"
                type="number"
                step="0.1"
                value={formData.import_percentage}
                onChange={handleChange}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="markup_percentage">אחוז רווח (%)</Label>
              <Input
                id="markup_percentage"
                name="markup_percentage"
                type="number"
                step="0.1"
                value={formData.markup_percentage}
                onChange={handleChange}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sale_currency">מטבע מכירה</Label>
              {availableCurrencies.length > 0 ? (
                <Select value={formData.sale_currency} onValueChange={(value) => handleSelectChange('sale_currency', value)}>
                  <SelectTrigger>
                    <SelectValue>
                      {availableCurrencies.find(c => c.code === formData.sale_currency)?.name || formData.sale_currency}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {availableCurrencies.map((currency) => (
                      <SelectItem key={currency.code} value={currency.code}>
                        {currency.name} ({currency.symbol})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="p-2 bg-gray-100 rounded border">{formData.sale_currency || 'טוען...'}</div>
              )}
            </div>
          </div>

          {/* Display calculated values */}
          <div className="border-t pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>שער חליפין נוכחי</Label>
                <div className="p-2 bg-gray-100 rounded border">
                  {exchangeRate.toFixed(4)}
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>מחיר מכירה מחושב</Label>
                <div className="p-2 bg-blue-50 rounded border font-semibold">
                  {calculatedSalePrice.toFixed(2)} {formData.sale_currency}
                </div>
              </div>
            </div>
          </div>

          {/* Manual price override */}
          <div className="border-t pt-4">
            <div className="flex items-center space-x-2 mb-4">
              <Switch
                id="is_manual"
                checked={formData.is_manual}
                onCheckedChange={(checked) => handleSelectChange('is_manual', checked)}
              />
              <Label htmlFor="is_manual">השתמש במחיר מכירה ידני</Label>
            </div>
            
            {formData.is_manual && (
              <div className="space-y-2">
                <Label htmlFor="manual_sale_price">מחיר מכירה ידני</Label>
                <Input
                  id="manual_sale_price"
                  name="manual_sale_price"
                  type="number"
                  step="0.01"
                  value={formData.manual_sale_price}
                  onChange={handleChange}
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          ביטול
        </Button>
        <Button type="submit">
          {part ? 'עדכן פריט' : 'צור פריט'}
        </Button>
      </div>
    </form>
  );
}