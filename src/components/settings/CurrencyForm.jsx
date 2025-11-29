
import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function CurrencyForm({ currency, onSubmit, onCancel, disabled = false }) {
  const [formData, setFormData] = React.useState({
    code: currency?.code || '',
    name: currency?.name || '',
    symbol: currency?.symbol || '',
    rate_to_ils: currency?.rate_to_ils || 1,
    last_update: new Date().toISOString().split('T')[0]
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="code">קוד מטבע *</Label>
          <Input
            id="code"
            value={formData.code}
            onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
            placeholder="USD, EUR, GBP..."
            maxLength={3}
            required
            disabled={disabled}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="name">שם המטבע *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="דולר אמריקאי, יורו..."
            required
            disabled={disabled}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="symbol">סמל המטבע *</Label>
          <Input
            id="symbol"
            value={formData.symbol}
            onChange={(e) => setFormData(prev => ({ ...prev, symbol: e.target.value }))}
            placeholder="$, €, £..."
            required
            disabled={disabled}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="rate_to_ils">שער חליפין לשקל *</Label>
          <Input
            id="rate_to_ils"
            type="number"
            step="0.0001"
            min="0.0001"
            value={formData.rate_to_ils}
            onChange={(e) => setFormData(prev => ({ ...prev, rate_to_ils: parseFloat(e.target.value) }))}
            placeholder="3.6"
            required
            disabled={disabled}
          />
          <p className="text-sm text-gray-500">כמה שקלים שווה יחידה אחת של המטבע</p>
          {currency && (
            <p className="text-sm text-orange-600">
              שינוי שער החליפין יעדכן אוטומטי את מחירי המכירה של כל הפריטים הרלוונטיים
            </p>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel} disabled={disabled}>
          ביטול
        </Button>
        <Button type="submit" disabled={disabled}>
          {disabled ? 'מעדכן...' : (currency ? 'עדכן מטבע' : 'צור מטבע')}
        </Button>
      </div>
    </form>
  );
}
