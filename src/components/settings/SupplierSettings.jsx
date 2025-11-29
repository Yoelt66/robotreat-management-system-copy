import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Supplier } from "@/entities/Supplier";
import SupplierList from "./SupplierList";
import SupplierForm from "./SupplierForm";

export default function SupplierSettings() {
  const [suppliers, setSuppliers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSuppliers();
  }, []);

  const loadSuppliers = async () => {
    try {
      const data = await Supplier.list();
      setSuppliers(data);
    } catch (error) {
      console.error("Error loading suppliers:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (supplierData) => {
    try {
      if (editingSupplier) {
        await Supplier.update(editingSupplier.id, supplierData);
      } else {
        await Supplier.create(supplierData);
      }
      setShowForm(false);
      setEditingSupplier(null);
      loadSuppliers();
    } catch (error) {
      console.error("Error saving supplier:", error);
    }
  };

  if (loading) {
    return <div>טוען...</div>;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>ספקים</CardTitle>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 ml-2" />
          ספק חדש
        </Button>
      </CardHeader>
      <CardContent>
        {showForm ? (
          <SupplierForm
            supplier={editingSupplier}
            onSubmit={handleSubmit}
            onCancel={() => {
              setShowForm(false);
              setEditingSupplier(null);
            }}
          />
        ) : (
          <SupplierList
            suppliers={suppliers}
            onEdit={(supplier) => {
              setEditingSupplier(supplier);
              setShowForm(true);
            }}
          />
        )}
      </CardContent>
    </Card>
  );
}