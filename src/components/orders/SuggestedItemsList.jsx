import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, ShoppingCart, Eye } from 'lucide-react';

export default function SuggestedItemsList({ items, onAddItem, onViewStock, loading }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5" />
          פריטים מומלצים להזמנה
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-4">טוען המלצות...</div>
        ) : items.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            אין פריטים מתחת למלאי מינימלי במחסן הראשי.
          </div>
        ) : (
          <ul className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
            {items.map(item => (
              <li key={item.id} className="p-3 bg-gray-50 rounded-lg">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <button
                        onClick={() => onViewStock(item)}
                        className="font-mono text-lg font-bold bg-blue-100 text-blue-800 px-3 py-1 rounded hover:bg-blue-200 transition-colors cursor-pointer"
                      >
                        {item.sku}
                      </button>
                    </div>
                    <p className="font-medium text-base mb-2">{item.name}</p>
                    <div className="text-sm text-gray-600 grid grid-cols-3 gap-x-2">
                        <div>מלאי: <span className="font-bold">{item.current_stock}</span></div>
                        <div>בהזמנה: <span className="font-bold text-blue-600">{item.quantity_on_order}</span></div>
                        <div>מינימום: <span className="font-bold text-red-600">{item.minimum_stock}</span></div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => onAddItem(item)}
                      className="text-blue-600 hover:text-blue-700"
                    >
                      <PlusCircle className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}