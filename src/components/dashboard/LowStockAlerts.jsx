import React, { useState, useEffect } from 'react';
import { Stock, Part, Warehouse } from '@/entities/all';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";

export default function LowStockAlerts() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    const loadAlerts = async () => {
      try {
        const [stocks, parts, warehouses] = await Promise.all([
          Stock.list(),
          Part.list(),
          Warehouse.list()
        ]);

        if (!mounted) return;

        // Create lookup maps
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

        // Aggregate stock by part
        const stockByPart = {};
        
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
            if (!stockByPart[part.sku]) {
              stockByPart[part.sku] = {
                part,
                totalQuantity: 0,
                warehouses: []
              };
            }
            stockByPart[part.sku].totalQuantity += (stock.quantity || 0);
            
            // Track which warehouses have this part
            if (!stockByPart[part.sku].warehouses.find(w => w.id === warehouse.id)) {
              stockByPart[part.sku].warehouses.push({
                id: warehouse.id,
                name: `${warehouse.number} - ${warehouse.name}`,
                quantity: stock.quantity || 0
              });
            }
          }
        });

        // Find items with low stock
        const lowStockItems = Object.values(stockByPart)
          .filter(item => item.totalQuantity <= (item.part.minimum_stock || 0))
          .map(item => ({
            part_id: item.part.id,
            part_name: item.part.name,
            part_sku: item.part.sku,
            total_quantity: item.totalQuantity,
            minimum_stock: item.part.minimum_stock || 0,
            unit: item.part.unit || 'pieces',
            warehouses: item.warehouses
          }))
          .sort((a, b) => {
            // Sort by severity (lower stock percentage first)
            const aPercentage = a.minimum_stock > 0 ? a.total_quantity / a.minimum_stock : 0;
            const bPercentage = b.minimum_stock > 0 ? b.total_quantity / b.minimum_stock : 0;
            return aPercentage - bPercentage;
          });

        if (mounted) {
          setAlerts(lowStockItems);
          setError("");
        }
      } catch (err) {
        console.error("Error loading alerts:", err);
        if (mounted) {
          setError("אירעה שגיאה בטעינת התראות המלאי");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadAlerts();

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
        <CardHeader>
          <CardTitle>התראות מלאי נמוך</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-500 py-6">
            טוען התראות...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>שגיאה</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (alerts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>התראות מלאי נמוך</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-500 py-6">
            🎉 אין התראות מלאי נמוך כרגע
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-red-500" />
          התראות מלאי נמוך ({alerts.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {alerts.slice(0, 5).map((alert, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200"
            >
              <div className="flex-1">
                <h4 className="font-medium text-gray-900">{alert.part_name}</h4>
                <p className="text-sm text-gray-600">
                  מק"ט: {alert.part_sku}
                </p>
                <div className="text-xs text-gray-500 mt-1">
                  {alert.warehouses.map(warehouse => 
                    `${warehouse.name}: ${warehouse.quantity}`
                  ).join(', ')}
                </div>
              </div>
              <div className="text-right flex gap-2 items-center">
                <div className="text-center">
                  <Badge variant="destructive" className="mb-1">
                    {alert.total_quantity} / {alert.minimum_stock} {getUnitDisplay(alert.unit)}
                  </Badge>
                  <div className="text-xs text-red-600">
                    {alert.minimum_stock > 0 
                      ? `${Math.round((alert.total_quantity / alert.minimum_stock) * 100)}% מהמינימום`
                      : 'אין מינימום מוגדר'
                    }
                  </div>
                </div>
                <Link to={`${createPageUrl("Parts")}?partId=${alert.part_id}`}>
                  <Button size="sm" variant="outline">
                    צפה
                  </Button>
                </Link>
              </div>
            </div>
          ))}
          {alerts.length > 5 && (
            <div className="text-center pt-2">
              <Link to={createPageUrl("Stock")}>
                <Button variant="ghost" size="sm">
                  צפה בכל ההתראות ({alerts.length - 5} נוספות)
                </Button>
              </Link>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}