import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Warehouse } from "@/entities/Warehouse";
import { toast } from "@/components/ui/use-toast";

const mainPages = [
    { value: 'Dashboard', label: 'דשבורד ראשי' },
    { value: 'StockDashboard', label: 'דשבורד מלאי' },
    { value: 'FieldDashboard', label: 'דשבורד שטח' },
    { value: 'ServiceCalls', label: 'קריאות שירות' },
    { value: 'ItemsManagement', label: 'ניהול פריטים' },
    { value: 'Orders', label: 'הזמנות' },
];

const pageFilters = {
    FieldDashboard: [
        { value: 'all', label: 'הכל' },
        { value: 'pending', label: 'טיוטה' },
        { value: 'assigned', label: 'סגור' },
        { value: 'in_progress', label: 'אושר' },
        { value: 'completed', label: 'הוקלדו' },
        { value: 'final', label: 'סופי' },
        { value: 'cancelled', label: 'מבוטל' },
    ],
    ServiceCalls: [
        { value: 'all', label: 'הכל' },
        { value: 'pending', label: 'טיוטה' },
        { value: 'assigned', label: 'סגור' },
        { value: 'in_progress', label: 'אושר' },
        { value: 'completed', label: 'הוקלדו' },
        { value: 'final', label: 'סופי' },
        { value: 'cancelled', label: 'מבוטל' },
    ]
};

export default function UserProfileForm({ user, warehouses: externalWarehouses, onSubmit, onCancel, isAdmin = false }) {
  const [formData, setFormData] = useState({
    full_name: '',
    nickname: '',
    phone: '',
    department: '',
    role: 'user',
    assigned_warehouse_id: '',
    default_page: '',
    default_page_filter: ''
  });
  const [warehouses, setWarehouses] = useState([]);

  useEffect(() => {
    // Use external warehouses if provided, otherwise load them
    if (externalWarehouses && externalWarehouses.length > 0) {
      setWarehouses(externalWarehouses);
    } else if (isAdmin) {
      loadWarehouses();
    }
  }, [externalWarehouses, isAdmin]);

  useEffect(() => {
    if (user) {
      setFormData({
        full_name: user.full_name || '',
        nickname: user.nickname || '',
        phone: user.phone || '',
        department: user.department || '',
        role: user.role || 'user',
        assigned_warehouse_id: user.assigned_warehouse_id || '',
        default_page: user.default_page || 'Dashboard',
        default_page_filter: user.default_page_filter || ''
      });
    }
  }, [user]);
  
  const loadWarehouses = async () => {
      try {
        const data = await Warehouse.list();
        setWarehouses(data);
        return data;
      } catch(e) {
        console.error("Failed to load warehouses", e);
        toast({variant: "destructive", title: "Failed to load warehouses"});
        return [];
      }
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
        ...formData,
        profile_completed: true
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="full_name">שם מלא</Label>
        <Input
          id="full_name"
          name="full_name"
          value={formData.full_name}
          onChange={handleChange}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="nickname">כינוי</Label>
        <Input
          id="nickname"
          name="nickname"
          value={formData.nickname}
          onChange={handleChange}
          required
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="phone">טלפון</Label>
        <Input
          id="phone"
          name="phone"
          value={formData.phone}
          onChange={handleChange}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="department">מחלקה/תפקיד</Label>
        <Input
          id="department"
          name="department"
          value={formData.department}
          onChange={handleChange}
        />
      </div>

      {isAdmin && (
        <>
          <div className="space-y-2">
            <Label htmlFor="role">תפקיד מערכת</Label>
            <Select onValueChange={(value) => handleSelectChange('role', value)} value={formData.role}>
                <SelectTrigger>
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="user">משתמש</SelectItem>
                    <SelectItem value="admin">מנהל</SelectItem>
                </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="assigned_warehouse_id">מחסן ראשי (לטכנאי שטח)</Label>
            <Select 
              onValueChange={(value) => handleSelectChange('assigned_warehouse_id', value === "_none_" ? "" : value)} 
              value={formData.assigned_warehouse_id && formData.assigned_warehouse_id !== "" ? formData.assigned_warehouse_id : "_none_"}
              key={`warehouse-select-${formData.assigned_warehouse_id}-${warehouses.length}`}
            >
                <SelectTrigger>
                    <SelectValue placeholder="בחר מחסן" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="_none_">ללא</SelectItem>
                    {warehouses.map(w => (
                        <SelectItem key={w.warehouse_id} value={w.warehouse_id}>{w.name}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="default_page">דף נחיתה ברירת מחדל</Label>
            <Select onValueChange={(value) => {
                handleSelectChange('default_page', value);
                // Reset filter when page changes
                handleSelectChange('default_page_filter', '');
              }} value={formData.default_page}>
                <SelectTrigger>
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {mainPages.map(p => (
                        <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
          </div>

          {pageFilters[formData.default_page] && (
            <div className="space-y-2">
                <Label htmlFor="default_page_filter">סינון ברירת מחדל לדף</Label>
                <Select onValueChange={(value) => handleSelectChange('default_page_filter', value)} value={formData.default_page_filter}>
                    <SelectTrigger>
                        <SelectValue placeholder="בחר סינון" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={null}>ללא</SelectItem>
                        {pageFilters[formData.default_page].map(f => (
                           <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
          )}
        </>
      )}

      <div className="flex justify-end gap-2 pt-4">
        {onCancel && (
            <Button type="button" variant="ghost" onClick={onCancel}>ביטול</Button>
        )}
        <Button type="submit">שמור שינויים</Button>
      </div>
    </form>
  );
}