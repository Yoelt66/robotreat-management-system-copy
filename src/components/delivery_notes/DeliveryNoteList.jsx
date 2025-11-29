
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Truck } from "lucide-react";
import { format } from "date-fns";

export default function DeliveryNoteList({ deliveryNotes, loading, onPrint, onExport, onView }) {
  if (loading) {
    return <Card><CardContent className="p-6 text-center">טוען תעודות משלוח...</CardContent></Card>;
  }

  if (!deliveryNotes || deliveryNotes.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Truck className="h-12 w-12 text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900">לא נמצאו תעודות משלוח</h3>
          <p className="text-gray-500 mt-1">הוסף תעודת משלוח חדשה כדי להתחיל.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>רשימת תעודות משלוח</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-center">מספר תעודה</TableHead>
              <TableHead className="text-center">ספק</TableHead>
              <TableHead className="text-center">תאריך קבלה</TableHead>
              <TableHead className="text-center">מחסן יעד</TableHead>
              <TableHead className="text-center">פריטים</TableHead>
              <TableHead className="text-center">פעולות</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deliveryNotes.map(note => (
              <TableRow
                key={note.id}
                onClick={() => onView && onView(note)}
                className="cursor-pointer hover:bg-gray-50"
              >
                <TableCell className="font-mono text-center text-blue-600">
                  {note.note_number}
                </TableCell>
                <TableCell className="text-center">{note.supplier_name || note.supplier}</TableCell>
                <TableCell className="text-center">{format(new Date(note.delivery_date), 'dd/MM/yyyy')}</TableCell>
                <TableCell className="text-center">{note.warehouse_name}</TableCell>
                <TableCell className="text-center">{note.items?.length || 0}</TableCell>
                <TableCell className="text-center">
                  {/* Actions for onPrint, onExport, onView will go here */}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
