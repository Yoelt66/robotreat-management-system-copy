
import React from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { CheckCircle, ArrowRight, Timer, Truck } from "lucide-react";

const statusColors = {
  pending: "bg-yellow-100 text-yellow-800",
  in_transit: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800"
};

const statusIcons = {
  pending: Timer,
  in_transit: Truck,
  completed: CheckCircle
};

export default function TransfersList({ transfers, onStatusUpdate, onViewTransfer }) {
  const getStatusActions = (transfer) => {
    if (!transfer.transfer_number) {
      console.warn("Transfer without transfer_number:", transfer.id);
    }
    
    switch (transfer.status) {
      case 'pending':
        return (
          <Button
            size="sm"
            variant="outline"
            className="text-blue-600 hover:text-blue-800"
            onClick={() => onStatusUpdate(transfer.id, 'in_transit')}
          >
            התחל העברה
          </Button>
        );
      case 'in_transit':
        return (
          <Button
            size="sm"
            variant="outline"
            className="text-green-600 hover:text-green-800"
            onClick={() => onStatusUpdate(transfer.id, 'completed')}
          >
            סיים העברה
          </Button>
        );
      default:
        return null;
    }
  };

  if (transfers.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <ArrowRight className="h-12 w-12 text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900">אין העברות</h3>
          <p className="text-gray-500 mt-1">התחל העברה חדשה להעברת מלאי בין מחסנים</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>העברות מלאי</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="max-h-[26rem] overflow-y-auto border rounded-md">
          <Table>
            <TableHeader className="sticky top-0 bg-gray-50 z-10">
              <TableRow className="h-10">
                <TableHead className="py-2 text-center">מספר העברה</TableHead>
                <TableHead className="py-2 text-center">תאריך</TableHead>
                <TableHead className="py-2 text-center">ממחסן</TableHead>
                <TableHead className="py-2 text-center">למחסן</TableHead>
                <TableHead className="py-2 text-center">סטטוס</TableHead>
                <TableHead className="py-2 text-center">יוצר</TableHead>
                <TableHead className="py-2 text-center">פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transfers.map((transfer) => {
                const StatusIcon = statusIcons[transfer.status];
                return (
                  <TableRow key={transfer.id} className="h-12">
                    <TableCell className="font-mono py-2 text-center">
                      <button
                        className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                        onClick={() => onViewTransfer && onViewTransfer(transfer)}
                      >
                        {transfer.transfer_number || `TRF-${transfer.id.substring(0, 6)}`}
                      </button>
                    </TableCell>
                    <TableCell className="py-2 text-center">
                      {format(new Date(transfer.created_date), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell className="py-2 text-center">{transfer.from_warehouse_name}</TableCell>
                    <TableCell className="py-2 text-center">{transfer.to_warehouse_name}</TableCell>
                    <TableCell className="py-2 text-center">
                      <Badge className={statusColors[transfer.status]}>
                        <StatusIcon className="w-3 h-3 ml-1" />
                        {transfer.status === 'pending' ? 'ממתין' : 
                         transfer.status === 'in_transit' ? 'בהעברה' : 'הושלם'}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-2 text-center">
                      <span className="text-sm text-gray-600">
                        {transfer.creator_nickname || 'לא ידוע'}
                      </span>
                    </TableCell>
                    <TableCell className="py-2 text-center">
                      {getStatusActions(transfer)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
