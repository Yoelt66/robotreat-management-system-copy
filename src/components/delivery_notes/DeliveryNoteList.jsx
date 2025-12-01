import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Truck, Search, Eye, ChevronUp, ChevronDown, Package } from "lucide-react";
import { format } from "date-fns";

export default function DeliveryNoteList({ deliveryNotes, loading, onView }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'created_date', direction: 'desc' });

  const filteredAndSortedNotes = useMemo(() => {
    let notes = [...(deliveryNotes || [])];
    
    // Filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      notes = notes.filter(note => 
        note.note_number?.toLowerCase().includes(term) ||
        note.supplier_name?.toLowerCase().includes(term) ||
        note.supplier?.toLowerCase().includes(term) ||
        note.warehouse_name?.toLowerCase().includes(term)
      );
    }
    
    // Sort
    if (sortConfig.key) {
      notes.sort((a, b) => {
        let aVal = a[sortConfig.key];
        let bVal = b[sortConfig.key];
        
        if (sortConfig.key === 'created_date' || sortConfig.key === 'delivery_date') {
          aVal = new Date(aVal || 0).getTime();
          bVal = new Date(bVal || 0).getTime();
        }
        
        if (sortConfig.key === 'items_count') {
          aVal = a.items?.length || 0;
          bVal = b.items?.length || 0;
        }
        
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
        }
        
        const strA = String(aVal || '').toLowerCase();
        const strB = String(bVal || '').toLowerCase();
        return sortConfig.direction === 'asc' 
          ? strA.localeCompare(strB, 'he') 
          : strB.localeCompare(strA, 'he');
      });
    }
    
    return notes;
  }, [deliveryNotes, searchTerm, sortConfig]);

  const requestSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const SortableHeader = ({ columnKey, children, className = '' }) => (
    <TableHead 
      onClick={() => requestSort(columnKey)} 
      className={`cursor-pointer hover:bg-gray-100 transition-colors ${className}`}
    >
      <div className="flex items-center justify-center gap-1">
        {children}
        {sortConfig.key === columnKey && (
          sortConfig.direction === 'asc' 
            ? <ChevronUp className="h-4 w-4" /> 
            : <ChevronDown className="h-4 w-4" />
        )}
      </div>
    </TableHead>
  );

  if (loading) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-500">טוען תעודות משלוח...</p>
        </CardContent>
      </Card>
    );
  }

  if (!deliveryNotes || deliveryNotes.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="bg-gray-100 rounded-full p-4 mb-4">
            <Truck className="h-12 w-12 text-gray-400" />
          </div>
          <h3 className="text-xl font-medium text-gray-900 mb-2">אין תעודות משלוח</h3>
          <p className="text-gray-500">צור תעודת משלוח חדשה כדי לקלוט סחורה למחסן</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="border-b bg-gray-50">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-blue-600" />
            רשימת תעודות
            <Badge variant="secondary">{deliveryNotes.length}</Badge>
          </CardTitle>
          <div className="relative w-full sm:w-64">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="חיפוש..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pr-9"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <SortableHeader columnKey="note_number">מספר תעודה</SortableHeader>
                <SortableHeader columnKey="supplier_name">ספק</SortableHeader>
                <SortableHeader columnKey="delivery_date">תאריך קבלה</SortableHeader>
                <SortableHeader columnKey="warehouse_name">מחסן</SortableHeader>
                <SortableHeader columnKey="items_count">פריטים</SortableHeader>
                <TableHead className="text-center w-20">צפייה</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedNotes.map(note => (
                <TableRow
                  key={note.id}
                  className="hover:bg-blue-50/50 cursor-pointer transition-colors"
                  onClick={() => onView && onView(note)}
                >
                  <TableCell className="font-mono font-medium text-blue-600 text-center">
                    {note.note_number}
                  </TableCell>
                  <TableCell className="text-center">
                    {note.supplier_name || note.supplier}
                  </TableCell>
                  <TableCell className="text-center">
                    {format(new Date(note.delivery_date), 'dd/MM/yyyy')}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="font-normal">
                      {note.warehouse_name}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Package className="h-4 w-4 text-gray-400" />
                      <span>{note.items?.length || 0}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        onView && onView(note);
                      }}
                      className="h-8 w-8"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        
        {filteredAndSortedNotes.length === 0 && searchTerm && (
          <div className="text-center py-8 text-gray-500">
            לא נמצאו תעודות התואמות לחיפוש "{searchTerm}"
          </div>
        )}
      </CardContent>
    </Card>
  );
}