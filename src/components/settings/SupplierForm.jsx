import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SupplierForm({ supplier, onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    supplier_number: '',
    name: '',
    contact_person: '',
    phone: '',
    email: '',
    address: '',
    payment_terms: '',
    notes: '',
    is_active: true
  });

  useEffect(() => {
    if (supplier) {
      setFormData(supplier);
    } else {
      // Generate supplier number for new supplier
      const timestamp = Date.now().toString().slice(-6);
      setFormData(prev => ({
        ...prev,
        supplier_number: `SUP-${timestamp}`
      }));
    }
  }, [supplier]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{supplier ? 'עריכת ספק' : 'ספק חדש'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="supplier_number">מספר ספק</Label>
              <Input
                id="supplier_number"
                value={formData.supplier_number}
                onChange={(e) => handleChange('supplier_number', e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">שם הספק</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contact_person">איש קשר</Label>
              <Input
                id="contact_person"
                value={formData.contact_person}
                onChange={(e) => handleChange('contact_person', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">טלפון</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">אימייל</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleChange('email', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">כתובת</Label>
            <Textarea
              id="address"
              value={formData.address}
              onChange={(e) => handleChange('address', e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment_terms">תנאי תשלום</Label>
            <Input
              id="payment_terms"
              value={formData.payment_terms}
              onChange={(e) => handleChange('payment_terms', e.target.value)}
              placeholder="למשל: 30 יום + מע״מ"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">הערות</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) => handleChange('is_active', checked)}
            />
            <Label htmlFor="is_active">ספק פעיל</Label>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="ghost" onClick={onCancel}>
              ביטול
            </Button>
            <Button type="submit">
              {supplier ? 'עדכן' : 'צור'} ספק
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}