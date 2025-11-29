
import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"; // Added Card imports

export default function UnitList({ units, onEdit, onDelete }) {
  const getTypeLabel = (type) => {
    const types = {
      quantity: 'כמות',
      weight: 'משקל',
      volume: 'נפח',
      length: 'אורך',
      area: 'שטח',
      time: 'זמן'
    };
    return types[type] || type;
  };

  const getTypeBadgeColor = (type) => {
    const colors = {
      quantity: 'bg-blue-100 text-blue-800',
      weight: 'bg-green-100 text-green-800',
      volume: 'bg-purple-100 text-purple-800',
      length: 'bg-orange-100 text-orange-800',
      area: 'bg-pink-100 text-pink-800',
      time: 'bg-gray-100 text-gray-800'
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  if (units.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>יחידות מידה</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            אין יחידות מידה מוגדרות
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>יחידות מידה</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-center">קוד</TableHead>
              <TableHead className="text-center">שם</TableHead>
              <TableHead className="text-center">סמל</TableHead>
              <TableHead className="text-center">סוג</TableHead>
              <TableHead className="text-center">סטטוס</TableHead>
              <TableHead className="text-center">פעולות</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {units.map((unit) => (
              <TableRow key={unit.id}>
                <TableCell className="text-center font-mono">{unit.code}</TableCell>
                <TableCell className="text-center font-medium">{unit.name}</TableCell>
                <TableCell className="text-center">{unit.symbol}</TableCell>
                <TableCell className="text-center">
                  <Badge className={getTypeBadgeColor(unit.type)}>
                    {getTypeLabel(unit.type)}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant={unit.is_active ? "default" : "secondary"}>
                    {unit.is_active ? "פעיל" : "לא פעיל"}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex gap-2 justify-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onEdit(unit)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent dir="rtl">
                        <AlertDialogHeader>
                          <AlertDialogTitle>מחיקת יחידת מידה</AlertDialogTitle>
                          <AlertDialogDescription>
                            האם אתה בטוח שברצונך למחוק את יחידת המידה "{unit.name}"?
                            פעולה זו אינה ניתנת לביטול.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>ביטול</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => onDelete(unit.id)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            מחק
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
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
