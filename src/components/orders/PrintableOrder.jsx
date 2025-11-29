import React from 'react';
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function PrintableOrder({ order }) {
  if (!order) return null;

  return (
    <div className="p-8 font-sans" dir="rtl">
      <header className="flex justify-between items-start pb-4 border-b-2 border-black">
        <div>
          <h1 className="text-3xl font-bold">הזמנת רכש</h1>
          <p className="text-lg">מספר: {order.order_number}</p>
        </div>
        <div className="text-left text-sm">
          <p className="font-bold">StockFlow Solutions</p>
          <p>רחוב ההדגמה 123, תל אביב</p>
          <p>ע.מ. 511223344</p>
        </div>
      </header>

      <section className="my-6 grid grid-cols-2 gap-4 text-sm">
        <div>
          <h2 className="font-bold mb-2">ספק:</h2>
          <p>{order.supplier_name || order.supplier}</p>
        </div>
        <div className="text-left">
          <p><strong>תאריך הזמנה:</strong> {format(new Date(order.order_date || order.created_date), 'dd/MM/yyyy')}</p>
          <p><strong>סטטוס:</strong> {order.status}</p>
        </div>
      </section>

      <section className="my-6">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-100">
              <TableHead className="w-[100px]">מק"ט</TableHead>
              <TableHead>שם פריט</TableHead>
              <TableHead className="text-center">כמות</TableHead>
              <TableHead className="text-right">מחיר יחידה</TableHead>
              <TableHead className="text-right">סה"כ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {order.items.map((item, index) => (
              <TableRow key={index}>
                <TableCell>{item.part_sku}</TableCell>
                <TableCell className="font-medium">{item.part_name}</TableCell>
                <TableCell className="text-center">{item.quantity}</TableCell>
                <TableCell className="text-right">{(item.cost_price || 0).toFixed(2)} {item.currency}</TableCell>
                <TableCell className="text-right">{(item.quantity * (item.cost_price || 0)).toFixed(2)} {item.currency}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      {order.notes && (
        <section className="my-6">
          <h3 className="font-bold mb-2">הערות</h3>
          <p className="p-3 border rounded-md bg-gray-50 text-sm whitespace-pre-wrap">{order.notes}</p>
        </section>
      )}

      <footer className="pt-8 mt-8 border-t text-center text-xs text-gray-500">
        <p>תודה רבה!</p>
      </footer>
    </div>
  );
}