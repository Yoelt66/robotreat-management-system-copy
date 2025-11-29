import React, { useState, useEffect } from "react";
import { DeliveryNote } from "@/entities/DeliveryNote";
import { Part } from "@/entities/Part";
import { Warehouse } from "@/entities/Warehouse";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

import DeliveryNoteForm from "../components/delivery_notes/DeliveryNoteForm";
import DeliveryNoteList from "../components/delivery_notes/DeliveryNoteList";
import DeliveryNoteDetailsModal from "../components/delivery_notes/DeliveryNoteDetailsModal";

export default function DeliveryNotes() {
  const [deliveryNotes, setDeliveryNotes] = useState([]);
  const [parts, setParts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [viewingNote, setViewingNote] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      console.log("Loading delivery notes data...");
      
      let notesData = [];
      let partsData = [];
      let warehousesData = [];

      try {
        console.log("Loading delivery notes...");
        notesData = await DeliveryNote.list("-created_date");
        console.log("Delivery notes loaded:", notesData.length);
      } catch (error) {
        console.error("Error loading delivery notes:", error);
        toast({ variant: "destructive", title: "שגיאה בטעינת תעודות משלוח" });
      }

      try {
        console.log("Loading parts...");
        partsData = await Part.list();
        console.log("Parts loaded:", partsData.length);
      } catch (error) {
        console.error("Error loading parts:", error);
        toast({ variant: "destructive", title: "שגיאה בטעינת פריטים" });
      }

      try {
        console.log("Loading warehouses...");
        warehousesData = await Warehouse.list();
        console.log("Warehouses loaded:", warehousesData.length);
      } catch (error) {
        console.error("Error loading warehouses:", error);
        toast({ variant: "destructive", title: "שגיאה בטעינת מחסנים" });
      }

      setDeliveryNotes(notesData);
      setParts(partsData);
      setWarehouses(warehousesData);
    } catch (error) {
      console.error("Error loading data:", error);
      toast({ variant: "destructive", title: "שגיאה בטעינת נתונים" });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDeliveryNote = async (noteData) => {
    setLoading(true);
    try {
      // 1. Create the delivery note record
      await DeliveryNote.create(noteData);
      toast({ title: "תעודת משלוח נוצרה בהצלחה" });

      // 2. Update stock for each item in the note - stock is now stored directly in Part entity
      for (const item of noteData.items) {
        const part = parts.find(p => p.sku === item.part_sku);
        const warehouse = warehouses.find(w => w.id === noteData.warehouse_id);
        if (!part || !warehouse) continue;

        // Get current quantity from the part record using warehouse_id as column name
        const currentQty = part[warehouse.warehouse_id] || 0;
        const newQty = currentQty + item.quantity;
        
        // Update the part record with new stock quantity
        await Part.update(part.id, {
          [warehouse.warehouse_id]: newQty,
          last_count_date: noteData.delivery_date // Update last count date
        });
      }
      
      toast({ title: "המלאי עודכן בהצלחה" });
      setShowForm(false);
      await loadData(); // Reload all data to reflect changes
    } catch (error) {
      console.error("Error creating delivery note and updating stock:", error);
      toast({ variant: "destructive", title: "שגיאה ביצירת תעודה ועדכון מלאי" });
    } finally {
      setLoading(false);
    }
  };

  const handleViewNote = (note) => {
    setViewingNote(note);
  };

  return (
    <div className="p-6" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <h1 className="text-2xl font-bold">תעודות משלוח</h1>
          <Button onClick={() => setShowForm(true)} className="w-full sm:w-auto">
            <Plus className="w-4 h-4 ml-2" /> הוסף תעודת משלוח
          </Button>
        </div>

        {showForm && (
          <DeliveryNoteForm
            parts={parts}
            warehouses={warehouses}
            onSubmit={handleCreateDeliveryNote}
            onCancel={() => setShowForm(false)}
            loading={loading}
          />
        )}

        <DeliveryNoteList
          deliveryNotes={deliveryNotes}
          loading={loading}
          onView={handleViewNote}
        />

        {viewingNote && (
          <DeliveryNoteDetailsModal
            note={viewingNote}
            onClose={() => setViewingNote(null)}
          />
        )}
      </div>
    </div>
  );
}