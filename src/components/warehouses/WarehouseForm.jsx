import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Trash2, Loader2 } from "lucide-react";

export default function WarehouseForm({ warehouse, existingWarehouses, onSubmit, onCancel, onDelete, loading = false }) {
  const [formData, setFormData] = useState({
    number: "",
    name: ""
  });
  const [error, setError] = useState("");

  useEffect(() => {
    if (warehouse) {
      setFormData({
        number: warehouse.number || "",
        name: warehouse.name || ""
      });
    } else {
      // For new warehouse, suggest next available number
      const usedNumbers = new Set(existingWarehouses.map(w => w.number));
      let nextNumber = 1;
      while (usedNumbers.has(nextNumber)) {
        nextNumber++;
      }
      setFormData({
        number: nextNumber,
        name: ""
      });
    }
  }, [warehouse, existingWarehouses]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");

    if (!formData.name.trim()) {
      setError("יש למלא שם מחסן");
      return;
    }

    if (!formData.number || formData.number < 1) {
      setError("יש למלא מספר מחסן חיובי");
      return;
    }

    // Check if number is already used by another warehouse
    const existingWarehouse = existingWarehouses.find(
      w => w.number === parseInt(formData.number) && w.id !== warehouse?.id
    );
    
    if (existingWarehouse) {
      setError(`מספר מחסן ${formData.number} כבר קיים`);
      return;
    }

    onSubmit({
      number: parseInt(formData.number),
      name: formData.name.trim()
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {warehouse ? `עריכת מחסן: ${warehouse.name}` : "הוספת מחסן חדש"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="number">מספר מחסן</Label>
              <Input
                id="number"
                type="number"
                min="1"
                value={formData.number}
                onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                placeholder="הזן מספר מחסן"
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">שם המחסן</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="הזן שם המחסן"
                disabled={loading}
              />
            </div>
          </div>

          {!warehouse && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                יצירת מחסן חדש תוסיף עמודה חדשה לכל רשומות המלאי הקיימות במערכת.
                התהליך עלול לקחת מספר שניות.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex justify-between items-center pt-4">
            <div>
              {warehouse && onDelete && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={onDelete}
                  disabled={loading}
                >
                  <Trash2 className="h-4 w-4 ml-2" />
                  מחק מחסן
                </Button>
              )}
            </div>
            <div className="flex gap-3">
              <Button 
                type="button" 
                variant="outline" 
                onClick={onCancel}
                disabled={loading}
              >
                ביטול
              </Button>
              <Button 
                type="submit"
                disabled={loading}
              >
                {loading && <Loader2 className="h-4 w-4 ml-2 animate-spin" />}
                {warehouse ? "עדכן מחסן" : "הוסף מחסן"}
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}