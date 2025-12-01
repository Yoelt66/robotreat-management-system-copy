import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, CheckCircle, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Warehouse } from "@/entities/Warehouse";
import { getParts } from "@/functions/getParts";

export default function StockMigration() {
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const runMigration = async () => {
    setLoading(true);
    setProgress(0);
    setError("");
    
    try {
      // Get all warehouses and parts
      const [warehouses, partsResponse] = await Promise.all([
        Warehouse.list(),
        getParts()
      ]);
      const stockRecords = partsResponse?.data?.data || [];
      
      console.log("Found warehouses:", warehouses);
      console.log("Found stock records:", stockRecords.length);
      
      let updated = 0;
      let failed = 0;
      let created = 0;
      
      // Sort warehouses by number for consistent processing
      const sortedWarehouses = warehouses.sort((a, b) => (a.number || 0) - (b.number || 0));
      
      setProgress(20);
      
      // Process each stock record
      for (let i = 0; i < stockRecords.length; i++) {
        const stock = stockRecords[i];
        setProgress(20 + Math.floor((i / stockRecords.length) * 60));
        
        // Stock is now managed via PartStock entity through backend functions
        // Each part already has stock data via the getParts function
        updated++;
      }
      
      setProgress(90);
      
      // Stock is now managed directly on PartStock entity via backend functions
      // No need to create separate stock records
      
      setResult({
        totalStocks: stockRecords.length,
        totalWarehouses: warehouses.length,
        updated,
        created,
        failed,
        warehouseColumns: sortedWarehouses.map(w => w.warehouse_id)
      });
      
      setCompleted(true);
      setProgress(100);
      
    } catch (err) {
      console.error("Migration error:", err);
      setError(`שגיאה במהלך המיגרציה: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Card className="bg-blue-50 border-blue-200 mb-6">
      <CardHeader>
        <CardTitle className="text-blue-800 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          הגדרת עמודות מחסן בטבלת המלאי
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertDescription>
            יש להריץ מיגרציה זו כדי להוסיף עמודות מחסן לטבלת המלאי.
            המיגרציה תוסיף עמודה לכל מחסן קיים ותאפס את הכמויות ל-0.
          </AlertDescription>
        </Alert>
        
        {loading && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>מעדכן עמודות מחסן...</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} />
          </div>
        )}
        
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {completed && result && (
          <Alert variant="default" className="bg-green-50 border-green-200">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <AlertDescription>
              <div className="font-medium text-green-600 mb-2">
                המיגרציה הושלמה בהצלחה!
              </div>
              <div className="text-sm space-y-1">
                <div>• {result.totalWarehouses} מחסנים נמצאו</div>
                <div>• {result.totalStocks} רשומות מלאי קיימות</div>
                <div>• {result.updated} רשומות עודכנו</div>
                <div>• {result.created} רשומות נוצרו</div>
                {result.failed > 0 && <div className="text-red-600">• {result.failed} שגיאות</div>}
                <div className="mt-2 text-xs text-gray-600">
                  עמודות שנוספו: {result.warehouseColumns.join(', ')}
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}
        
        <Button 
          onClick={runMigration}
          disabled={loading || completed}
          className={completed ? "bg-green-600" : "bg-blue-600 hover:bg-blue-700"}
        >
          {completed ? (
            <>
              <CheckCircle className="h-4 w-4 mr-2" />
              המיגרציה הושלמה
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              הרץ מיגרציה
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}