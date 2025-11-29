import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Warehouse, AlertTriangle, CheckCircle } from "lucide-react";

export default function StockViewModal({ part, stocks, onClose }) {
  const totalStock = stocks.reduce((sum, stock) => sum + stock.quantity, 0);
  const minimumStock = part.minimum_stock || 0;
  const isLowStock = totalStock < minimumStock;
  
  return (
    <Dialog open={!!part} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-3xl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Warehouse className="h-5 w-5" />
            <div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-lg bg-blue-100 text-blue-800 px-3 py-1 rounded">
                  {part.sku}
                </span>
                <span className="font-medium">{part.name}</span>
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-3 bg-white rounded border">
                <div className="text-2xl font-bold text-gray-900">{totalStock}</div>
                <div className="text-sm text-gray-600">סה"כ מלאי</div>
              </div>
              <div className="text-center p-3 bg-white rounded border">
                <div className="text-2xl font-bold text-orange-600">{minimumStock}</div>
                <div className="text-sm text-gray-600">מלאי מינימלי</div>
              </div>
              <div className="text-center p-3 bg-white rounded border">
                <div className={`flex items-center justify-center gap-2 ${isLowStock ? 'text-red-600' : 'text-green-600'}`}>
                  {isLowStock ? (
                    <>
                      <AlertTriangle className="h-5 w-5" />
                      <span className="font-medium">מלאי נמוך</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-5 w-5" />
                      <span className="font-medium">מלאי תקין</span>
                    </>
                  )}
                </div>
                <div className="text-sm text-gray-600">סטטוס</div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium">פירוט מלאי לפי מחסנים:</h4>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>מספר מחסן</TableHead>
                  <TableHead>שם מחסן</TableHead>
                  <TableHead>כמות במלאי</TableHead>
                  <TableHead>אחוז מהמלאי הכולל</TableHead>
                  <TableHead>סטטוס</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stocks.map((stock, index) => {
                  const isWarehouseLow = stock.quantity < minimumStock;
                  const percentage = totalStock > 0 ? Math.round((stock.quantity / totalStock) * 100) : 0;
                  
                  return (
                    <TableRow key={index}>
                      <TableCell className="font-mono font-medium">
                        {stock.warehouse.number || '-'}
                      </TableCell>
                      <TableCell className="font-medium">{stock.warehouse.name}</TableCell>
                      <TableCell className="font-bold text-lg">
                        {stock.quantity}
                      </TableCell>
                      <TableCell className="text-gray-600">
                        {percentage}%
                      </TableCell>
                      <TableCell>
                        {stock.quantity === 0 ? (
                          <Badge variant="destructive">אזל מהמלאי</Badge>
                        ) : isWarehouseLow ? (
                          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                            מלאי נמוך
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-green-100 text-green-800">
                            מלאי תקין
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}