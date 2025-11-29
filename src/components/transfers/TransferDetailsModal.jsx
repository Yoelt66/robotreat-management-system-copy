import React, { useState, useMemo } from 'react';
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
import { CheckCircle, ArrowUpCircle, Circle, ArrowLeft, Edit, ChevronUp, ChevronDown } from "lucide-react";
import { Part } from "@/entities/all";

const statusColors = {
  pending: "bg-yellow-100 text-yellow-800",
  in_transit: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800"
};

const statusIcons = {
  pending: Circle,
  in_transit: ArrowUpCircle,
  completed: CheckCircle
};

const statusLabels = {
  pending: 'ממתין',
  in_transit: 'בהעברה',
  completed: 'הושלם'
};

export default function TransferDetailsModal({ transfer, onClose, onEdit }) {
  const [sortConfig, setSortConfig] = useState({ key: 'part_sku', direction: 'asc' });
  const [parts, setParts] = React.useState([]);

  React.useEffect(() => {
    const loadParts = async () => {
      try {
        const partsData = await Part.list();
        setParts(partsData);
      } catch (error) {
        console.error("Error loading parts:", error);
      }
    };
    loadParts();
  }, []);

  const getPartLocation = (partSku) => {
    const part = parts.find(p => p.sku === partSku);
    return part?.current_location || 'לא מוגדר';
  };

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedItems = useMemo(() => {
    if (!transfer.items) return [];
    
    let sortableItems = [...transfer.items];
    if (sortConfig.key) {
      sortableItems.sort((a, b) => {
        let aValue, bValue;

        if (sortConfig.key === 'location') {
          aValue = getPartLocation(a.part_sku);
          bValue = getPartLocation(b.part_sku);
        } else {
          aValue = a[sortConfig.key];
          bValue = b[sortConfig.key];
        }

        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
        }

        const strA = String(aValue || '').toLowerCase();
        const strB = String(bValue || '').toLowerCase();
        
        return sortConfig.direction === 'asc' ? strA.localeCompare(strB, 'he') : strB.localeCompare(strA, 'he');
      });
    }
    return sortableItems;
  }, [transfer.items, sortConfig, parts]);

  const SortableHeader = ({ columnKey, children }) => (
    <TableHead onClick={() => requestSort(columnKey)} className="cursor-pointer text-center">
      {children}
      {sortConfig.key === columnKey && (
        sortConfig.direction === 'asc' ? <ChevronUp className="inline h-4 w-4 ml-1" /> : <ChevronDown className="inline h-4 w-4 ml-1" />
      )}
    </TableHead>
  );

  if (!transfer) return null;

  const StatusIcon = statusIcons[transfer.status];
  const canEdit = transfer.status !== 'completed';

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl" dir="rtl">
        <DialogHeader>
          <DialogTitle>פרטי העברה {transfer.transfer_number}</DialogTitle>
          <DialogDescription>
            תאריך יצירה: {format(new Date(transfer.created_date), 'dd/MM/yyyy HH:mm')}
          </DialogDescription>
        </DialogHeader>
        
        <div className="mt-4 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
            <div className="text-center">
              <div className="text-sm text-gray-500 mb-1">מחסן מקור</div>
              <div className="font-medium">{transfer.from_warehouse_name}</div>
            </div>
            <div className="text-center flex items-center justify-center">
              <ArrowLeft className="h-6 w-6 text-gray-400" />
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-500 mb-1">מחסן יעד</div>
              <div className="font-medium">{transfer.to_warehouse_name}</div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-sm">
                <span className="font-medium">סטטוס:</span>
                <Badge className={`mr-2 ${statusColors[transfer.status]}`}>
                  <StatusIcon className="w-3 h-3 ml-1" />
                  {statusLabels[transfer.status]}
                </Badge>
              </div>
            </div>
            {canEdit && onEdit && (
              <Button onClick={() => onEdit(transfer)} variant="outline" size="sm">
                <Edit className="h-4 w-4 ml-1" />
                ערוך העברה
              </Button>
            )}
          </div>
          
          <div>
            <h4 className="font-medium mb-3">פריטים בהעברה</h4>
            <div className="max-h-[40vh] overflow-y-auto border rounded-md">
              <Table>
                <TableHeader className="sticky top-0 bg-gray-50">
                  <TableRow>
                    <SortableHeader columnKey="part_sku">מק"ט</SortableHeader>
                    <SortableHeader columnKey="part_name">שם פריט</SortableHeader>
                    <SortableHeader columnKey="quantity">כמות</SortableHeader>
                    <SortableHeader columnKey="location">מיקום</SortableHeader>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedItems && sortedItems.length > 0 ? (
                    sortedItems.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-mono text-sm text-center">{item.part_sku}</TableCell>
                        <TableCell className="font-medium text-center">{item.part_name || 'שם לא זמין'}</TableCell>
                        <TableCell className="text-center">{item.quantity}</TableCell>
                        <TableCell className="text-center text-sm text-gray-600">{getPartLocation(item.part_sku)}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-gray-500 py-8">
                        אין פריטים בהעברה זו
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
          
          {transfer.notes && (
            <div>
              <h4 className="font-medium mb-2">הערות</h4>
              <p className="text-sm p-3 bg-gray-50 rounded-md border whitespace-pre-wrap">{transfer.notes}</p>
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