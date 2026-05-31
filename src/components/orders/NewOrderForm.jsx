import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Trash2, AlertTriangle, Plus } from "lucide-react";
import { Supplier, Order } from "@/entities/all";
import { getParts } from "@/functions/getParts";
import { createPart } from "@/functions/createPart";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger } from
"@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue } from
"@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";

function QuickPartForm({ searchTerm, onCreatePart, onCreateOneTime, onCancel }) {
  const [formData, setFormData] = useState({
    sku: '',
    name: searchTerm || '',
    category: 'other',
    unit: 'pieces',
    minimum_stock: 0,
    cost_price: '',
    cost_currency: 'ILS',
    sale_currency: 'ILS',
    import_percentage: 15,
    markup_percentage: 30,
    exchange_rate: 1,
    supplier_number: '',
    supplier_part_number: ''
  });

  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadSuppliers = async () => {
      try {
        const suppliersData = await Supplier.list();
        setSuppliers(suppliersData.filter((s) => s.is_active));
      } catch (error) {
        console.error("Error loading suppliers:", error);
      }
    };
    loadSuppliers();
  }, []);

  const handleCreateFullPart = async () => {
    if (!formData.sku || !formData.name) {
      toast({ variant: "destructive", title: "נדרש מק״ט ושם פריט" });
      return;
    }

    setLoading(true);
    try {
      const newPart = {
        ...formData,
        cost_price: formData.cost_price ? parseFloat(formData.cost_price) : null,
        minimum_stock: parseInt(formData.minimum_stock) || 0
      };

      const response = await createPart(newPart);
      const createdPart = response?.data?.data || response?.data;
      toast({ title: "פריט נוסף בהצלחה למערכת" });
      onCreatePart(createdPart);
    } catch (error) {
      console.error("Error creating part:", error);
      toast({ variant: "destructive", title: "שגיאה ביצירת פריט" });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOneTime = () => {
    if (!formData.sku || !formData.name) {
      toast({ variant: "destructive", title: "נדרש מק״ט ושם פריט" });
      return;
    }

    const oneTimePart = {
      name: formData.name,
      sku: formData.sku,
      part_id: 'חד פעמי',
      quantity: 1,
      cost_price: formData.cost_price ? parseFloat(formData.cost_price) : 0,
      cost_currency: formData.cost_currency,
      isOneTime: true
    };
    onCreateOneTime(oneTimePart);
  };

  return (
    <div className="space-y-4 p-4 max-h-[70vh] overflow-y-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="sku">מק״ט *</Label>
          <Input
            id="sku"
            value={formData.sku}
            onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
            placeholder="הזן מק״ט"
            required />
          
        </div>
        <div className="space-y-2">
          <Label htmlFor="name">שם הפריט *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="הזן שם פריט"
            required />
          
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="category">קטגוריה</Label>
          <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="electronics">אלקטרוניקה</SelectItem>
              <SelectItem value="mechanical">מכני</SelectItem>
              <SelectItem value="tools">כלי עבודה</SelectItem>
              <SelectItem value="consumables">מתכלים</SelectItem>
              <SelectItem value="raw_materials">חומרי גלם</SelectItem>
              <SelectItem value="finished_goods">מוצרים מוגמרים</SelectItem>
              <SelectItem value="other">אחר</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="unit">יחידת מידה</Label>
          <Select value={formData.unit} onValueChange={(value) => setFormData({ ...formData, unit: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pieces">יחידות</SelectItem>
              <SelectItem value="kg">ק״ג</SelectItem>
              <SelectItem value="liters">ליטרים</SelectItem>
              <SelectItem value="meters">מטרים</SelectItem>
              <SelectItem value="boxes">קופסאות</SelectItem>
              <SelectItem value="pairs">זוגות</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="minimum_stock">מלאי מינימלי</Label>
          <Input
            id="minimum_stock"
            type="number"
            value={formData.minimum_stock}
            onChange={(e) => setFormData({ ...formData, minimum_stock: e.target.value })} />
          
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="cost_price">מחיר עלות</Label>
          <Input
            id="cost_price"
            type="number"
            step="0.01"
            value={formData.cost_price}
            onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })} />
          
        </div>
        <div className="space-y-2">
          <Label htmlFor="supplier">ספק</Label>
          <Select value={formData.supplier_number} onValueChange={(value) => setFormData({ ...formData, supplier_number: value })}>
            <SelectTrigger>
              <SelectValue placeholder="בחר ספק" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={null}>ללא ספק</SelectItem>
              {suppliers.map((supplier) =>
              <SelectItem key={supplier.id} value={supplier.supplier_number}>
                  {supplier.supplier_number} - {supplier.name}
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          ביטול
        </Button>
        <Button type="button" variant="outline" onClick={handleCreateOneTime}>
          הוסף כחד פעמי
        </Button>
        <Button type="button" onClick={handleCreateFullPart} disabled={loading}>
          צור פריט ושמור במערכת
        </Button>
      </div>
    </div>);

}

function SearchParts({ onSelectPart, currentOrderItems, allWarehouses, allOrders }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showPartForm, setShowPartForm] = useState(false);

  // Calculate quantity on order for a part
  const getQuantityOnOrder = (partSku) => {
    let onOrder = 0;
    const activeOrders = allOrders.filter((o) => o.status === 'ordered' || o.status === 'partially_received');

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

  // Calculate suggested quantity to order
  const getSuggestedQuantity = (part) => {
    const mainWarehouse = allWarehouses.find((w) => w.number === 1);
    if (!mainWarehouse) return 1;

    const currentStock = part[mainWarehouse.warehouse_id] || 0;
    const minimumStock = part.minimum_stock || 0;
    const quantityOnOrder = getQuantityOnOrder(part.sku);

    const suggestedQuantity = minimumStock - currentStock - quantityOnOrder;
    return suggestedQuantity > 0 ? suggestedQuantity : 1;
  };

  useEffect(() => {
    if (searchTerm.length < 4) {
      setResults([]);
      return;
    }

    const handler = setTimeout(async () => {
      setLoading(true);
      try {
        const partsResponse = await getParts();
        const searchResults = partsResponse?.data?.data || partsResponse?.data || [];
        const filteredResults = searchResults.filter((part) => {
          const matchesSearch =
          part.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          part.sku?.toLowerCase().includes(searchTerm.toLowerCase());
          const notInOrder = !currentOrderItems.some((item) => item.sku === part.sku);
          return matchesSearch && notInOrder;
        });
        setResults(filteredResults);
      } catch (error) {
        console.error("Error searching parts:", error);
        setResults([]);
      }
      setLoading(false);
    }, 500);

    return () => clearTimeout(handler);
  }, [searchTerm, currentOrderItems]);

  const handleSelect = (part) => {
    const partWithQuantity = {
      ...part,
      quantity: getSuggestedQuantity(part)
    };
    onSelectPart(partWithQuantity);
    setSearchTerm('');
    setResults([]);
  };

  const handleCreatePart = (newPart) => {
    setShowPartForm(false);
    setSearchTerm('');
    setResults([]);
    const partWithQuantity = {
      ...newPart,
      quantity: getSuggestedQuantity(newPart)
    };
    onSelectPart(partWithQuantity);
  };

  const handleCreateOneTime = (oneTimePart) => {
    setShowPartForm(false);
    setSearchTerm('');
    setResults([]);
    onSelectPart(oneTimePart);
  };

  return (
    <>
      <Popover open={searchTerm.length >= 4 && !showPartForm}>
        <PopoverTrigger asChild>
          <div className="relative">
            <Search className="absolute right-3 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              placeholder="חפש פריט קיים או הזן שם פריט חדש (4 תווים לפחות)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pr-9" />
            
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          {loading ?
          <div className="p-4 text-center">מחפש...</div> :
          results.length > 0 ?
          <ul className="max-h-60 overflow-y-auto">
              {results.map((part) =>
            <li
              key={part.id}
              className="p-3 hover:bg-gray-100 cursor-pointer border-b last:border-b-0"
              onClick={() => handleSelect(part)}>
              
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <p className="font-medium text-lg">{part.name}</p>
                      <p className="text-sm text-gray-500 font-mono">{part.sku}</p>
                      <p className="text-xs text-gray-400">כמות מוצעת: {getSuggestedQuantity(part)}</p>
                    </div>
                  </div>
                </li>
            )}
              <li className="p-3 border-t bg-gray-50">
                <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => setShowPartForm(true)}>
                
                  <Plus className="h-4 w-4 ml-2" />
                  צור פריט חדש "{searchTerm}"
                </Button>
              </li>
            </ul> :
          searchTerm.length >= 4 ?
          <div className="p-4 text-center">
              <p className="text-sm text-gray-500 mb-3">לא נמצאו פריטים קיימים</p>
              <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => setShowPartForm(true)}>
              
                <Plus className="h-4 w-4 ml-2" />
                צור פריט חדש "{searchTerm}"
              </Button>
            </div> :
          null}
        </PopoverContent>
      </Popover>

      <Dialog open={showPartForm} onOpenChange={setShowPartForm}>
        <DialogContent className="max-w-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle>יצירת פריט חדש</DialogTitle>
          </DialogHeader>
          <QuickPartForm
            searchTerm={searchTerm}
            onCreatePart={handleCreatePart}
            onCreateOneTime={handleCreateOneTime}
            onCancel={() => setShowPartForm(false)} />
          
        </DialogContent>
      </Dialog>
    </>);

}

export default function NewOrderForm({
  orderItems,
  setOrderItems,
  onAddItem,
  onSubmit,
  onCancel,
  hasTemporaryOrder,
  supplier,
  setSupplier,
  notes,
  setNotes,
  allWarehouses = [],
  allOrders = []
}) {
  const [nextOrderNumber, setNextOrderNumber] = useState('');
  const [suppliers, setSuppliers] = useState([]);
  const [selectedSupplierData, setSelectedSupplierData] = useState(null);

  // Calculate quantity on order for a part
  const getQuantityOnOrder = (partSku) => {
    let onOrder = 0;
    const activeOrders = allOrders.filter((o) => o.status === 'ordered' || o.status === 'partially_received');

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

  // Get warehouse stock for a part
  const getWarehouseStock = (part, warehouseId) => {
    return part[warehouseId] || 0;
  };

  // Calculate total cost
  const getTotalCost = () => {
    return orderItems.reduce((total, item) => {
      const itemCost = (item.cost_price || 0) * item.quantity;
      return total + itemCost;
    }, 0);
  };

  // Calculate total cost grouped by currency
  const getTotalCostByCurrency = () => {
    const costByCurrency = {};

    orderItems.forEach((item) => {
      const currency = item.cost_currency || 'ILS';
      const itemCost = (item.cost_price || 0) * item.quantity;

      if (costByCurrency[currency]) {
        costByCurrency[currency] += itemCost;
      } else {
        costByCurrency[currency] = itemCost;
      }
    });

    return costByCurrency;
  };

  // Get primary currency (supplier's currency if available, otherwise most common currency)
  const getPrimaryCurrency = () => {
    if (selectedSupplierData && selectedSupplierData.default_currency) {
      return selectedSupplierData.default_currency;
    }

    // Find most common currency in order items
    const currencyCount = {};
    orderItems.forEach((item) => {
      const currency = item.cost_currency || 'ILS';
      currencyCount[currency] = (currencyCount[currency] || 0) + 1;
    });

    // If no items, default to ILS
    if (Object.keys(currencyCount).length === 0) {
      return 'ILS';
    }

    return Object.keys(currencyCount).reduce((a, b) =>
    currencyCount[a] > currencyCount[b] ? a : b, 'ILS'
    );
  };

  // Generate order number with supplier initials
  const generateOrderNumber = async () => {
    if (!selectedSupplierData) return;

    try {
      const currentYear = new Date().getFullYear();
      const supplierInitials = selectedSupplierData.name.
      split(' ').
      map((word) => word.charAt(0)).
      join('').
      toUpperCase().
      substring(0, 3);

      // Get existing orders for this year and supplier
      const existingOrders = await Order.list();
      const yearPrefix = `${supplierInitials}-${currentYear}-`;
      const existingNumbers = existingOrders.
      filter((order) => order.order_number && order.order_number.startsWith(yearPrefix)).
      map((order) => {
        const parts = order.order_number.split('-');
        return parseInt(parts[2]) || 0;
      }).
      filter((num) => !isNaN(num));

      const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 12;
      const orderNumber = `${yearPrefix}${String(nextNumber).padStart(2, '0')}`;

      setNextOrderNumber(orderNumber);
    } catch (error) {
      console.error("Error generating order number:", error);
      const timestamp = Date.now().toString().slice(-6);
      setNextOrderNumber(`ORD-${timestamp}`);
    }
  };

  useEffect(() => {
    const loadSuppliers = async () => {
      try {
        const suppliersData = await Supplier.list();
        setSuppliers(suppliersData.filter((s) => s.is_active));
        if (supplier) {
          const preSelectedSupplier = suppliersData.find((s) => s.supplier_number === supplier);
          setSelectedSupplierData(preSelectedSupplier || null);
        }
      } catch (error) {
        console.error("Error loading suppliers:", error);
      }
    };

    loadSuppliers();
  }, [supplier]);

  useEffect(() => {
    if (selectedSupplierData) {
      generateOrderNumber();
    }
  }, [selectedSupplierData]);

  const handleSupplierChange = (supplierNumber) => {
    setSupplier(supplierNumber);
    const supplierData = suppliers.find((s) => s.supplier_number === supplierNumber);
    setSelectedSupplierData(supplierData);
  };

  const handleUpdateQuantity = (sku, quantity) => {
    const newQuantity = Math.max(1, Number(quantity));
    setOrderItems((prev) => prev.map((item) =>
    item.sku === sku ? { ...item, quantity: newQuantity } : item
    ));
  };

  const handleUpdateCostPrice = (sku, price) => {
    const newPrice = price === '' ? 0 : Number(price);
    setOrderItems((prev) => prev.map((item) =>
    item.sku === sku ? { ...item, cost_price: newPrice } : item
    ));
  };

  const handleRemoveItem = (sku) => {
    setOrderItems((prev) => prev.filter((item) => item.sku !== sku));
  };

  const handleAddItemToTop = (item) => {
    onAddItem(item);
    // Move to top by re-ordering the items array
    setOrderItems((prev) => {
      const existingIndex = prev.findIndex((existingItem) => existingItem.sku === item.sku);
      if (existingIndex !== -1) {
        // Item already exists, move to top
        const newItems = [...prev];
        const [movedItem] = newItems.splice(existingIndex, 1);
        return [movedItem, ...newItems];
      }
      // New item, add to top
      return [item, ...prev.filter((existingItem) => existingItem.sku !== item.sku)];
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (orderItems.length === 0) return;

    const orderDetails = {
      order_number: nextOrderNumber,
      supplier_number: supplier,
      supplier_name: selectedSupplierData?.name || supplier,
      supplier, // Legacy field
      notes,
      order_date: new Date().toISOString().split('T')[0],
      items: orderItems.map((item) => ({
        part_sku: item.sku,
        part_name: item.name,
        quantity: item.quantity,
        cost_price: item.cost_price || 0,
        currency: item.cost_currency || 'ILS'
      }))
    };
    onSubmit(orderDetails);
  };

  const hasSupplierDetails = selectedSupplierData && (
  selectedSupplierData.contact_person ||
  selectedSupplierData.phone ||
  selectedSupplierData.email ||
  selectedSupplierData.payment_terms);


  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <span>יצירת הזמנה חדשה</span>
          {hasTemporaryOrder &&
          <span className="text-sm bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
              הזמנה זמנית נשמרה
            </span>
          }
        </CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="orderNumber">מספר הזמנה</Label>
              <Input id="orderNumber" value={nextOrderNumber || 'יש לבחור ספק תחילה'} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier">ספק</Label>
              <Select
                value={supplier}
                onValueChange={handleSupplierChange}
                required>
                
                <SelectTrigger>
                  <SelectValue placeholder="בחר ספק" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((supplierItem) =>
                  <SelectItem key={supplierItem.id} value={supplierItem.supplier_number}>
                      {supplierItem.supplier_number} - {supplierItem.name}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {hasSupplierDetails &&
          <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium mb-2">פרטי הספק</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                {selectedSupplierData.contact_person &&
              <div>איש קשר: {selectedSupplierData.contact_person}</div>
              }
                {selectedSupplierData.phone &&
              <div>טלפון: {selectedSupplierData.phone}</div>
              }
                {selectedSupplierData.email &&
              <div>אימייל: {selectedSupplierData.email}</div>
              }
                {selectedSupplierData.payment_terms &&
              <div>תנאי תשלום: {selectedSupplierData.payment_terms}</div>
              }
              </div>
            </div>
          }
          
          <div>
            <Label>הוספת פריטים</Label>
            <SearchParts
              onSelectPart={handleAddItemToTop}
              currentOrderItems={orderItems}
              allWarehouses={allWarehouses}
              allOrders={allOrders} />
            
          </div>

          {orderItems.length > 0 &&
          <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>פריט</TableHead>
                    <TableHead>מחסנים</TableHead>
                    <TableHead>מינימום</TableHead>
                    <TableHead>בהזמנה</TableHead>
                    <TableHead>כמות</TableHead>
                    <TableHead>מחיר עלות</TableHead>
                    <TableHead>סה"כ</TableHead>
                    <TableHead>פעולה</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orderItems.map((item) =>
                <TableRow key={item.sku}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-lg">{item.name}</p>
                          <p className="text-sm text-gray-500 font-mono">{item.sku}</p>
                          {(item.part_id === 'חד פעמי' || item.isOneTime) &&
                      <Badge variant="secondary" className="mt-1">חד פעמי</Badge>
                      }
                        </div>
                      </TableCell>
                      <TableCell className="px-3 py-2">
                        <div className="text-xs space-y-1">
                          {allWarehouses.map((warehouse) =>
                      <div key={warehouse.id} className="flex justify-between">
                              <span>{warehouse.name}:</span>
                              <span className="font-mono">{getWarehouseStock(item, warehouse.warehouse_id)}</span>
                            </div>
                      )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-red-600">{item.minimum_stock || 0}</span>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-blue-600">{getQuantityOnOrder(item.sku)}</span>
                      </TableCell>
                      <TableCell>
                        <Input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => handleUpdateQuantity(item.sku, e.target.value)}
                      className="w-20" />
                    
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.cost_price === null || item.cost_price === undefined ? '' : item.cost_price}
                        onChange={(e) => handleUpdateCostPrice(item.sku, e.target.value)}
                        className="w-24"
                        placeholder="0.00" />
                      
                          <span className="text-sm text-gray-500">
                            {item.cost_currency || 'ILS'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono">
                          {((item.cost_price || 0) * item.quantity).toFixed(2)} {item.cost_currency || 'ILS'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(item.sku)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                )}
                </TableBody>
              </Table>

              {/* Cost Summary */}
              <div className="border-t pt-4">
                <div className="flex justify-end">
                  <div className="bg-gray-50 p-4 rounded-lg min-w-64">
                    <h3 className="text-lg font-bold mb-3">סיכום עלויות</h3>
                    {Object.entries(getTotalCostByCurrency()).map(([currency, total]) =>
                  <div key={currency} className="flex justify-between items-center mb-2">
                        <span className="text-sm text-gray-600">סה"כ {currency}:</span>
                        <span className="font-mono font-medium">
                          {total.toFixed(2)} {currency}
                        </span>
                      </div>
                  )}
                    <div className="border-t pt-2 mt-2">
                      <div className="flex justify-between items-center">
                        <span className="font-bold">מטבע עיקרי ({getPrimaryCurrency()}):</span>
                        <span className="font-mono font-bold text-lg">
                          {(getTotalCostByCurrency()[getPrimaryCurrency()] || 0).toFixed(2)} {getPrimaryCurrency()}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {orderItems.length} פריטים
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          }

          <div className="space-y-2">
            <Label htmlFor="notes">הערות</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="הערות להזמנה" />
            
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="destructive"
                disabled={orderItems.length === 0}>
                
                ביטול הזמנה
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent dir="rtl">
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  אישור ביטול הזמנה
                </AlertDialogTitle>
                <AlertDialogDescription>
                  האם אתה בטוח שברצונך לבטל את ההזמנה הזמנית? 
                  כל הפריטים שנבחרו יימחקו ולא ניתן יהיה לשחזר אותם.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>חזור</AlertDialogCancel>
                <AlertDialogAction
                  onClick={onCancel}
                  className="bg-red-600 hover:bg-red-700">
                  
                  בטל הזמנה
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          
          <Button
            type="submit"
            disabled={orderItems.length === 0 || !supplier.trim() || !nextOrderNumber}>
            
            צור הזמנה
          </Button>
        </CardFooter>
      </form>
    </Card>);

}