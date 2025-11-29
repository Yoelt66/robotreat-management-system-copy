import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Plus, ArrowRight } from "lucide-react";

export default function ReferenceDataDialog({ open, referenceIssues, existingData, onResolve, onCancel }) {
  const [resolutions, setResolutions] = useState({});
  const [newEntities, setNewEntities] = useState({});

  useEffect(() => {
    if (referenceIssues && open) {
      const initialResolutions = {};
      const initialNewEntities = {};

      Object.entries(referenceIssues).forEach(([type, issues]) => {
        initialResolutions[type] = {};
        initialNewEntities[type] = {};
        
        issues.forEach(issue => {
          initialResolutions[type][issue.value] = { action: 'create', convertTo: '' };
          
          // Set default values for new entities based on type
          if (type === 'categories') {
            initialNewEntities[type][issue.value] = {
              code: issue.value.toLowerCase().replace(/\s+/g, '_'),
              name: issue.value,
              color: getRandomColor()
            };
          } else if (type === 'suppliers') {
            initialNewEntities[type][issue.value] = {
              supplier_number: issue.value,
              name: issue.value,
              is_active: true
            };
          } else if (type === 'currencies') {
            initialNewEntities[type][issue.value] = {
              code: issue.value.toUpperCase(),
              name: issue.value,
              symbol: issue.value,
              rate_to_ils: 1
            };
          } else if (type === 'units') {
            initialNewEntities[type][issue.value] = {
              code: issue.value.toLowerCase(),
              name: issue.value,
              symbol: issue.value,
              type: 'quantity'
            };
          } else if (type === 'warehouses') {
            initialNewEntities[type][issue.value] = {
              name: issue.value,
              location: '',
              contact: ''
            };
          }
        });
      });

      setResolutions(initialResolutions);
      setNewEntities(initialNewEntities);
    }
  }, [referenceIssues, open]);

  const getRandomColor = () => {
    const colors = ['#EF4444', '#F97316', '#F59E0B', '#EAB308', '#84CC16', '#22C55E', '#10B981', '#14B8A6', '#06B6D4', '#0EA5E9', '#3B82F6', '#6366F1', '#8B5CF6', '#A855F7', '#D946EF', '#EC4899'];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  const handleResolutionChange = (type, originalValue, action, convertTo = '') => {
    setResolutions(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        [originalValue]: { action, convertTo }
      }
    }));
  };

  const handleNewEntityChange = (type, originalValue, field, value) => {
    setNewEntities(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        [originalValue]: {
          ...prev[type][originalValue],
          [field]: value
        }
      }
    }));
  };

  const getExistingOptions = (type) => {
    switch (type) {
      case 'categories':
        return existingData.categories?.map(c => ({ value: c.code, label: `${c.name} (${c.code})` })) || [];
      case 'suppliers':
        return existingData.suppliers?.map(s => ({ value: s.supplier_number, label: `${s.name} (${s.supplier_number})` })) || [];
      case 'currencies':
        return existingData.currencies?.map(c => ({ value: c.code, label: `${c.name} (${c.code})` })) || [];
      case 'units':
        return existingData.units?.map(u => ({ value: u.code, label: `${u.name} (${u.code})` })) || [];
      case 'warehouses':
        return existingData.warehouses?.map(w => ({ value: w.name, label: w.name })) || [];
      default:
        return [];
    }
  };

  const getTypeLabel = (type) => {
    const labels = {
      categories: 'קטגוריות',
      suppliers: 'ספקים', 
      currencies: 'מטבעות',
      units: 'יחידות מידה',
      warehouses: 'מחסנים'
    };
    return labels[type] || type;
  };

  const handleSubmit = () => {
    onResolve({ resolutions, newEntities });
  };

  if (!open || !referenceIssues) return null;

  const hasIssues = Object.values(referenceIssues).some(arr => arr.length > 0);
  if (!hasIssues) return null;

  return (
    <Dialog open={open} onOpenChange={onCancel}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            פתרון בעיות נתוני יחוס
          </DialogTitle>
          <DialogDescription>
            נמצאו ערכים בקובץ הייבוא שאינם קיימים במערכת. אנא החלט כיצד לטפל בכל ערך.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue={Object.keys(referenceIssues).find(type => referenceIssues[type].length > 0)} className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            {Object.entries(referenceIssues).map(([type, issues]) => (
              <TabsTrigger key={type} value={type} className="relative">
                {getTypeLabel(type)}
                {issues.length > 0 && (
                  <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 text-xs">
                    {issues.length}
                  </Badge>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {Object.entries(referenceIssues).map(([type, issues]) => (
            <TabsContent key={type} value={type} className="space-y-4">
              {issues.length === 0 ? (
                <div className="text-center py-8 text-green-600">
                  ✓ אין בעיות ב{getTypeLabel(type)}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-sm text-gray-600">
                    נמצאו {issues.length} ערכים לא מוכרים ב{getTypeLabel(type)}
                  </div>
                  
                  {issues.map((issue, index) => (
                    <Card key={`${issue.value}-${index}`}>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center justify-between">
                          <span>"{issue.value}" (מופיע {issue.count} פעמים)</span>
                          <Select
                            value={resolutions[type]?.[issue.value]?.action || 'create'}
                            onValueChange={(action) => handleResolutionChange(type, issue.value, action)}
                          >
                            <SelectTrigger className="w-48">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="create">
                                <div className="flex items-center gap-2">
                                  <Plus className="h-4 w-4" />
                                  צור חדש
                                </div>
                              </SelectItem>
                              <SelectItem value="convert">
                                <div className="flex items-center gap-2">
                                  <ArrowRight className="h-4 w-4" />
                                  המר לקיים
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {resolutions[type]?.[issue.value]?.action === 'convert' ? (
                          <div className="space-y-2">
                            <Label>המר לערך קיים:</Label>
                            <Select
                              value={resolutions[type]?.[issue.value]?.convertTo || ''}
                              onValueChange={(value) => handleResolutionChange(type, issue.value, 'convert', value)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="בחר ערך קיים" />
                              </SelectTrigger>
                              <SelectContent>
                                {getExistingOptions(type).map(option => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div className="text-sm font-medium">פרטי הערך החדש:</div>
                            {type === 'categories' && (
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label>קוד קטגוריה</Label>
                                  <Input
                                    value={newEntities[type]?.[issue.value]?.code || ''}
                                    onChange={(e) => handleNewEntityChange(type, issue.value, 'code', e.target.value)}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>שם קטגוריה</Label>
                                  <Input
                                    value={newEntities[type]?.[issue.value]?.name || ''}
                                    onChange={(e) => handleNewEntityChange(type, issue.value, 'name', e.target.value)}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>צבע</Label>
                                  <div className="flex gap-2">
                                    <Input
                                      type="color"
                                      value={newEntities[type]?.[issue.value]?.color || '#3B82F6'}
                                      onChange={(e) => handleNewEntityChange(type, issue.value, 'color', e.target.value)}
                                      className="w-16 h-10"
                                    />
                                    <Input
                                      value={newEntities[type]?.[issue.value]?.color || '#3B82F6'}
                                      onChange={(e) => handleNewEntityChange(type, issue.value, 'color', e.target.value)}
                                      className="flex-1"
                                    />
                                  </div>
                                </div>
                              </div>
                            )}
                            {type === 'suppliers' && (
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label>מספר ספק</Label>
                                  <Input
                                    value={newEntities[type]?.[issue.value]?.supplier_number || ''}
                                    onChange={(e) => handleNewEntityChange(type, issue.value, 'supplier_number', e.target.value)}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>שם ספק</Label>
                                  <Input
                                    value={newEntities[type]?.[issue.value]?.name || ''}
                                    onChange={(e) => handleNewEntityChange(type, issue.value, 'name', e.target.value)}
                                  />
                                </div>
                              </div>
                            )}
                            {type === 'units' && (
                              <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-2">
                                  <Label>קוד יחידה</Label>
                                  <Input
                                    value={newEntities[type]?.[issue.value]?.code || ''}
                                    onChange={(e) => handleNewEntityChange(type, issue.value, 'code', e.target.value)}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>שם יחידה</Label>
                                  <Input
                                    value={newEntities[type]?.[issue.value]?.name || ''}
                                    onChange={(e) => handleNewEntityChange(type, issue.value, 'name', e.target.value)}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>סמל</Label>
                                  <Input
                                    value={newEntities[type]?.[issue.value]?.symbol || ''}
                                    onChange={(e) => handleNewEntityChange(type, issue.value, 'symbol', e.target.value)}
                                  />
                                </div>
                              </div>
                            )}
                            {type === 'currencies' && (
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label>קוד מטבע</Label>
                                  <Input
                                    value={newEntities[type]?.[issue.value]?.code || ''}
                                    onChange={(e) => handleNewEntityChange(type, issue.value, 'code', e.target.value)}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>שם מטבע</Label>
                                  <Input
                                    value={newEntities[type]?.[issue.value]?.name || ''}
                                    onChange={(e) => handleNewEntityChange(type, issue.value, 'name', e.target.value)}
                                  />
                                </div>
                              </div>
                            )}
                            {type === 'warehouses' && (
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label>שם מחסן</Label>
                                  <Input
                                    value={newEntities[type]?.[issue.value]?.name || ''}
                                    onChange={(e) => handleNewEntityChange(type, issue.value, 'name', e.target.value)}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>מיקום</Label>
                                  <Input
                                    value={newEntities[type]?.[issue.value]?.location || ''}
                                    onChange={(e) => handleNewEntityChange(type, issue.value, 'location', e.target.value)}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            ביטול ייבוא
          </Button>
          <Button onClick={handleSubmit}>
            המשך עם הפתרונות
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}