import React from 'react';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardFooter 
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Warehouse as WarehouseIcon, MapPin, PhoneCall, Edit, Boxes } from "lucide-react";

export default function WarehouseCard({ warehouse, stockData, onEdit }) {
  const itemCount = stockData.length;
  const totalQuantity = stockData.reduce((sum, item) => sum + (item.quantity || 0), 0);
  
  return (
    <Card className="overflow-hidden h-full flex flex-col">
      <CardHeader className="bg-gray-50 pb-2">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2">
              <WarehouseIcon className="h-5 w-5 text-gray-500" />
              <CardTitle className="text-lg">
                {warehouse.name}
              </CardTitle>
            </div>
            <Badge variant="outline" className="mt-1">מספר {warehouse.number || 1}</Badge>
          </div>
          <Button variant="ghost" size="icon" onClick={onEdit}>
            <Edit className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="py-4 flex-grow">
        <div className="space-y-3">
          <div className="flex items-start gap-2">
            <MapPin className="h-4 w-4 text-gray-500 mt-0.5" />
            <div className="text-sm">{warehouse.location}</div>
          </div>
          
          {warehouse.contact && (
            <div className="flex items-start gap-2">
              <PhoneCall className="h-4 w-4 text-gray-500 mt-0.5" />
              <div className="text-sm">{warehouse.contact}</div>
            </div>
          )}
          
          <div className="pt-2">
            <div className="text-sm font-medium">נתוני מלאי:</div>
            <div className="flex items-center gap-4 mt-2">
              <div>
                <div className="text-2xl font-bold">{itemCount}</div>
                <div className="text-xs text-gray-500">פריטים שונים</div>
              </div>
              <div className="border-r border-gray-200 h-10" />
              <div>
                <div className="text-2xl font-bold">{totalQuantity}</div>
                <div className="text-xs text-gray-500">יחידות במלאי</div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="bg-gray-50 p-3">
        <div className="flex justify-between items-center w-full">
          <div className="text-sm text-gray-500 flex items-center gap-1">
            <Boxes className="h-4 w-4" />
            {itemCount > 0 ? `${itemCount} פריטים במלאי` : 'אין פריטים במלאי'}
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}