
import React, { useState } from 'react';
import { Card, CardHeader, CardContent, CardFooter, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { XCircle, CheckCircle } from "lucide-react";

export default function DeviceForm({ device, onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    name: device.name || '',
    type: device.type || 'other',
    serial_number: device.serial_number || '',
    location: device.location || '',
  });

  const handleChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{device.id ? 'עריכת מערכת' : 'מערכת חדשה'}</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="name">
              שם המערכת
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="הזן שם מערכת"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">
              סוג מערכת
            </Label>
            <Select
              value={formData.type}
              onValueChange={(value) => handleChange('type', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="בחר סוג מערכת" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Astronaut_A3">Astronaut A3</SelectItem>
                <SelectItem value="Astronaut_A3N">Astronaut A3N</SelectItem>
                <SelectItem value="Astronaut_A4">Astronaut A4</SelectItem>
                <SelectItem value="Delaval_2008">Delaval 2008</SelectItem>
                <SelectItem value="Delaval_2011">Delaval 2011</SelectItem>
                <SelectItem value="Milk_tank">מיכל חלב</SelectItem>
                <SelectItem value="CRS">CRS+</SelectItem>
                <SelectItem value="Juno_100">Juno 100</SelectItem>
                <SelectItem value="Juno_150">Juno 150</SelectItem>
                <SelectItem value="Luna">Luna</SelectItem>
                <SelectItem value="other">מערכת אחרת</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="serial_number">
              מספר סידורי
            </Label>
            <Input
              id="serial_number"
              value={formData.serial_number}
              onChange={(e) => handleChange('serial_number', e.target.value)}
              placeholder="הזן מספר סידורי"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">
              מיקום
            </Label>
            <Input
              id="location"
              value={formData.location}
              onChange={(e) => handleChange('location', e.target.value)}
              placeholder="הזן מיקום המערכת"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
          >
            ביטול
          </Button>
          <Button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700"
          >
            {device.id ? 'עדכן מערכת' : 'הוסף מערכת'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
