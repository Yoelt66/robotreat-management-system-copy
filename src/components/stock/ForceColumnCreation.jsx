import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Database, CheckCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Stock, Warehouse, Part } from "@/entities/all";

export default function ForceColumnCreation({ onComplete }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const addMissingWarehouseColumns = async () => {
    setLoading(true);
    setError("");
    
    try {
      // Get warehouses, stocks, and parts
      const [warehouses, stocks, parts] = await Promise.all([
        Warehouse.list(),
        Stock.list(),
        Part.list()
      ]);
      
      console.log(`Found ${warehouses.length} warehouses, ${stocks.length} stock records, and ${parts.length} parts`);
      
      // Clean up orphaned stock records first
      const validStocks = [];
      const orphanedStocks = [];
      
      for (const stock of stocks) {
        const part = parts.find(p => 
          String(p.id) === String(stock.part_id) || 
          String(p.part_id) === String(stock.part_id)
        );
        
        if (part) {
          validStocks.push(stock);
        } else {
          orphanedStocks.push(stock);
        }
      }
      
      // Remove orphaned stock records
      for (const orphanedStock of orphanedStocks) {
        try {
          await Stock.delete(orphanedStock.id);
          console.log(`Deleted orphaned stock record: ${orphanedStock.id}`);
        } catch (error) {
          console.error(`Failed to delete orphaned stock ${orphanedStock.id}:`, error);
        }
      }
      
      // Find warehouses that don't have columns in stock records
      const sampleStock = validStocks[0];
      const missingWarehouses = sampleStock ? warehouses.filter(w => 
        !sampleStock.hasOwnProperty(w.warehouse_id)
      ) : [];
      
      console.log(`Missing warehouse columns:`, missingWarehouses.map(w => w.warehouse_id));
      
      if (missingWarehouses.length === 0 && orphanedStocks.length === 0) {
        setResult({
          success: true,
          message: "כל עמודות המחסן כבר קיימות ולא נמצאו רשומות פגומות!"
        });
        return;
      }
      
      // Add missing columns to all valid stock records
      let updatedCount = 0;
      let errorCount = 0;
      
      for (const stock of validStocks) {
        try {
          const updateData = {};
          let needsUpdate = false;
          
          // Add missing warehouse columns
          missingWarehouses.forEach(warehouse => {
            if (!stock.hasOwnProperty(warehouse.warehouse_id)) {
              updateData[warehouse.warehouse_id] = 0;
              needsUpdate = true;
            }
          });
          
          if (needsUpdate) {
            console.log(`Adding columns to stock ${stock.id}:`, Object.keys(updateData));
            await Stock.update(stock.id, updateData);
            updatedCount++;
            
            // Small delay to avoid overwhelming the system
            await new Promise(resolve => setTimeout(resolve, 200));
          }
          
        } catch (error) {
          console.error(`Error updating stock ${stock.id}:`, error);
          errorCount++;
        }
      }
      
      console.log(`Update completed: ${updatedCount} stocks updated, ${errorCount} errors, ${orphanedStocks.length} orphaned records removed`);
      
      setResult({
        success: errorCount === 0,
        stocksUpdated: updatedCount,
        errors: errorCount,
        warehousesAdded: missingWarehouses.length,
        orphanedRemoved: orphanedStocks.length
      });
      
      if (errorCount === 0 && onComplete) {
        setTimeout(() => onComplete(), 2000);
      }
      
    } catch (err) {
      console.error("Error adding warehouse columns:", err);
      setError(`שגיאה: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="bg-orange-50 border-orange-200 mb-6">
      <CardHeader>
        <CardTitle className="text-orange-800 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          נדרש עדכון עמודות מחסן ונקוי נתונים
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            זוהו רשומות מלאי פגומות או מחסנים חדשים שעדיין לא נוספו לרשומות המלאי. 
            יש להוסיף עמודות לכל המחסנים החדשים ולנקות רשומות פגומות.
          </AlertDescription>
        </Alert>
        
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {result && (
          <Alert variant={result.success ? "default" : "destructive"} 
                className={result.success ? "bg-green-50 border-green-200" : ""}>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              {result.success ? (
                <div>
                  <div className="font-medium text-green-600 mb-2">עדכון הושלם בהצלחה!</div>
                  <div className="text-sm">
                    • {result.stocksUpdated} רשומות מלאי עודכנו<br/>
                    • {result.warehousesAdded} עמודות מחסן נוספו<br/>
                    {result.orphanedRemoved > 0 && <span>• {result.orphanedRemoved} רשומות פגומות נמחקו<br/></span>}
                    {result.errors > 0 && <span className="text-red-600">• {result.errors} שגיאות</span>}
                  </div>
                </div>
              ) : (
                result.message || "העדכון הושלם עם שגיאות"
              )}
            </AlertDescription>
          </Alert>
        )}
        
        <Button 
          onClick={addMissingWarehouseColumns}
          disabled={loading}
          className="w-full bg-orange-600 hover:bg-orange-700"
        >
          {loading ? (
            <>
              <Database className="w-4 h-4 mr-2 animate-spin" />
              מנקה ומוסיף עמודות מחסן...
            </>
          ) : (
            <>
              <Database className="w-4 h-4 mr-2" />
              נקה נתונים והוסף עמודות מחסן חסרות
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}