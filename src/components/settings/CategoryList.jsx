
import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2 } from "lucide-react";

export default function CategoryList({ categories, onEdit, onDelete }) {
  if (categories.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        לא נמצאו קטגוריות
      </div>
    );
  }

  return (
    <div className="border rounded-md">
      <Table>
        <TableHeader>
          <TableRow className="h-8"> {/* Reduced header height by 30% */}
            <TableHead className="text-center py-2">קוד</TableHead>
            <TableHead className="text-center py-2">שם</TableHead>
            <TableHead className="text-center py-2">ספק ברירת מחדל</TableHead>
            <TableHead className="text-center py-2">מטבע עלות</TableHead>
            <TableHead className="text-center py-2">מטבע מכירה</TableHead>
            <TableHead className="text-center py-2">אחוז ייבוא</TableHead>
            <TableHead className="text-center py-2">אחוז רווח</TableHead>
            <TableHead className="text-center py-2">פעולות</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {categories.map((category) => (
            <TableRow key={category.id} className="h-10"> {/* Reduced row height by 30% */}
              <TableCell className="text-center py-1">
                <Badge variant="outline" className="font-mono text-xs">
                  {category.code}
                </Badge>
              </TableCell>
              <TableCell className="text-center font-medium py-1 text-sm">
                {category.name}
              </TableCell>
              <TableCell className="text-center py-1">
                {category.supplier_name ? (
                  <Badge variant="secondary" className="text-xs">
                    {category.supplier_name}
                  </Badge>
                ) : (
                  <span className="text-gray-400 text-xs">-</span>
                )}
              </TableCell>
              <TableCell className="text-center py-1">
                <Badge variant="secondary" className="text-xs">
                  {category.cost_currency || 'ILS'}
                </Badge>
              </TableCell>
              <TableCell className="text-center py-1">
                <Badge variant="secondary" className="text-xs">
                  {category.sale_currency || 'ILS'}
                </Badge>
              </TableCell>
              <TableCell className="text-center py-1 text-sm">
                {category.import_percentage || 0}%
              </TableCell>
              <TableCell className="text-center py-1 text-sm">
                {category.margin_percentage || 0}%
              </TableCell>
              <TableCell className="text-center py-1">
                <div className="flex justify-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(category)}
                    className="h-7 w-7 p-0"
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                  {onDelete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-600 h-7 w-7 p-0"
                      onClick={() => onDelete(category.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
