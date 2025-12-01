import React, { useState, useEffect } from 'react';
import { Warehouse } from '@/entities/Warehouse';
import { getParts } from "@/functions/getParts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MapPin } from 'lucide-react';

export default function StockLevels() {
  const [stockData, setStockData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    
    const loadStockData = async () => {
      try {
        // Fetch all required data
        const [partsResponse, warehouses] = await Promise.all([
          getParts(),
          Warehouse.list()
        ]);
        
        if (!mounted) return;

        const parts = partsResponse?.data?.data || [];

        // Build stock data from parts with warehouse columns
        const stockAggregation = [];
        
        parts.forEach(part => {
          warehouses.forEach(warehouse => {
            const quantity = part[warehouse.warehouse_id] || 0;
            if (quantity > 0) {
              stockAggregation.push({
                id: `${warehouse.id}-${part.sku}`,
                part_name: part.name,
                part_sku: part.sku,
                warehouse_name: `${warehouse.number} - ${warehouse.name}`,
                warehouse_id: warehouse.id,
                unit: part.unit || 'pieces',
                quantity: quantity,
                location: part.current_location
              });
            }
          });
        });

        const enrichedData = stockAggregation
          .sort((a, b) => a.warehouse_name.localeCompare(b.warehouse_name));

        if (mounted) {
          setStockData(enrichedData);
          setError("");
        }
      } catch (err) {
        console.error("Error loading stock data:", err);
        if (mounted) {
          setError("אירעה שגיאה בטעינת נתוני המלאי");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadStockData();
    
    return () => {
      mounted = false;
    };
  }, []);

  const getUnitDisplay = (unit) => {
    const units = {
      "pieces": "יחידות",
      "kg": "ק״ג",
      "liters": "ליטרים",
      "meters": "מטרים",
      "boxes": "קופסאות",
      "pairs": "זוגות"
    };
    return units[unit] || unit;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="text-center">טוען נתוני מלאי...</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-6">
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (stockData.length === 0) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="text-center text-gray-500">אין פריטים במלאי</div>
        </CardContent>
      </Card>
    );
  }

  // Group by warehouse
  const warehouseGroups = {};
  stockData.forEach(item => {
    if (!warehouseGroups[item.warehouse_name]) {
      warehouseGroups[item.warehouse_name] = [];
    }
    warehouseGroups[item.warehouse_name].push(item);
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>רמות מלאי במחסנים</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {Object.entries(warehouseGroups).map(([warehouseName, items]) => (
            <div key={warehouseName} className="space-y-2">
              <h3 className="text-lg font-medium text-blue-700">{warehouseName}</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>פריט</TableHead>
                    <TableHead>מק"ט</TableHead>
                    <TableHead>כמות</TableHead>
                    <TableHead>מיקום</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.slice(0, 5).map(item => (
                    <TableRow key={`${item.warehouse_id}-${item.part_sku}`}>
                      <TableCell className="font-medium">{item.part_name}</TableCell>
                      <TableCell className="font-mono text-sm">{item.part_sku}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-blue-50">
                          {item.quantity.toLocaleString()} {getUnitDisplay(item.unit)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-gray-600">
                        <div className="flex items-center gap-1 text-sm">
                          <MapPin className="h-3 w-3 text-gray-400" />
                          <span>{item.location || '-'}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {items.length > 5 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                        + עוד {items.length - 5} פריטים...
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}