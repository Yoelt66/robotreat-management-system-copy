import React, { useState, useEffect } from 'react';
import { Stock, Part, Warehouse } from '@/entities/all';
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
        const [stocks, parts, warehouses] = await Promise.all([
          Stock.list(),
          Part.list(), 
          Warehouse.list()
        ]);
        
        if (!mounted) return;

        // Create lookup maps for efficient access
        const partById = {};
        const partBySku = {};
        parts.forEach(part => {
          partById[part.id] = part;
          partBySku[part.sku] = part;
        });

        const warehouseById = {};
        const warehouseByName = {};
        warehouses.forEach(warehouse => {
          warehouseById[warehouse.id] = warehouse;
          warehouseByName[warehouse.name] = warehouse;
        });

        // Process stocks and aggregate by part-warehouse combination
        const stockAggregation = {};
        
        stocks.forEach(stock => {
          let part = null;
          let warehouse = null;
          
          // Find part by ID or SKU
          if (stock.part_id && partById[stock.part_id]) {
            part = partById[stock.part_id];
          } else if (stock.part_sku && partBySku[stock.part_sku]) {
            part = partBySku[stock.part_sku];
          }
          
          // Find warehouse by ID or name
          if (stock.warehouse_id && warehouseById[stock.warehouse_id]) {
            warehouse = warehouseById[stock.warehouse_id];
          } else if (stock.warehouse_name && warehouseByName[stock.warehouse_name]) {
            warehouse = warehouseByName[stock.warehouse_name];
          }
          
          if (part && warehouse) {
            // Use warehouse ID and part SKU for unique key
            const key = `${warehouse.id}-${part.sku}`;
            
            if (!stockAggregation[key]) {
              stockAggregation[key] = {
                id: stock.id,
                part_name: part.name,
                part_sku: part.sku,
                warehouse_name: `${warehouse.number} - ${warehouse.name}`,
                warehouse_id: warehouse.id,
                unit: part.unit || 'pieces',
                quantity: 0,
                location: part.current_location // Fetch location from the part entity
              };
            }
            
            // Sum quantities for the same part-warehouse combination
            stockAggregation[key].quantity += (stock.quantity || 0);
          }
        });

        const enrichedData = Object.values(stockAggregation)
          .filter(item => item.quantity > 0) // Only show items with stock
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