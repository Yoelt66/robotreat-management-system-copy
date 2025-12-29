import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Edit, Eye, Receipt, Trash2 } from "lucide-react";

const statusColors = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  paid: "bg-blue-100 text-blue-800",
};

const statusLabels = {
  pending: "ממתין לאישור",
  approved: "מאושר",
  rejected: "נדחה",
  paid: "שולם",
};

export default function ExpenseReturnList({ returns, loading, onEdit, onView, onDelete, currentUser }) {
  if (loading) {
    return <div className="text-center p-8">טוען החזרות הוצאות...</div>;
  }
  
  if (!returns || returns.length === 0) {
    return (
        <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Receipt className="h-12 w-12 text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900">לא נמצאו החזרות הוצאות</h3>
                <p className="text-gray-500 mt-1">צור החזרת הוצאות חדשה כדי להתחיל.</p>
            </CardContent>
        </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>רשימת החזרות הוצאות</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-center">מספר החזרה</TableHead>
              <TableHead className="text-center">תאריך הגשה</TableHead>
              <TableHead className="text-center">שם עובד</TableHead>
              <TableHead className="text-center">סה"כ סכום</TableHead>
              <TableHead className="text-center">פריטי הוצאה</TableHead>
              <TableHead className="text-center">סטטוס</TableHead>
              <TableHead className="text-center">מאושר על ידי</TableHead>
              <TableHead className="text-center">פעולות</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {returns.map(ret => (
              <TableRow key={ret.id}>
                <TableCell className="font-mono text-center">
                  <button onClick={() => onView(ret)} className="text-blue-600 hover:underline">
                    {ret.return_number}
                  </button>
                </TableCell>
                <TableCell className="text-center">
                  {ret.submission_date ? format(new Date(ret.submission_date), "dd/MM/yyyy") : '-'}
                </TableCell>
                <TableCell className="text-center">{ret.employee_name}</TableCell>
                <TableCell className="text-center font-medium">
                  ₪{ret.total_amount?.toFixed(2) || '0.00'}
                </TableCell>
                <TableCell className="text-center">{ret.expenses?.length || 0}</TableCell>
                <TableCell className="text-center">
                  <Badge className={statusColors[ret.status] || "bg-gray-100"}>
                    {statusLabels[ret.status] || ret.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  {ret.approved_by || '-'}
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex justify-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => onView(ret)} title="צפה בפרטים">
                      <Eye className="h-4 w-4" />
                    </Button>
                    {(currentUser?.role === 'admin' || ret.employee_email === currentUser?.email) && (
                      <Button variant="ghost" size="icon" onClick={() => onEdit(ret)} title="ערוך">
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                    {ret.status === 'pending' && (currentUser?.role === 'admin' || ret.employee_email === currentUser?.email) && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => onDelete(ret)}
                        className="text-red-500 hover:text-red-600"
                        title="מחק"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
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