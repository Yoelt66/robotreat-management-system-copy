
import React from 'react';
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { ExternalLink } from "lucide-react";

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

const purchaseTypes = {
  tools: "כלי עבודה",
  fuel: "דלק",
  parts: "חלקי חילוף",
  office_supplies: "ציוד משרד",
  travel: "נסיעות",
  meals: "ארוחות",
  accommodation: "לינה",
  maintenance: "תחזוקה",
  other: "אחר"
};

const safeFormatDate = (dateStr) => {
    if (!dateStr) return ' - ';
    try {
        return format(new Date(dateStr), 'dd/MM/yyyy');
    } catch {
        return 'תאריך לא חוקי';
    }
};

export default function ExpenseReturnDetailsModal({ expenseReturn, onClose }) {
  if (!expenseReturn) return null;

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-xl">
            החזרת הוצאות {expenseReturn.return_number}
          </DialogTitle>
          <DialogDescription>
            {expenseReturn.return_date && (
              <span className="font-medium">
                תאריך החזר: {safeFormatDate(expenseReturn.return_date)} | 
              </span>
            )}
            <span className="font-medium ml-2">
              עובד: {expenseReturn.employee_name}
            </span>
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Header Info */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
            <div>
              <div className="text-sm text-gray-500">תאריך הגשה</div>
              <div className="font-medium">
                {safeFormatDate(expenseReturn.submission_date)}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500">סטטוס</div>
              <Badge className={statusColors[expenseReturn.status]}>
                {statusLabels[expenseReturn.status]}
              </Badge>
            </div>
            <div>
              <div className="text-sm text-gray-500">סה"כ סכום</div>
              <div className="font-bold text-lg">₪{expenseReturn.total_amount?.toFixed(2) || '0.00'}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">מאושר על ידי</div>
              <div className="font-medium">{expenseReturn.approved_by || 'טרם אושר'}</div>
            </div>
          </div>

          {/* Expenses Table */}
          <Card>
            <CardHeader>
              <CardTitle>פירוט הוצאות</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>תאריך</TableHead>
                    <TableHead>מספר חשבונית</TableHead>
                    <TableHead>שם העסק</TableHead>
                    <TableHead>סוג רכישה</TableHead>
                    <TableHead>סכום</TableHead>
                    <TableHead>תיאור</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenseReturn.expenses?.map((expense, index) => (
                    <TableRow key={index}>
                      <TableCell>{safeFormatDate(expense.invoice_date)}</TableCell>
                      <TableCell className="font-mono">{expense.invoice_number || '-'}</TableCell>
                      <TableCell>{expense.business_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {purchaseTypes[expense.purchase_type] || expense.purchase_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">₪{expense.amount.toFixed(2)}</TableCell>
                      <TableCell>{expense.description || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Payment Info */}
          {(expenseReturn.bank_reference || expenseReturn.return_date) && (
            <Card>
              <CardHeader>
                <CardTitle>פרטי תשלום</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {expenseReturn.bank_reference && (
                    <div>
                      <div className="text-sm text-gray-500">מספר אסמכתא בנק</div>
                      <div className="font-mono">{expenseReturn.bank_reference}</div>
                    </div>
                  )}
                  {expenseReturn.return_date && (
                    <div>
                      <div className="text-sm text-gray-500">תאריך החזר</div>
                      <div>{safeFormatDate(expenseReturn.return_date)}</div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Receipts */}
          {expenseReturn.receipt_urls && expenseReturn.receipt_urls.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>קבלות וחשבוניות</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {expenseReturn.receipt_urls.map((url, index) => (
                    <a 
                      key={index}
                      href={url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                      קובץ {index + 1}
                    </a>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Notes */}
          {expenseReturn.notes && (
            <Card>
              <CardHeader>
                <CardTitle>הערות</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap">{expenseReturn.notes}</p>
              </CardContent>
            </Card>
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
