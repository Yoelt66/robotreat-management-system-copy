
import React, { useState, useEffect } from "react";
import { Part } from "@/entities/Part";
import { Warehouse } from "@/entities/Warehouse";
import { Order } from "@/entities/Order";
import { toast } from "@/components/ui/use-toast";
import SuggestedItemsList from "../components/orders/SuggestedItemsList";
import NewOrderForm from "../components/orders/NewOrderForm";
import StockViewModal from "../components/orders/StockViewModal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { exportOrderToCsv } from '../components/export';
import PrintableOrder from '../components/orders/PrintableOrder';
import { createPageUrl } from "@/utils";

export default function NewOrders() {
  const [suggestedItems, setSuggestedItems] = useState([]);
  const [orderItems, setOrderItems] = useState([]);
  const [allParts, setAllParts] = useState([]);
  const [allWarehouses, setAllWarehouses] = useState([]);
  const [allOrders, setAllOrders] = useState([]);
  const [selectedPart, setSelectedPart] = useState(null);
  const [currentOrder, setCurrentOrder] = useState(null);
  const [createdOrder, setCreatedOrder] = useState(null);
  const [orderToPrint, setOrderToPrint] = useState(null);
  const [loading, setLoading] = useState(true);
  const [supplier, setSupplier] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tempOrderId = urlParams.get('tempOrderId');
    loadData(tempOrderId);
  }, []);

  useEffect(() => {
    // Auto-save temporary order when items, supplier, or notes change, but only if not loading
    // and there are items to save, or if an order already exists (for supplier/notes changes)
    if (!loading && (orderItems.length > 0 || currentOrder)) {
      saveTemporaryOrder();
    }
  }, [orderItems, supplier, notes, loading]);

  const loadData = async (tempOrderId = null) => {
    setLoading(true);
    try {
      const [parts, warehouses, orders] = await Promise.all([
        Part.list(),
        Warehouse.list(),
        Order.list(),
      ]);

      setAllParts(parts);
      setAllWarehouses(warehouses);
      setAllOrders(orders);

      // If we are editing a temporary order, load its data
      if (tempOrderId) {
        const tempOrder = await Order.get(tempOrderId);
        if (tempOrder && tempOrder.status === 'draft') {
          setCurrentOrder(tempOrder);
          setSupplier(tempOrder.supplier || '');
          setNotes(tempOrder.notes || '');

          // Reconstruct orderItems with full part details
          const loadedOrderItems = tempOrder.items.map(item => {
            const partDetails = parts.find(p => p.sku === item.part_sku);
            return {
              ...(partDetails || {}), // Spread existing part details
              quantity: item.quantity,
              sku: item.part_sku,
              name: item.part_name,
              // Ensure cost_price and currency are taken from the loaded item if available,
              // otherwise from partDetails, or default.
              cost_price: item.cost_price !== undefined ? item.cost_price : (partDetails ? partDetails.cost_price : 0),
              cost_currency: item.currency || (partDetails ? partDetails.cost_currency : 'ILS'),
            };
          }).filter(Boolean); // Filter out any items where part might be deleted
          setOrderItems(loadedOrderItems);
        }
      }

      // Calculate quantities on order
      const onOrderMap = new Map();
      const activeOrders = orders.filter(o => o.status === 'ordered' || o.status === 'partially_received');

      for (const order of activeOrders) {
        for (const item of order.items) {
          const remainingToReceive = (item.quantity || 0) - (item.received_quantity || 0);
          if (remainingToReceive > 0) {
            const currentOnOrder = onOrderMap.get(item.part_sku) || 0;
            onOrderMap.set(item.part_sku, currentOnOrder + remainingToReceive);
          }
        }
      }

      const mainWarehouse = warehouses.find(w => w.number === 1);
      if (!mainWarehouse) {
        setSuggestedItems([]);
        setLoading(false);
        return;
      }

      // Get low stock parts using the main warehouse stock data directly from Part entity
      const lowStockParts = parts
        .filter(part => {
          // Access current stock directly from part object using warehouse_id
          const currentStock = part[mainWarehouse.warehouse_id] || 0;
          const quantityOnOrder = onOrderMap.get(part.sku) || 0;
          const minimumStock = part.minimum_stock || 0;
          // Suggest if effective stock (current + on order) is less than minimum
          return minimumStock > 0 && (currentStock + quantityOnOrder) < minimumStock;
        })
        .map(part => ({
          ...part,
          // Access current stock directly from part object using warehouse_id
          current_stock: part[mainWarehouse.warehouse_id] || 0,
          quantity_on_order: onOrderMap.get(part.sku) || 0
        }));

      setSuggestedItems(lowStockParts);
    } catch (error) {
      console.error("Error loading data for ordering:", error);
      toast({ variant: "destructive", title: "שגיאה בטעינת נתונים" });
    } finally {
      setLoading(false);
    }
  };

  const saveTemporaryOrder = async () => {
    try {
      const orderDetails = {
        supplier: supplier,
        notes: notes,
        status: 'draft',
        order_date: new Date().toISOString().split('T')[0],
        items: orderItems.map(item => ({
          part_sku: item.sku,
          part_name: item.name,
          quantity: item.quantity,
          cost_price: item.cost_price || 0,
          currency: item.cost_currency || 'ILS',
        })),
      };

      if (currentOrder) {
        await Order.update(currentOrder.id, orderDetails);
      } else if (orderItems.length > 0) { // Only create a new temp order if there are items
        const newOrder = await Order.create({
          ...orderDetails,
          order_number: `TEMP-${Date.now()}`,
        });
        setCurrentOrder(newOrder);
        // Update URL with temp order ID
        window.history.replaceState({}, '', `?tempOrderId=${newOrder.id}`);
      }
    } catch (error) {
      console.error("Error saving temporary order:", error);
    }
  };

  const handleAddItemToOrder = (part, quantity = null) => {
    // Calculate suggested quantity if not provided
    let suggestedQuantity = quantity;
    if (suggestedQuantity === null) {
      const mainWarehouse = allWarehouses.find(w => w.number === 1);
      if (mainWarehouse) {
        const currentStock = part[mainWarehouse.warehouse_id] || 0;
        const minimumStock = part.minimum_stock || 0;
        const quantityOnOrder = getQuantityOnOrder(part.sku);

        const calculatedQuantity = minimumStock - currentStock - quantityOnOrder;
        suggestedQuantity = calculatedQuantity > 0 ? calculatedQuantity : 1;
      } else {
        suggestedQuantity = 1;
      }
    }

    setOrderItems(prevItems => {
      const existingItem = prevItems.find(item => item.sku === part.sku);
      if (existingItem) {
        // If item exists, just return existing items (don't add duplicate)
        return prevItems;
      }
      // Add new item to the top of the list
      return [{ ...part, quantity: suggestedQuantity }, ...prevItems];
    });

    setSuggestedItems(prev => prev.filter(item => item.sku !== part.sku));
  };

  // Helper function to get quantity on order
  const getQuantityOnOrder = (partSku) => {
    let onOrder = 0;
    const activeOrders = allOrders.filter(o => o.status === 'ordered' || o.status === 'partially_received');

    for (const order of activeOrders) {
      for (const item of order.items) {
        if (item.part_sku === partSku) {
          const remainingToReceive = (item.quantity || 0) - (item.received_quantity || 0);
          if (remainingToReceive > 0) {
            onOrder += remainingToReceive;
          }
        }
      }
    }
    return onOrder;
  };

  const handleCreateOrder = async (orderDetails) => {
    try {
      // Save order with הוקם status (established/created)
      const orderData = {
        ...orderDetails,
        notes: notes,
        supplier: supplier,
        status: 'הוקם', // Changed from 'ordered' to 'הוקם'
      };

      let savedOrder;
      if (currentOrder) {
        savedOrder = await Order.update(currentOrder.id, orderData);
      } else {
        savedOrder = await Order.create(orderData);
      }

      toast({ title: "הזמנה נוצרה בהצלחה" });
      setOrderItems([]);
      setCurrentOrder(null);
      setSupplier('');
      setNotes('');
      // Clear URL params and redirect to Orders page
      window.history.replaceState({}, '', window.location.pathname);
      window.location.href = createPageUrl('Orders');
    } catch (error) {
      console.error("Error creating order:", error);
      toast({ variant: "destructive", title: "שגיאה ביצירת הזמנה" });
    }
  };

  const handlePrintOrder = (order) => {
    setCreatedOrder(null); // Close the dialog
    setOrderToPrint(order);
    setTimeout(() => {
      window.print();
      setOrderToPrint(null);
    }, 100);
  };

  const handleExportCsv = (order) => {
    setCreatedOrder(null); // Close the dialog
    exportOrderToCsv(order);
  };

  const handleCancelOrder = async () => {
    if (currentOrder) {
      try {
        await Order.delete(currentOrder.id);
        setCurrentOrder(null);
        setOrderItems([]);
        setSupplier('');
        setNotes('');
        // Clear tempOrderId from URL
        window.history.replaceState({}, '', window.location.pathname);
        toast({ title: "הזמנה זמנית בוטלה" });
        await loadData(); // Reload data to reset suggested items etc.
      } catch (error) {
        console.error("Error canceling order:", error);
        toast({ variant: "destructive", title: "שגיאה בביטול הזמנה" });
      }
    } else {
      // If no current order (no temp order saved), just clear local state
      setOrderItems([]);
      setSupplier('');
      setNotes('');
      await loadData();
    }
  };

  const handleViewStock = (part) => {
    setSelectedPart(part);
  };

  const getPartStockByWarehouses = (part) => {
    return allWarehouses.map(warehouse => {
      return {
        warehouse,
        // Get stock directly from part record using warehouse_id
        quantity: part[warehouse.warehouse_id] || 0
      };
    }).sort((a, b) => (a.warehouse.number || 0) - (b.warehouse.number || 0));
  };

  return (
    <>
      <style>
        {`
          @media print {
            body > div:not(.printable-order-container) {
              display: none;
            }
            .printable-order-container {
              display: block !important;
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              height: 100%;
              margin: 0;
              padding: 0;
              overflow: hidden;
            }
          }
        `}
      </style>
      <div className="p-6" dir="rtl">
        <div className="max-w-7xl mx-auto space-y-6">
          <h1 className="text-2xl font-bold">הזמנות רכש</h1>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <NewOrderForm
                orderItems={orderItems}
                setOrderItems={setOrderItems}
                allParts={allParts}
                onAddItem={handleAddItemToOrder}
                onSubmit={handleCreateOrder}
                onCancel={handleCancelOrder}
                hasTemporaryOrder={!!currentOrder}
                supplier={supplier}
                setSupplier={setSupplier}
                notes={notes}
                setNotes={setNotes}
                allWarehouses={allWarehouses}
                allOrders={allOrders}
              />
            </div>
            <div>
              <SuggestedItemsList
                items={suggestedItems}
                onAddItem={handleAddItemToOrder}
                onViewStock={handleViewStock}
                loading={loading}
              />
            </div>
          </div>

          {selectedPart && (
            <StockViewModal
              part={selectedPart}
              stocks={getPartStockByWarehouses(selectedPart)}
              onClose={() => setSelectedPart(null)}
            />
          )}
        </div>
      </div>
      <div className="hidden printable-order-container">
        <PrintableOrder order={orderToPrint} />
      </div>
    </>
  );
}
