import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Unit } from "@/entities/Unit";
import UnitList from "./UnitList";
import UnitForm from "./UnitForm";

export default function UnitSettings() {
  const [units, setUnits] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingUnit, setEditingUnit] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUnits();
  }, []);

  const loadUnits = async () => {
    try {
      const data = await Unit.list();
      if (data && data.length > 0) {
        setUnits(data);
      } else {
        // Insert default units if none exist
        const defaultUnits = [
          { code: 'pieces', name: 'יחידות', symbol: 'יח\'', type: 'quantity' },
          { code: 'kg', name: 'קילוגרם', symbol: 'ק״ג', type: 'weight' },
          { code: 'g', name: 'גרם', symbol: 'גר\'', type: 'weight' },
          { code: 'liters', name: 'ליטרים', symbol: 'ל\'', type: 'volume' },
          { code: 'ml', name: 'מיליליטר', symbol: 'מ״ל', type: 'volume' },
          { code: 'meters', name: 'מטרים', symbol: 'מ\'', type: 'length' },
          { code: 'cm', name: 'סנטימטר', symbol: 'ס״מ', type: 'length' },
          { code: 'boxes', name: 'קופסאות', symbol: 'קופ\'', type: 'quantity' },
          { code: 'pairs', name: 'זוגות', symbol: 'זוג', type: 'quantity' },
          { code: 'sets', name: 'סטים', symbol: 'סט', type: 'quantity' }
        ];
        
        for (const unit of defaultUnits) {
          await Unit.create(unit);
        }
        setUnits(defaultUnits);
      }
    } catch (error) {
      console.error("Error loading units:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (unitData) => {
    try {
      if (editingUnit) {
        await Unit.update(editingUnit.id, unitData);
      } else {
        await Unit.create(unitData);
      }
      setShowForm(false);
      setEditingUnit(null);
      loadUnits();
    } catch (error) {
      console.error("Error saving unit:", error);
    }
  };

  const handleDelete = async (unitId) => {
    try {
      await Unit.delete(unitId);
      loadUnits();
    } catch (error) {
      console.error("Error deleting unit:", error);
    }
  };

  if (loading) {
    return <div>טוען...</div>;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>יחידות מידה</CardTitle>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 ml-2" />
          יחידת מידה חדשה
        </Button>
      </CardHeader>
      <CardContent>
        {showForm ? (
          <UnitForm
            unit={editingUnit}
            onSubmit={handleSubmit}
            onCancel={() => {
              setShowForm(false);
              setEditingUnit(null);
            }}
          />
        ) : (
          <UnitList
            units={units}
            onEdit={(unit) => {
              setEditingUnit(unit);
              setShowForm(true);
            }}
            onDelete={handleDelete}
          />
        )}
      </CardContent>
    </Card>
  );
}