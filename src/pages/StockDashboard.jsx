import React, { useState, useEffect } from "react";
import { Warehouse } from "@/entities/Warehouse";
import { getParts } from "@/functions/getParts";
import { Transfer } from "@/entities/Transfer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  ArrowLeftRight, ArrowRight, AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";

import RecentTransfers from "../components/dashboard/RecentTransfers";
import SupplierStatsDashboard from "../components/dashboard/SupplierStatsDashboard";

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export default function StockDashboard() {
  const [stats, setStats] = useState({
    pendingTransfers: 0,
    lowStockItems: 0
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    setError("");
    
    try {
      const [partsResponse, warehousesData, transfersData] = await Promise.all([
        getParts().catch(e => { console.error("Error loading parts:", e); return { data: { data: [] } }; }),
        Warehouse.list().catch(e => { console.error("Error loading warehouses:", e); return []; }),
        Transfer.list().catch(e => { console.warn("Could not load transfers:", e); return []; })
      ]);
      
      const partsData = partsResponse?.data?.data || [];
      
      const mainWarehouse = warehousesData.find(w => w.number === 1);
      
      const lowStockItems = [];
      if (mainWarehouse) {
        for (const part of partsData) {
          if (part.minimum_stock && part.minimum_stock > 0) {
            const mainWarehouseStock = part[mainWarehouse.warehouse_id] || 0;
            if (mainWarehouseStock < part.minimum_stock) {
              lowStockItems.push(part);
            }
          }
        }
      }
      
      const pendingTransfers = transfersData.filter(t => t.status === "pending").length;

      setStats({
        pendingTransfers,
        lowStockItems: lowStockItems.length
      });

    } catch (error) {
      console.error("Error loading dashboard data:", error);
      setError("אירעה שגיאה בטעינת הנתונים. אנא נסה שוב מאוחר יותר.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="text-center py-12">טוען נתונים...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">לוח בקרה - מלאי</h1>
        <Link to={createPageUrl("Transfers")}>
          <Button>
            העברה חדשה <ArrowRight className="mr-2 h-4 w-4" />
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link to={createPageUrl("Transfers")}>
          <Card className="hover:bg-gray-50 transition-colors cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">העברות בהמתנה</CardTitle>
              <ArrowLeftRight className="h-4 w-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pendingTransfers}</div>
              <p className="text-xs text-gray-500">ממתין לטיפול</p>
            </CardContent>
          </Card>
        </Link>

        <Link to={createPageUrl("NewOrders")}>
          <Card className="hover:bg-red-50 transition-colors cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">התראות מלאי נמוך</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-500">{stats.lowStockItems}</div>
              <p className="text-xs text-gray-500">פריטים מתחת למינימום במחסן הראשי</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      <RecentTransfers />

      <SupplierStatsDashboard />
    </div>
  );
}