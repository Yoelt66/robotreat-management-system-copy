
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Package, Truck, Edit, Trash2, AlertTriangle, Printer, Download, Send, FileSpreadsheet, Eye } from "lucide-react";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const statusMap = {
  draft: { label: "טיוטה", className: "bg-gray-100 text-gray-800" },
  הוקם: { label: "הוקם", className: "bg-purple-100 text-purple-800" },
  ordered: { label: "הוזמן", className: "bg-blue-100 text-blue-800" },
  partially_received: { label: "התקבל חלקית", className: "bg-yellow-100 text-yellow-800" },
  completed: { label: "הושלם", className: "bg-green-100 text-green-800" },
  cancelled: { label: "בוטל", className: "bg-red-100 text-red-800" },
};

export default function OrderList({
  orders,
  temporaryOrders,
  onReceiveStock,
  onDeleteTemporaryOrder,
  onViewOrder,
  onPrint,
  onExportCsv,
  onSendToSupplier,
  onEditOrder,
  loading
}) {
  if (loading) {
    return <Card><CardContent className="p-6 text-center">טוען הזמנות...</CardContent></Card>;
  }

  const getProgress = (items) => {
    const totalQty = items.reduce((sum, item) => sum + item.quantity, 0);
    const receivedQty = items.reduce((sum, item) => sum + (item.received_quantity || 0), 0);
    return { receivedQty, totalQty };
  };

  const calculateOrderTotal = (order) => {
    if (!order.items || !Array.isArray(order.items)) return { total: 0, currency: 'ILS' };

    let total = 0;
    let currency = 'ILS';

    for (const item of order.items) {
      const itemCost = (item.cost_price || 0) * (item.quantity || 0);
      total += itemCost;
      // Use the first non-default currency found
      if (item.currency && item.currency !== 'ILS' && currency === 'ILS') {
        currency = item.currency;
      }
    }

    return { total, currency };
  };

  const formatOrderNumber = (orderNumber) => {
    if (orderNumber && orderNumber.startsWith('TEMP-')) {
      return `זמני-${orderNumber.split('-')[1]?.slice(-4) || ''}`;
    }
    return orderNumber;
  };

  const handleSendToSupplierWithDialog = (order) => {
    const shouldExport = window.confirm("האם ברצונך לייצא את ההזמנה לאקסל לפני השליחה?");
    onSendToSupplier(order, shouldExport);
  };

  const exportOrderToExcel = (order) => {
    if (!order || !order.items) return;

    // Create CSV content with English headers
    const headers = ['SKU', 'Item Name', 'Quantity'];
    const rows = order.items.map(item => [
      `"${item.part_sku || ''}"`,
      `"${item.part_name || ''}"`,
      item.quantity || 0
    ]);

    let csvContent = "\uFEFF"; // BOM for Excel UTF-8 recognition
    csvContent += headers.join(",") + "\r\n";
    csvContent += rows.map(row => row.join(",")).join("\r\n");

    // Add order details at the end
    csvContent += "\r\n\r\n";
    csvContent += `Order Number,"${order.order_number}"\r\n`;
    csvContent += `Supplier,"${order.supplier_name || order.supplier}"\r\n`;
    csvContent += `Date,"${format(new Date(order.order_date || order.created_date), 'dd/MM/yyyy')}"\r\n`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `order_${order.order_number || 'temp'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Group orders by status
  const groupedOrders = {
    draft: temporaryOrders || [],
    הוקם: orders.filter(o => o.status === 'הוקם'),
    ordered: orders.filter(o => o.status === 'ordered'),
    partially_received: orders.filter(o => o.status === 'partially_received'),
    completed: orders.filter(o => o.status === 'completed'),
    cancelled: orders.filter(o => o.status === 'cancelled')
  };

  const renderOrderTable = (orderList, statusKey) => {
    if (orderList.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Package className="h-8 w-8 text-gray-300 mb-2" />
          <p className="text-gray-500">לא נמצאו הזמנות</p>
        </div>
      );
    }

    return (
      <div className="max-h-48 overflow-y-auto border rounded-md">
        <Table>
          <TableHeader className="sticky top-0 bg-gray-50 z-10">
            <TableRow className="h-8">
              <TableHead className="py-1 text-center text-xs">תאריך</TableHead>
              <TableHead className="py-1 text-center text-xs">מספר הזמנה</TableHead>
              <TableHead className="py-1 text-center text-xs">ספק</TableHead>
              <TableHead className="py-1 text-center text-xs">התקדמות</TableHead>
              <TableHead className="py-1 text-center text-xs">עלות כוללת</TableHead>
              <TableHead className="py-1 text-center text-xs">פעולות</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orderList.map(order => {
              const { receivedQty, totalQty } = getProgress(order.items);
              const { total, currency } = calculateOrderTotal(order);
              
              return (
                <TableRow key={order.id} className="h-10">
                  <TableCell className="py-1 text-center text-xs">
                    {format(new Date(order.order_date || order.created_date), 'dd/MM/yyyy')}
                  </TableCell>
                  <TableCell className="py-1 text-center text-xs">
                    <button onClick={() => onViewOrder(order)} className="text-blue-600 hover:underline">
                      <Badge variant="outline" className={statusKey === 'draft' ? "bg-yellow-100 text-yellow-800 cursor-pointer" : "cursor-pointer"}>
                        {formatOrderNumber(order.order_number)}
                      </Badge>
                    </button>
                  </TableCell>
                  <TableCell className="py-1 text-center text-xs">{order.supplier_name || order.supplier || 'לא צוין'}</TableCell>
                  <TableCell className="py-1 text-center">
                    {statusKey === 'draft' ? (
                      <span className="text-xs">{order.items?.length || 0} פריטים</span>
                    ) : (
                      <div className="text-xs inline-block">
                        {receivedQty} / {totalQty}
                        <div className="w-16 bg-gray-200 rounded-full h-1 mt-1 mx-auto">
                          <div
                            className="bg-blue-500 h-1 rounded-full"
                            style={{ width: `${totalQty > 0 ? (receivedQty / totalQty) * 100 : 0}%` }}
                          ></div>
                        </div>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="py-1 text-center text-xs font-mono">
                    {total.toFixed(2)} {currency}
                  </TableCell>
                  <TableCell className="py-1 text-center">
                    <TooltipProvider>
                      <div className="flex gap-1 justify-center">
                        {/* Actions based on status */}
                        {statusKey === 'draft' && (
                          <>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Link to={createPageUrl(`NewOrders?tempOrderId=${order.id}`)}>
                                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs">
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                </Link>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>המשך עריכת הזמנה</p>
                              </TooltipContent>
                            </Tooltip>
                            <AlertDialog>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <AlertDialogTrigger asChild>
                                    <Button size="sm" variant="destructive" className="h-7 px-2 text-xs">
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </AlertDialogTrigger>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>מחק הזמנה זמנית</p>
                                </TooltipContent>
                              </Tooltip>
                              <AlertDialogContent dir="rtl">
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="flex items-center gap-2">
                                    <AlertTriangle className="h-5 w-5 text-red-500" />
                                    מחיקת הזמנה זמנית
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    האם אתה בטוח שברצונך למחוק את ההזמנה הזמנית?
                                    פעולה זו לא ניתנת לביטול.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>ביטול</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => onDeleteTemporaryOrder(order.id)}
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    מחק הזמנה
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </>
                        )}

                        {statusKey === 'הוקם' && (
                          <>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => onEditOrder && onEditOrder(order)}>
                                  <Edit className="h-3 w-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>המשך עריכת הזמנה</p>
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => handleSendToSupplierWithDialog(order)}>
                                  <Send className="h-3 w-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>שלח הזמנה לספק</p>
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => exportOrderToExcel(order)}>
                                  <FileSpreadsheet className="h-3 w-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>ייצא לאקסל</p>
                              </TooltipContent>
                            </Tooltip>
                            <AlertDialog>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <AlertDialogTrigger asChild>
                                    <Button size="sm" variant="destructive" className="h-7 px-2 text-xs">
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </AlertDialogTrigger>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>מחק הזמנה</p>
                                </TooltipContent>
                              </Tooltip>
                              <AlertDialogContent dir="rtl">
                                <AlertDialogHeader>
                                  <AlertDialogTitle>מחיקת הזמנה</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    האם אתה בטוח שברצונך למחוק את ההזמנה? פעולה זו לא ניתנת לביטול.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>ביטול</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => onDeleteTemporaryOrder && onDeleteTemporaryOrder(order.id)}
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    מחק הזמנה
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </>
                        )}

                        {statusKey === 'ordered' && (
                          <>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => onReceiveStock(order)}>
                                  <Truck className="h-3 w-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>קלוט סחורה</p>
                              </TooltipContent>
                            </Tooltip>
                          </>
                        )}

                        {statusKey === 'partially_received' && (
                          <>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => onReceiveStock(order)}>
                                  <Truck className="h-3 w-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>קלוט סחורה נוספת</p>
                              </TooltipContent>
                            </Tooltip>
                          </>
                        )}

                        {/* Common actions for all statuses */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => onViewOrder(order)}>
                              <Eye className="h-3 w-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>צפה בפרטי הזמנה</p>
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => onPrint(order)}>
                              <Printer className="h-3 w-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>הדפס הזמנה</p>
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => onExportCsv(order)}>
                              <Download className="h-3 w-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>ייצא ל-CSV</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </TooltipProvider>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Temporary Orders */}
      {groupedOrders.draft.length > 0 && (
        <Card className="border-yellow-200">
          <CardHeader className="bg-yellow-50 py-3">
            <CardTitle className="text-yellow-800 flex items-center gap-2 text-lg">
              <AlertTriangle className="h-4 w-4" />
              הזמנות זמניות ({groupedOrders.draft.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {renderOrderTable(groupedOrders.draft, 'draft')}
          </CardContent>
        </Card>
      )}

      {/* הוקם Orders */}
      {groupedOrders.הוקם.length > 0 && (
        <Card className="border-purple-200">
          <CardHeader className="bg-purple-50 py-3">
            <CardTitle className="text-purple-800 flex items-center gap-2 text-lg">
              הזמנות שהוקמו ({groupedOrders.הוקם.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {renderOrderTable(groupedOrders.הוקם, 'הוקם')}
          </CardContent>
        </Card>
      )}

      {/* Ordered Orders */}
      {groupedOrders.ordered.length > 0 && (
        <Card className="border-blue-200">
          <CardHeader className="bg-blue-50 py-3">
            <CardTitle className="text-blue-800 flex items-center gap-2 text-lg">
              הזמנות שנשלחו לספק ({groupedOrders.ordered.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {renderOrderTable(groupedOrders.ordered, 'ordered')}
          </CardContent>
        </Card>
      )}

      {/* Partially Received Orders */}
      {groupedOrders.partially_received.length > 0 && (
        <Card className="border-yellow-200">
          <CardHeader className="bg-yellow-50 py-3">
            <CardTitle className="text-yellow-800 flex items-center gap-2 text-lg">
              הזמנות שהתקבלו חלקית ({groupedOrders.partially_received.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {renderOrderTable(groupedOrders.partially_received, 'partially_received')}
          </CardContent>
        </Card>
      )}

      {/* Completed Orders */}
      {groupedOrders.completed.length > 0 && (
        <Card className="border-green-200">
          <CardHeader className="bg-green-50 py-3">
            <CardTitle className="text-green-800 flex items-center gap-2 text-lg">
              הזמנות שהושלמו ({groupedOrders.completed.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {renderOrderTable(groupedOrders.completed, 'completed')}
          </CardContent>
        </Card>
      )}

      {/* Cancelled Orders */}
      {groupedOrders.cancelled.length > 0 && (
        <Card className="border-red-200">
          <CardHeader className="bg-red-50 py-3">
            <CardTitle className="text-red-800 flex items-center gap-2 text-lg">
              הזמנות שבוטלו ({groupedOrders.cancelled.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {renderOrderTable(groupedOrders.cancelled, 'cancelled')}
          </CardContent>
        </Card>
      )}

      {/* Show message if no orders exist */}
      {Object.values(groupedOrders).every(arr => arr.length === 0) && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Package className="h-12 w-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900">אין הזמנות</h3>
            <p className="text-gray-500 mt-1">הזמנות שתיצור יופיעו כאן.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
