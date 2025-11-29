
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "@/components/ui/use-toast";

export default function MaintenanceStepForm({ step, parts, deviceType, onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    description: '',
    safety_note: '',
    parts_required: [],
    device_type: deviceType,
    ...step
  });
  const [partSearchTerm, setPartSearchTerm] = useState('');

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAddPartToStep = (part) => {
    const existingPart = formData.parts_required.find(p => p.part_sku === part.sku);
    if (!existingPart) {
      handleInputChange('parts_required', [...formData.parts_required, {
        part_sku: part.sku,
        part_name: part.name,
        quantity: 1
      }]);
    }
    setPartSearchTerm('');
  };
  
  const handleUpdatePartQuantity = (partSku, quantity) => {
    handleInputChange('parts_required', formData.parts_required.map(part =>
      part.part_sku === partSku ? { ...part, quantity: parseInt(quantity) || 1 } : part
    ));
  };
  
  const handleRemovePartFromStep = (partSku) => {
    handleInputChange('parts_required', formData.parts_required.filter(part => part.part_sku !== partSku));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.description.trim()) {
      toast({ variant: 'destructive', title: 'יש למלא תיאור שלב' });
      return;
    }
    onSubmit(formData);
  };
  
  const filteredParts = parts.filter(part =>
    part.name?.toLowerCase().includes(partSearchTerm.toLowerCase()) ||
    part.sku?.toLowerCase().includes(partSearchTerm.toLowerCase())
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="description">תיאור השלב *</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => handleInputChange('description', e.target.value)}
          placeholder="תאר את פעולת התחזוקה..."
          required
        />
      </div>
      <div>
        <Label htmlFor="safety_note">הערות</Label>
        <Textarea
          id="safety_note"
          value={formData.safety_note}
          onChange={(e) => setFormData({...formData, safety_note: e.target.value})}
          placeholder="הערות נוספות לביצוע השלב..."
          rows={3}
        />
      </div>

      <div>
        <Label>חלקים נדרשים</Label>
        <div className="flex gap-2 my-2">
          <Popover>
            <PopoverTrigger asChild>
              <div className="relative flex-1">
                <Search className="absolute right-3 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="חפש חלק להוספה..."
                  value={partSearchTerm}
                  onChange={(e) => setPartSearchTerm(e.target.value)}
                  className="pr-9"
                />
              </div>
            </PopoverTrigger>
            {partSearchTerm.length > 0 && (
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                {filteredParts.length > 0 ? (
                  <ul className="max-h-60 overflow-y-auto">
                    {filteredParts.slice(0, 10).map(part => (
                      <li key={part.id} className="p-3 hover:bg-gray-100 cursor-pointer" onClick={() => handleAddPartToStep(part)}>
                        <p className="font-medium">{part.name}</p>
                        <p className="text-sm text-gray-500 font-mono">{part.sku}</p>
                      </li>
                    ))}
                  </ul>
                ) : <div className="p-4 text-center text-sm text-gray-500">לא נמצאו חלקים</div>}
              </PopoverContent>
            )}
          </Popover>
        </div>
        {formData.parts_required.length > 0 && (
          <div className="border rounded-md overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>חלק</TableHead>
                  <TableHead className="w-24">כמות</TableHead>
                  <TableHead className="w-16 text-center">הסר</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {formData.parts_required.map((part) => (
                  <TableRow key={part.part_sku}>
                    <TableCell>
                      <div>{part.part_name}</div>
                      <div className="text-xs text-gray-500 font-mono">{part.part_sku}</div>
                    </TableCell>
                    <TableCell>
                      <Input type="number" min="1" value={part.quantity} onChange={(e) => handleUpdatePartQuantity(part.part_sku, e.target.value)} />
                    </TableCell>
                    <TableCell className="text-center">
                      <Button type="button" variant="ghost" size="icon" onClick={() => handleRemovePartFromStep(part.part_sku)} className="text-red-500 hover:text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>ביטול</Button>
        <Button type="submit">{step ? 'עדכן שלב' : 'צור שלב'}</Button>
      </div>
    </form>
  );
}
