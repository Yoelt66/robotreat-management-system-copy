import React, { useState, useEffect } from 'react';
import { Order } from "@/entities/Order";
import { Warehouse } from "@/entities/Warehouse";
import { DeliveryNote } from "@/entities/DeliveryNote";
import { SystemLog } from "@/entities/SystemLog";
import { User } from "@/entities/User";
import { getParts } from "@/functions/getParts";
import { updatePartStock } from "@/functions/updatePartStock";
import { toast } from "@/components/ui/use-toast";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { exportOrderToCsv } from '../components/export';
import { format } from 'date-fns';

import OrderList from '../components/orders/OrderList';
import ReceiveStockForm from '../components/orders/ReceiveStockForm';
import OrderDetailsModal from '../components/orders/OrderDetailsModal';
import PrintableOrder from '../components/orders/PrintableOrder';

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [temporaryOrders, setTemporaryOrders] = useState([]);
  const [parts, setParts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [isReceiving, setIsReceiving] = useState(false);
  const [receivingOrder, setReceivingOrder] = useState(null);
  const [viewingOrder, setViewingOrder] = useState(null);
  const [orderToPrint, setOrderToPrint] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    loadData();
    loadUser();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      console.log("Starting to load data...");
      
      // Test each entity individually
      console.log("Order entity:", Order);
      console.log("Part entity:", Part);
      console.log("Warehouse entity:", Warehouse);
      
      let ordersData = [];
      let partsData = [];
      let warehousesData = [];

      try {
        console.log("Loading orders...");
        ordersData = await Order.list("-created_date");
        console.log("Orders loaded:", ordersData.length);
      } catch (error) {
        console.error("Error loading orders:", error);
        toast({ variant: "destructive", title: "שגיאה בטעינת הזמנות" });
      }

      try {
        console.log("Loading parts...");
        partsData = await Part.list();
        console.log("Parts loaded:", partsData.length);
      } catch (error) {
        console.error("Error loading parts:", error);
        toast({ variant: "destructive", title: "שגיאה בטעינת פריטים" });
      }

      try {
        console.log("Loading warehouses...");
        warehousesData = await Warehouse.list();
        console.log("Warehouses loaded:", warehousesData.length);
      } catch (error) {
        console.error("Error loading warehouses:", error);
        toast({ variant: "destructive", title: "שגיאה בטעינת מחסנים" });
      }
      
      // Separate temporary (draft) orders from finalized orders
      const finalizedOrders = ordersData.filter(o => o.status !== 'draft');
      const tempOrders = ordersData.filter(o => o.status === 'draft');
      
      setOrders(finalizedOrders);
      setTemporaryOrders(tempOrders);
      setParts(partsData);
      setWarehouses(warehousesData);
    } catch (error) {
      console.error("Error loading data:", error);
      toast({ variant: "destructive", title: "שגיאה בטעינת נתונים" });
    } finally {
      setLoading(false);
    }
  };

  const loadUser = async () => {
    try {
        const user = await User.me();
        setCurrentUser(user);
    } catch (e) {
        console.error("Failed to load user", e);
    }
  };

  const handleOpenReceiveModal = (order) => {
    setReceivingOrder(order);
    setIsReceiving(true);
  };

  const handleCloseReceiveModal = () => {
    setReceivingOrder(null);
    setIsReceiving(false);
  };

  const handleDeleteTemporaryOrder = async (orderId) => {
    try {
      await Order.delete(orderId);
      toast({ title: "הזמנה זמנית נמחקה" });
      await loadData();
    } catch (error) {
      console.error("Error deleting temporary order:", error);
      toast({ variant: "destructive", title: "שגיאה במחיקת הזמנה זמנית" });
    }
  };

  const handleReceiveStock = async (deliveryNoteData, order) => {
    try {
      // Get supplier info for the delivery note
      const supplierNumber = order.supplier_number || order.supplier;
      const supplierName = order.supplier_name || order.supplier_name_display || order.supplier;

      // 1. Create the delivery note with the correct warehouse_id
      const newDeliveryNote = await DeliveryNote.create({
        note_number: deliveryNoteData.note_number,
        supplier_number: supplierNumber,
        supplier_name: supplierName,
        supplier: supplierName,
        delivery_date: deliveryNoteData.delivery_date,
        warehouse_id: deliveryNoteData.warehouse_id, // Use warehouse_id directly
        warehouse_name: deliveryNoteData.warehouse_name, // Also include warehouse name
        items: deliveryNoteData.items.filter(i => i.quantity > 0).map(item => ({
            part_sku: item.part_sku,
            part_name: item.part_name,
            quantity: item.quantity,
        })),
        notes: `From order ${order.order_number}`
      });
      toast({ title: "תעודת משלוח נוצרה" });

      // 2. Update stock levels directly in Part entity
      const targetWarehouse = warehouses.find(w => w.id === deliveryNoteData.warehouse_id);
      if (!targetWarehouse) {
        throw new Error(`Warehouse not found`);
      }

      // Process each item
      for (const item of deliveryNoteData.items) {
        if (item.quantity <= 0) continue;
        
        // Find the part
        const part = parts.find(p => p.sku === item.part_sku);
        if (!part) continue;
        
        // Update the warehouse quantity directly in the Part entity
        const currentQuantity = part[targetWarehouse.warehouse_id] || 0;
        const newQuantity = currentQuantity + item.quantity;
        
        // Update the part with new stock quantity
        await Part.update(part.id, {
          [targetWarehouse.warehouse_id]: newQuantity,
          last_count_date: deliveryNoteData.delivery_date // Update last count date
        });
      }

      toast({ title: "המלאי עודכן בהצלחה" });

      // 3. Update the order
      const updatedItems = order.items.map(orderItem => {
        const receivedItem = deliveryNoteData.items.find(dnItem => dnItem.part_sku === orderItem.part_sku);
        return {
          ...orderItem,
          received_quantity: (orderItem.received_quantity || 0) + (receivedItem?.quantity || 0)
        };
      });

      const allItemsReceived = updatedItems.every(item => item.received_quantity >= item.quantity);
      const newStatus = allItemsReceived ? 'completed' : 'partially_received';

      await Order.update(order.id, {
        items: updatedItems,
        status: newStatus,
        delivery_note_numbers: [...(order.delivery_note_numbers || []), newDeliveryNote.note_number]
      });
      toast({ title: "ההזמנה עודכנה" });

      handleCloseReceiveModal();
      await loadData(); // Reload all data
      
    } catch (error) {
      console.error("Error receiving stock:", error);
      toast({ variant: "destructive", title: "שגיאה בקליטת סחורה", description: error.message });
    }
  };

  const handlePrintOrder = (order) => {
    setOrderToPrint(order);
    setTimeout(() => {
      window.print();
      setOrderToPrint(null);
    }, 100);
  };

  const handleExportCsv = (order) => {
    exportOrderToCsv(order);
  };

  const handleSendToSupplier = async (order, shouldExport = false) => {
    try {
      // Export to Excel if requested
      if (shouldExport) {
        exportOrderToExcel(order);
      }
      
      // Update order status to 'ordered'
      await Order.update(order.id, {
        status: 'ordered'
      });
      
      toast({ title: "ההזמנה נשלחה לספק ואושרה" });
      await loadData();
    } catch (error) {
      console.error("Error sending order to supplier:", error);
      toast({ variant: "destructive", title: "שגיאה בשליחת הזמנה לספק" });
    }
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

  const handleEditOrder = (order) => {
    // For draft orders, navigate to edit with tempOrderId
    if (order.status === 'draft') {
      window.location.href = createPageUrl(`NewOrders?tempOrderId=${order.id}`);
    } else {
      // For confirmed orders, convert back to draft and then edit
      handleConvertToDraft(order);
    }
  };

  const handleConvertToDraft = async (order) => {
    try {
      // Convert order back to draft status for editing
      await Order.update(order.id, {
        status: 'draft'
      });
      
      toast({ title: "ההזמנה הוחזרה לעריכה" });
      
      // Navigate to edit page
      window.location.href = createPageUrl(`NewOrders?tempOrderId=${order.id}`);
    } catch (error) {
      console.error("Error converting order to draft:", error);
      toast({ variant: "destructive", title: "שגיאה בהחזרת הזמנה לעריכה" });
    }
  };

  return (
    <>
      <style>
        {`
          @media print {
            body > div:first-child { /* Hide the main app content */
              display: none;
            }
            .printable-order-container { /* Show the printable content */
              display: block !important;
              margin: 0;
              padding: 0;
              width: 100%;
              height: auto;
            }
          }
        `}
      </style>
      <div className="p-6" dir="rtl">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">רשימת הזמנות</h1>
            <Link to={createPageUrl("NewOrders")}>
              <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">
                + הזמנה חדשה
              </button>
            </Link>
          </div>
          
          <OrderList 
            orders={orders}
            temporaryOrders={temporaryOrders}
            onReceiveStock={handleOpenReceiveModal}
            onDeleteTemporaryOrder={handleDeleteTemporaryOrder}
            onViewOrder={setViewingOrder}
            onPrint={handlePrintOrder}
            onExportCsv={handleExportCsv}
            onSendToSupplier={handleSendToSupplier}
            onEditOrder={handleEditOrder}
            loading={loading}
          />

          {isReceiving && receivingOrder && (
            <ReceiveStockForm
              order={receivingOrder}
              warehouses={warehouses}
              onSubmit={handleReceiveStock}
              onCancel={handleCloseReceiveModal}
            />
          )}

          {viewingOrder && (
            <OrderDetailsModal
              order={viewingOrder}
              onClose={() => setViewingOrder(null)}
            />
          )}
        </div>
      </div>
      {orderToPrint && ( // Conditionally render PrintableOrder only when an order is selected for printing
        <div className="hidden printable-order-container">
          <PrintableOrder order={orderToPrint} />
        </div>
      )}
    </>
  );
}