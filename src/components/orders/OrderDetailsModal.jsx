
import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";

const statusMap = {
  draft: { label: "טיוטה", className: "bg-gray-100 text-gray-800" },
  ordered: { label: "הוזמן", className: "bg-blue-100 text-blue-800" },
  partially_received: { label: "התקבל חלקית", className: "bg-yellow-100 text-yellow-800" },
  completed: { label: "הושלם", className: "bg-green-100 text-green-800" },
  cancelled: { label: "בוטל", className: "bg-red-100 text-red-800" },
};

export default function OrderDetailsModal({ order, onClose }) {
  if (!order) return null;

  const statusInfo = statusMap[order.status] || { label: order.status, className: "" };
  const isTemporary = order.order_number && order.order_number.startsWith('TEMP-');

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl" dir="rtl">
        <DialogHeader>
          <DialogTitle>פרטי הזמנה {isTemporary ? `זמנית` : order.order_number}</DialogTitle>
          <DialogDescription>
            {order.supplier && `ספק: ${order.supplier} | `}
            תאריך יצירה: {format(new Date(order.created_date), 'dd/MM/yyyy')}
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 space-y-6">
          <div className="flex items-center gap-4">
            <div className="text-sm">
              <span className="font-medium">סטטוס:</span>
              <Badge className={`mr-2 ${statusInfo.className}`}>{statusInfo.label}</Badge>
            </div>
            {order.delivery_note_numbers && order.delivery_note_numbers.length > 0 && (
              <div className="text-sm">
                <span className="font-medium">תעודות משלוח:</span>
                <div className="inline-flex gap-1 mr-2">
                  {order.delivery_note_numbers.map((dn, i) => <Badge key={i} variant="secondary">{dn}</Badge>)}
                </div>
              </div>
            )}
          </div>
          
          <div className="max-h-[40vh] overflow-y-auto border rounded-md">
            <Table>
              <TableHeader className="sticky top-0 bg-gray-50">
                <TableRow>
                  <TableHead className="text-center">פריט</TableHead>
                  <TableHead className="text-center">מק"ט</TableHead>
                  <TableHead className="text-center">כמות מוזמנת</TableHead>
                  <TableHead className="text-center">כמות שהתקבלה</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.items?.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium text-center">{item.part_name}</TableCell>
                    <TableCell className="text-center">{item.part_sku}</TableCell>
                    <TableCell className="text-center">{item.quantity}</TableCell>
                    <TableCell className="text-center">{item.received_quantity || 0}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          
          {order.notes && (
            <div>
              <h4 className="font-medium mb-2">הערות</h4>
              <p className="text-sm p-3 bg-gray-50 rounded-md border">{order.notes}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
