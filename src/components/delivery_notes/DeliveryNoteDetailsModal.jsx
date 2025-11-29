import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";

export default function DeliveryNoteDetailsModal({ note, onClose }) {
  if (!note) return null;

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl" dir="rtl">
        <DialogHeader>
          <DialogTitle>פרטי תעודת משלוח: {note.note_number}</DialogTitle>
          <DialogDescription>
            ספק: {note.supplier_name || note.supplier} | תאריך קבלה: {format(new Date(note.delivery_date), 'dd/MM/yyyy')}
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 space-y-6">
          <div className="flex items-center gap-4">
            <div className="text-sm">
              <span className="font-medium">מחסן יעד:</span>
              <Badge variant="secondary" className="mr-2">{note.warehouse_name}</Badge>
            </div>
          </div>
          
          <div>
            <h4 className="font-medium mb-2">פריטים שהתקבלו</h4>
            <div className="max-h-[40vh] overflow-y-auto border rounded-md">
              <Table>
                <TableHeader className="sticky top-0 bg-gray-50">
                  <TableRow>
                    <TableHead className="text-center">מק"ט</TableHead>
                    <TableHead className="text-center">שם פריט</TableHead>
                    <TableHead className="text-center">כמות</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {note.items?.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-mono text-center">{item.part_sku}</TableCell>
                      <TableCell className="text-center">{item.part_name}</TableCell>
                      <TableCell className="text-center font-medium">{item.quantity}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
          
          {note.notes && (
            <div>
              <h4 className="font-medium mb-2">הערות</h4>
              <p className="text-sm p-3 bg-gray-50 rounded-md border">{note.notes}</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={onClose} variant="outline">
            סגור
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}