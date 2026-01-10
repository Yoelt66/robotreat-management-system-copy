import React, { useState, useEffect } from "react";
import { Invoice } from "@/entities/Invoice";
import { Supplier } from "@/entities/Supplier";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Upload, FileText, Pencil, Trash2, Loader2, CheckCircle, AlertCircle, ExternalLink } from "lucide-react";
import { format, addDays } from "date-fns";
import { toast } from "sonner";

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [deletingInvoice, setDeletingInvoice] = useState(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterSupplier, setFilterSupplier] = useState("all");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [invoicesData, suppliersData] = await Promise.all([
        Invoice.list("-created_date"),
        Supplier.list(),
      ]);
      setInvoices(invoicesData);
      setSuppliers(suppliersData);
    } catch (error) {
      console.error("Failed to load data:", error);
      toast.error("שגיאה בטעינת הנתונים");
    } finally {
      setLoading(false);
    }
  };

  const analyzeInvoice = async (fileUrl) => {
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `נתח את החשבונית המצורפת וחלץ את הפרטים הבאים:
1. מספר חשבונית
2. שם הספק/העסק
3. תאריך החשבונית (בפורמט YYYY-MM-DD)
4. סכום כולל לתשלום
5. מטבע (ILS/USD/EUR/GBP)

אם לא ניתן לזהות שדה מסוים, השאר אותו ריק או null.`,
        file_urls: [fileUrl],
        response_json_schema: {
          type: "object",
          properties: {
            invoice_number: { type: "string" },
            supplier_name: { type: "string" },
            invoice_date: { type: "string" },
            amount: { type: "number" },
            currency: { type: "string" },
          },
        },
      });

      return result;
    } catch (error) {
      console.error("Invoice analysis error:", error);
      return null;
    }
  };

  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files);
    if (!files.length) return;

    setUploading(true);

    try {
      toast.info(`מעלה ומנתח ${files.length} חשבוניות...`);

      const results = await Promise.all(
        files.map(async (file) => {
          try {
            const { file_url } = await base44.integrations.Core.UploadFile({ file });
            const analysisResult = await analyzeInvoice(file_url);

            return { file_url, file_name: file.name, analysisResult };
          } catch (error) {
            console.error("Error processing file:", error);
            return { file_url: null, file_name: file.name, analysisResult: null };
          }
        })
      );

      const newInvoices = results
        .filter((r) => r.analysisResult)
        .map(({ file_url, file_name, analysisResult }) => {
          const { invoice_number, supplier_name, invoice_date, amount, currency } = analysisResult;

          const invoiceDateObj = invoice_date ? new Date(invoice_date) : new Date();
          const dueDate = format(addDays(invoiceDateObj, 30), "yyyy-MM-dd");

          // Find supplier number if exists
          const supplier = suppliers.find(
            (s) => s.name?.toLowerCase() === supplier_name?.toLowerCase()
          );

          return {
            invoice_number: invoice_number || "",
            supplier_number: supplier?.supplier_number || "",
            supplier_name: supplier_name || "",
            invoice_date: invoice_date || format(new Date(), "yyyy-MM-dd"),
            amount: amount || 0,
            currency: currency || "ILS",
            status: "open",
            due_date: dueDate,
            payment_date: "",
            invoice_file_url: file_url,
            invoice_file_name: file_name,
            notes: "",
          };
        });

      for (const invoice of newInvoices) {
        await Invoice.create(invoice);
      }

      toast.success(`${newInvoices.length} חשבוניות נוספו בהצלחה!`);
      await loadData();
    } catch (error) {
      console.error("File upload error:", error);
      toast.error("שגיאה בהעלאת החשבוניות");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const handleEdit = (invoice) => {
    setEditingInvoice(invoice);
    setShowForm(true);
  };

  const handleDelete = async () => {
    if (!deletingInvoice) return;

    try {
      await Invoice.delete(deletingInvoice.id);
      toast.success("החשבונית נמחקה בהצלחה");
      setDeletingInvoice(null);
      await loadData();
    } catch (error) {
      console.error("Failed to delete invoice:", error);
      toast.error("שגיאה במחיקת החשבונית");
    }
  };

  const handleFormSubmit = async (formData) => {
    try {
      if (editingInvoice) {
        await Invoice.update(editingInvoice.id, formData);
        toast.success("החשבונית עודכנה בהצלחה");
      } else {
        await Invoice.create(formData);
        toast.success("החשבונית נוצרה בהצלחה");
      }
      setShowForm(false);
      setEditingInvoice(null);
      await loadData();
    } catch (error) {
      console.error("Failed to save invoice:", error);
      toast.error("שגיאה בשמירת החשבונית");
    }
  };

  const filteredInvoices = invoices.filter((inv) => {
    const statusMatch = filterStatus === "all" || inv.status === filterStatus;
    const supplierMatch =
      filterSupplier === "all" || inv.supplier_number === filterSupplier;
    return statusMatch && supplierMatch;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-800">ניהול חשבוניות</h1>
        <div className="flex gap-2">
          <input
            type="file"
            accept="image/*,.pdf"
            multiple
            onChange={handleFileUpload}
            disabled={uploading}
            className="hidden"
            id="invoice-upload"
          />
          <label htmlFor="invoice-upload">
            <Button disabled={uploading} asChild>
              <span>
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                    מעלה...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 ml-2" />
                    העלה חשבוניות
                  </>
                )}
              </span>
            </Button>
          </label>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="כל הסטטוסים" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הסטטוסים</SelectItem>
                <SelectItem value="open">פתוחות</SelectItem>
                <SelectItem value="paid">שולמו</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterSupplier} onValueChange={setFilterSupplier}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="כל הספקים" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הספקים</SelectItem>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.supplier_number}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>מספר חשבונית</TableHead>
                <TableHead>ספק</TableHead>
                <TableHead>תאריך חשבונית</TableHead>
                <TableHead>סכום</TableHead>
                <TableHead>סטטוס</TableHead>
                <TableHead>תאריך תשלום / לתשלום</TableHead>
                <TableHead>קובץ</TableHead>
                <TableHead className="text-center">פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInvoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-slate-500 py-8">
                    <FileText className="h-12 w-12 mx-auto mb-2 text-slate-300" />
                    אין חשבוניות להצגה
                  </TableCell>
                </TableRow>
              ) : (
                filteredInvoices.map((invoice) => (
                  <TableRow
                    key={invoice.id}
                    className={
                      invoice.status === "paid"
                        ? "bg-green-50"
                        : "bg-red-50"
                    }
                  >
                    <TableCell className="font-medium">
                      {invoice.invoice_number}
                    </TableCell>
                    <TableCell>{invoice.supplier_name}</TableCell>
                    <TableCell>
                      {invoice.invoice_date
                        ? format(new Date(invoice.invoice_date), "dd/MM/yyyy")
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {invoice.currency === "ILS" ? "₪" : invoice.currency}
                      {invoice.amount?.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          invoice.status === "paid" ? "default" : "secondary"
                        }
                        className={
                          invoice.status === "paid"
                            ? "bg-green-600"
                            : "bg-red-600"
                        }
                      >
                        {invoice.status === "paid" ? (
                          <>
                            <CheckCircle className="h-3 w-3 ml-1" />
                            שולם
                          </>
                        ) : (
                          <>
                            <AlertCircle className="h-3 w-3 ml-1" />
                            פתוח
                          </>
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {invoice.status === "paid"
                        ? invoice.payment_date
                          ? format(new Date(invoice.payment_date), "dd/MM/yyyy")
                          : "-"
                        : invoice.due_date
                        ? format(new Date(invoice.due_date), "dd/MM/yyyy")
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {invoice.invoice_file_url && (
                        <a
                          href={invoice.invoice_file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 inline-flex items-center gap-1"
                          title={invoice.invoice_file_name || "צפה בקובץ"}
                        >
                          <FileText className="h-4 w-4" />
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(invoice)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-500 hover:text-red-600"
                          onClick={() => setDeletingInvoice(invoice)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle>
              {editingInvoice ? "עריכת חשבונית" : "חשבונית חדשה"}
            </DialogTitle>
          </DialogHeader>
          <InvoiceForm
            invoice={editingInvoice}
            suppliers={suppliers}
            onSubmit={handleFormSubmit}
            onCancel={() => {
              setShowForm(false);
              setEditingInvoice(null);
            }}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deletingInvoice}
        onOpenChange={() => setDeletingInvoice(null)}
      >
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>אישור מחיקה</AlertDialogTitle>
            <AlertDialogDescription>
              האם אתה בטוח שברצונך למחוק את החשבונית "
              {deletingInvoice?.invoice_number}"? פעולה זו אינה ניתנת לביטול.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              מחק
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function InvoiceForm({ invoice, suppliers, onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    invoice_number: "",
    supplier_number: "",
    supplier_name: "",
    invoice_date: format(new Date(), "yyyy-MM-dd"),
    amount: 0,
    currency: "ILS",
    status: "open",
    payment_date: "",
    due_date: format(addDays(new Date(), 30), "yyyy-MM-dd"),
    notes: "",
  });

  useEffect(() => {
    if (invoice) {
      setFormData(invoice);
    }
  }, [invoice]);

  const handleSupplierChange = (supplierNumber) => {
    const supplier = suppliers.find((s) => s.supplier_number === supplierNumber);
    setFormData({
      ...formData,
      supplier_number: supplierNumber,
      supplier_name: supplier?.name || "",
    });
  };

  const handleStatusChange = (status) => {
    const updates = { status };
    if (status === "paid" && !formData.payment_date) {
      updates.payment_date = format(new Date(), "yyyy-MM-dd");
    }
    setFormData({ ...formData, ...updates });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>מספר חשבונית *</Label>
          <Input
            value={formData.invoice_number}
            onChange={(e) =>
              setFormData({ ...formData, invoice_number: e.target.value })
            }
            required
          />
        </div>
        <div className="space-y-2">
          <Label>ספק</Label>
          <Select
            value={formData.supplier_number}
            onValueChange={handleSupplierChange}
          >
            <SelectTrigger>
              <SelectValue placeholder="בחר ספק" />
            </SelectTrigger>
            <SelectContent>
              {suppliers.map((s) => (
                <SelectItem key={s.id} value={s.supplier_number}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>תאריך חשבונית *</Label>
          <Input
            type="date"
            value={formData.invoice_date}
            onChange={(e) =>
              setFormData({ ...formData, invoice_date: e.target.value })
            }
            required
          />
        </div>
        <div className="space-y-2">
          <Label>סכום *</Label>
          <Input
            type="number"
            step="0.01"
            value={formData.amount}
            onChange={(e) =>
              setFormData({ ...formData, amount: parseFloat(e.target.value) })
            }
            required
          />
        </div>
        <div className="space-y-2">
          <Label>מטבע</Label>
          <Select
            value={formData.currency}
            onValueChange={(value) =>
              setFormData({ ...formData, currency: value })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ILS">₪ שקל</SelectItem>
              <SelectItem value="USD">$ דולר</SelectItem>
              <SelectItem value="EUR">€ יורו</SelectItem>
              <SelectItem value="GBP">£ לירה</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>סטטוס</Label>
          <Select value={formData.status} onValueChange={handleStatusChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">פתוח</SelectItem>
              <SelectItem value="paid">שולם</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {formData.status === "paid" && (
          <div className="space-y-2">
            <Label>תאריך תשלום</Label>
            <Input
              type="date"
              value={formData.payment_date}
              onChange={(e) =>
                setFormData({ ...formData, payment_date: e.target.value })
              }
            />
          </div>
        )}
        {formData.status === "open" && (
          <div className="space-y-2">
            <Label>תאריך לתשלום</Label>
            <Input
              type="date"
              value={formData.due_date}
              onChange={(e) =>
                setFormData({ ...formData, due_date: e.target.value })
              }
            />
          </div>
        )}
      </div>
      <div className="space-y-2">
        <Label>הערות</Label>
        <Input
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          ביטול
        </Button>
        <Button type="submit">שמור</Button>
      </div>
    </form>
  );
}