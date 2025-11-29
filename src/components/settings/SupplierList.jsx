
import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2 } from "lucide-react"; // Added Trash2 icon
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"; // Added Card components

export default function SupplierList({ suppliers, onEdit, onDelete }) {
  if (suppliers.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        לא נמצאו ספקים. הוסף ספק חדש כדי להתחיל.
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-center">רשימת ספקים</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0"> {/* Adjusted padding for card content */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-center">מספר ספק</TableHead>
              <TableHead className="text-center">שם הספק</TableHead>
              <TableHead className="text-center">איש קשר</TableHead>
              <TableHead className="text-center">אימייל</TableHead>
              <TableHead className="text-center">סטטוס</TableHead>
              <TableHead className="text-center">פעולות</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {suppliers.map((supplier) => (
              <TableRow key={supplier.id}>
                <TableCell className="text-center font-mono">
                  {supplier.supplier_number}
                </TableCell>
                <TableCell className="text-center font-medium">{supplier.name}</TableCell>
                <TableCell className="text-center">{supplier.contact_person || '-'}</TableCell>
                <TableCell className="text-center">{supplier.email || '-'}</TableCell>
                <TableCell className="text-center">
                  <Badge className={supplier.is_active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
                    {supplier.is_active ? 'פעיל' : 'לא פעיל'}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex justify-center items-center gap-2"> {/* Center buttons within cell */}
                    <Button variant="ghost" size="icon" onClick={() => onEdit(supplier)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => onDelete(supplier.id)} className="text-red-500 hover:text-red-700">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
