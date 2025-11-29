import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Edit, 
  Package, 
  MapPin, 
  Building2,
  Tag,
  DollarSign,
  AlertTriangle,
  CheckCircle
} from "lucide-react";

export default function PartDetail({ part, warehouses, categories, suppliers, onClose, onEdit }) {
  if (!part) return null;

  const category = categories.find(c => c.code === part.category);
  const supplier = suppliers.find(s => s.supplier_number === part.supplier_number);

  const getTotalStock = () => {
    return warehouses.reduce((total, warehouse) => {
      return total + (part[warehouse.warehouse_id] || 0);
    }, 0);
  };

  const getStockStatus = () => {
    const totalStock = getTotalStock();
    const minStock = part.minimum_stock || 0;
    
    if (totalStock === 0) return { status: 'out_of_stock', color: 'bg-red-100 text-red-800', label: 'אזל מהמלאי' };
    if (totalStock < minStock) return { status: 'low_stock', color: 'bg-yellow-100 text-yellow-800', label: 'מלאי נמוך' };
    return { status: 'in_stock', color: 'bg-green-100 text-green-800', label: 'במלאי' };
  };

  const stockStatus = getStockStatus();
  const totalStock = getTotalStock();

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader className="flex flex-row items-center justify-between">
          <DialogTitle className="text-xl">
            פרטי פריט - {part.name}
          </DialogTitle>
          <div className="flex items-center gap-2">
            <Badge className={stockStatus.color}>
              {stockStatus.label}
            </Badge>
            <Button variant="outline" size="sm" onClick={() => onEdit(part)}>
              <Edit className="h-4 w-4 mr-2" />
              ערוך
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                מידע בסיסי
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-gray-700 mb-1">מק״ט</h4>
                  <p className="font-mono text-lg bg-gray-100 px-2 py-1 rounded">{part.sku}</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-700 mb-1">שם הפריט</h4>
                  <p className="text-lg">{part.name}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-gray-700 mb-1">קטגוריה</h4>
                  <Badge variant="outline">
                    {category ? category.name : part.category || 'לא הוגדר'}
                  </Badge>
                </div>
                <div>
                  <h4 className="font-medium text-gray-700 mb-1">יחידת מידה</h4>
                  <p>{part.unit || 'לא הוגדר'}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-gray-700 mb-1">מלאי מינימלי</h4>
                  <p className="flex items-center gap-2">
                    {part.minimum_stock || 0}
                    {totalStock < (part.minimum_stock || 0) && (
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    )}
                  </p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-700 mb-1">מיקום במחסן</h4>
                  <p className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-gray-500" />
                    {part.current_location || 'לא הוגדר'}
                  </p>
                </div>
              </div>

              {part.notes && (
                <div>
                  <h4 className="font-medium text-gray-700 mb-1">הערות</h4>
                  <div className="bg-gray-50 p-3 rounded-md">
                    <p className="whitespace-pre-wrap">{part.notes}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Stock Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                מידע מלאי
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-3xl font-bold text-blue-600">{totalStock}</div>
                  <div className="text-sm text-gray-600">סה״כ מלאי</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-3xl font-bold text-gray-600">{part.minimum_stock || 0}</div>
                  <div className="text-sm text-gray-600">מלאי מינימלי</div>
                </div>
              </div>

              <h4 className="font-medium text-gray-700 mb-2">פירוט לפי מחסנים:</h4>
              <div className="space-y-2">
                {warehouses.map(warehouse => {
                  const stock = part[warehouse.warehouse_id] || 0;
                  return (
                    <div key={warehouse.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="font-medium">{warehouse.name}</span>
                      <Badge variant={stock > 0 ? "default" : "secondary"}>
                        {stock} יח'
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Supplier Information */}
          {(supplier || part.supplier_part_number) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  פרטי ספק
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {supplier && (
                    <div>
                      <h4 className="font-medium text-gray-700 mb-1">ספק</h4>
                      <p>{supplier.name}</p>
                      <p className="text-sm text-gray-600">{supplier.supplier_number}</p>
                    </div>
                  )}
                  {part.supplier_part_number && (
                    <div>
                      <h4 className="font-medium text-gray-700 mb-1">מק״ט אצל הספק</h4>
                      <p className="font-mono">{part.supplier_part_number}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Pricing Information */}
          {part.cost_price && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  מידע תמחור
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium text-gray-700 mb-1">מחיר עלות</h4>
                    <p>{part.cost_price} {part.cost_currency || 'ILS'}</p>
                  </div>
                  {part.is_manual && part.manual_sale_price && (
                    <div>
                      <h4 className="font-medium text-gray-700 mb-1">מחיר מכירה ידני</h4>
                      <p>{part.manual_sale_price} {part.sale_currency || 'ILS'}</p>
                    </div>
                  )}
                </div>
                
                {!part.is_manual && (
                  <div className="mt-4 p-3 bg-blue-50 rounded-md">
                    <h5 className="font-medium mb-2">חישוב מחיר אוטומטי:</h5>
                    <div className="text-sm space-y-1">
                      <p>אחוז ייבוא: {part.import_percentage || 15}%</p>
                      <p>אחוז רווח: {part.markup_percentage || 30}%</p>
                      <p>שער חליפין: {part.exchange_rate || 1}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}