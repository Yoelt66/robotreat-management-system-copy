import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Search, Users } from "lucide-react";
import { toast } from "sonner";
import CustomerWithUnits from "@/components/field/CustomerWithUnits";

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [units, setUnits] = useState([]);
  const [unitBrands, setUnitBrands] = useState([]);
  const [maintenanceTypes, setMaintenanceTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [customerToDelete, setCustomerToDelete] = useState(null);
  const [unitToDelete, setUnitToDelete] = useState(null);

  const [customerFormData, setCustomerFormData] = useState({ name: "", phone: "", email: "", address: "", notes: "" });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [customersData, unitsData, brandsData, typesData] = await Promise.all([
        base44.entities.Customer.list(),
        base44.entities.ServiceUnit.list(),
        base44.entities.UnitBrand.list(),
        base44.entities.MaintenanceType.list(),
      ]);

      setCustomers(customersData || []);
      setUnits(unitsData || []);
      setUnitBrands(brandsData || []);
      setMaintenanceTypes(typesData || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openNewCustomer = () => {
    setEditingCustomer(null);
    setCustomerFormData({ name: "", phone: "", email: "", address: "", notes: "" });
    setShowCustomerForm(true);
  };

  const openEditCustomer = (customer) => {
    setEditingCustomer(customer);
    setCustomerFormData({ name: customer.name || "", phone: customer.phone || "", email: customer.email || "", address: customer.address || "", notes: customer.notes || "" });
    setShowCustomerForm(true);
  };

  const handleSaveCustomer = async (e) => {
    e.preventDefault();
    try {
      if (editingCustomer) {
        await base44.entities.Customer.update(editingCustomer.id, customerFormData);
        toast.success("הלקוח עודכן");
      } else {
        await base44.entities.Customer.create(customerFormData);
        toast.success("הלקוח נוצר");
      }
      setShowCustomerForm(false);
      loadData();
    } catch (err) {
      toast.error("שגיאה בשמירה");
    }
  };

  const handleDeleteCustomer = async () => {
    if (!customerToDelete) return;
    try {
      const customerUnits = units.filter(u => u.customer_id === customerToDelete.id);
      for (const u of customerUnits) await base44.entities.ServiceUnit.delete(u.id);
      await base44.entities.Customer.delete(customerToDelete.id);
      toast.success("הלקוח נמחק");
      setCustomerToDelete(null);
      loadData();
    } catch (err) {
      toast.error("שגיאה במחיקה");
    }
  };

  const handleSaveUnit = async (data, unitId) => {
    try {
      if (unitId) {
        await base44.entities.ServiceUnit.update(unitId, data);
        toast.success("היחידה עודכנה");
      } else {
        await base44.entities.ServiceUnit.create(data);
        toast.success("היחידה נוצרה");
      }
      loadData();
    } catch (err) {
      toast.error("שגיאה בשמירה");
    }
  };

  const handleDeleteUnit = async () => {
    if (!unitToDelete) return;
    try {
      await base44.entities.ServiceUnit.delete(unitToDelete.id);
      toast.success("היחידה נמחקה");
      setUnitToDelete(null);
      loadData();
    } catch (err) {
      toast.error("שגיאה במחיקה");
    }
  };

  const filteredCustomers = customers.filter(c =>
    c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone?.includes(searchTerm) ||
    c.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getCustomerUnits = (customerId) => units
    .filter(u => u.customer_id === customerId)
    .sort((a, b) => a.name?.localeCompare(b.name || "", 'he') || 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">לקוחות ומערכות שירות</h1>
          <p className="text-sm text-slate-500 mt-1">{customers.length} לקוחות · {units.length} יחידות שירות</p>
        </div>
        <Button onClick={openNewCustomer}>
          <Plus className="h-4 w-4 ml-2" />
          לקוח חדש
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
        <Input
          placeholder="חיפוש לקוחות..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="pr-9"
        />
      </div>

      <div className="space-y-3">
        {filteredCustomers.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <Users className="h-12 w-12 mx-auto mb-3 text-slate-200" />
            {searchTerm ? "לא נמצאו לקוחות" : "אין לקוחות — הוסף לקוח ראשון"}
          </div>
        ) : (
          filteredCustomers.map(customer => (
            <CustomerWithUnits
              key={customer.id}
              customer={customer}
              units={getCustomerUnits(customer.id)}
              unitBrands={unitBrands}
              maintenanceTypes={maintenanceTypes}
              onEditCustomer={() => openEditCustomer(customer)}
              onDeleteCustomer={() => setCustomerToDelete(customer)}
              onSaveUnit={handleSaveUnit}
              onDeleteUnit={(unit) => setUnitToDelete(unit)}
            />
          ))
        )}
      </div>

      <Dialog open={showCustomerForm} onOpenChange={open => { if (!open) setShowCustomerForm(false); }}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>{editingCustomer ? "עריכת לקוח" : "לקוח חדש"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveCustomer} className="space-y-4">
            <div className="space-y-2">
              <Label>שם *</Label>
              <Input value={customerFormData.name} onChange={e => setCustomerFormData({ ...customerFormData, name: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>טלפון</Label>
                <Input value={customerFormData.phone} onChange={e => setCustomerFormData({ ...customerFormData, phone: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>אימייל</Label>
                <Input type="email" value={customerFormData.email} onChange={e => setCustomerFormData({ ...customerFormData, email: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>כתובת</Label>
              <Input value={customerFormData.address} onChange={e => setCustomerFormData({ ...customerFormData, address: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>הערות</Label>
              <Textarea value={customerFormData.notes} onChange={e => setCustomerFormData({ ...customerFormData, notes: e.target.value })} rows={2} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowCustomerForm(false)}>ביטול</Button>
              <Button type="submit">{editingCustomer ? "עדכן" : "צור"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!customerToDelete} onOpenChange={() => setCustomerToDelete(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>מחיקת לקוח</AlertDialogTitle>
            <AlertDialogDescription>האם למחוק את "{customerToDelete?.name}"? כל יחידות השירות שלו יימחקו גם כן.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCustomer} className="bg-red-600 hover:bg-red-700">מחק</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!unitToDelete} onOpenChange={() => setUnitToDelete(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>מחיקת יחידת שירות</AlertDialogTitle>
            <AlertDialogDescription>האם למחוק את "{unitToDelete?.name}"?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUnit} className="bg-red-600 hover:bg-red-700">מחק</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}