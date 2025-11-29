import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format } from 'date-fns';

export default function ReceiveStockForm({ order, warehouses, onSubmit, onCancel }) {
  const [deliveryNoteNumber, setDeliveryNoteNumber] = useState('');
  const [deliveryDate, setDeliveryDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [warehouseId, setWarehouseId] = useState(''); // Stores the ID of the selected warehouse
  const [receivedItems, setReceivedItems] = useState(
    order.items.map(item => ({
      ...item,
      quantity_to_receive: Math.max(0, item.quantity - (item.received_quantity || 0))
    }))
  );
  const [error, setError] = useState('');

  const handleQuantityChange = (sku, value) => {
    const numericValue = Number(value);
    setReceivedItems(prev => prev.map(item => {
      if (item.part_sku === sku) {
        const maxReceivable = item.quantity - (item.received_quantity || 0);
        return {
          ...item,
          quantity_to_receive: Math.max(0, Math.min(numericValue, maxReceivable))
        };
      }
      return item;
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    
    if (!deliveryNoteNumber || !deliveryDate || !warehouseId) {
      setError('נא למלא מספר תעודה, תאריך ומחסן יעד.');
      return;
    }
    
    if (receivedItems.every(item => item.quantity_to_receive === 0)) {
        setError('יש לציין כמות שהתקבלה עבור פריט אחד לפחות.');
        return;
    }

    // Find the selected warehouse object from the provided warehouses list
    const selectedWarehouse = warehouses.find(w => w.id === warehouseId);

    if (!selectedWarehouse) {
      setError('שגיאה: מחסן היעד שנבחר אינו חוקי.');
      return;
    }

    const dataToSubmit = {
      note_number: deliveryNoteNumber,
      delivery_date: deliveryDate,
      warehouse_id: warehouseId, // Pass the warehouse ID, not the object
      warehouse_name: selectedWarehouse.name, // Also pass the name for display
      items: receivedItems.map(item => ({
        part_sku: item.part_sku,
        part_name: item.part_name,
        quantity: item.quantity_to_receive
      }))
    };
    
    onSubmit(dataToSubmit, order);
  };

  return (
    <Dialog open={true} onOpenChange={onCancel}>
      <DialogContent className="max-w-4xl" dir="rtl">
        <DialogHeader>
          <DialogTitle>קבלת סחורה עבור הזמנה {order.order_number}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-6 py-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="note_number">מספר תעודת משלוח</Label>
                <Input id="note_number" value={deliveryNoteNumber} onChange={e => setDeliveryNoteNumber(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="delivery_date">תאריך קבלה</Label>
                <Input id="delivery_date" type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="warehouse_id">מחסן יעד</Label>
                <Select onValueChange={setWarehouseId} value={warehouseId} required>
                  <SelectTrigger><SelectValue placeholder="בחר מחסן" /></SelectTrigger>
                  <SelectContent>
                    {warehouses.map(w => <SelectItem key={w.id} value={w.id}>{w.number} - {w.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="max-h-[40vh] overflow-y-auto border rounded-md">
              <Table>
                <TableHeader className="sticky top-0 bg-gray-50">
                  <TableRow>
                    <TableHead className="text-center">פריט</TableHead>
                    <TableHead className="text-center">הוזמן</TableHead>
                    <TableHead className="text-center">התקבל</TableHead>
                    <TableHead className="text-center">יתרה לקבלה</TableHead>
                    <TableHead className="text-center">מתקבל כעת</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receivedItems.map(item => {
                    const remaining = item.quantity - (item.received_quantity || 0);
                    return (
                      <TableRow key={item.part_sku}>
                        <TableCell className="text-center">
                          <div>{item.part_name}</div>
                          <div className="text-xs text-gray-500">{item.part_sku}</div>
                        </TableCell>
                        <TableCell className="text-center">{item.quantity}</TableCell>
                        <TableCell className="text-center">{item.received_quantity || 0}</TableCell>
                        <TableCell className="text-center">{remaining}</TableCell>
                        <TableCell className="text-center">
                          <Input 
                            type="number"
                            min="0"
                            max={remaining}
                            value={item.quantity_to_receive}
                            onChange={e => handleQuantityChange(item.part_sku, e.target.value)}
                            className="w-24 mx-auto"
                            disabled={remaining <= 0}
                          />
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">ביטול</Button>
            </DialogClose>
            <Button type="submit">שמור וקלוט מלאי</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}