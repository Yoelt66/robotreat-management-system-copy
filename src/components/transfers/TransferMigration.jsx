import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, CheckCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Transfer } from "@/entities/Transfer";
import { getParts } from "@/functions/getParts";

export default function TransferMigration() {
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
      // Get all transfers
      const transfers = await Transfer.list();
      const totalTransfers = transfers.length;
      const partsResponse = await getParts();
      const parts = partsResponse?.data?.data || [];
      
      let updated = 0;
      let failed = 0;
      
      for (let i = 0; i < transfers.length; i++) {
        const transfer = transfers[i];
        setProgress(Math.floor((i / totalTransfers) * 100));
        
        try {
          const updateData = {};
          
          // Check if transfer number is missing
          if (!transfer.transfer_number) {
            updateData.transfer_number = `TRF-${transfer.id.substring(0, 6)}`;
          }
          
          // Check if items need part_sku added
          if (transfer.items && transfer.items.some(item => item.part_id && !item.part_sku)) {
            const updatedItems = transfer.items.map(item => {
              if (item.part_id && !item.part_sku) {
                const part = parts.find(p => p.id === item.part_id);
                if (part) {
                  return {
                    ...item,
                    part_sku: part.sku
                  };
                }
              }
              return item;
            });
            
            updateData.items = updatedItems;
          }
          
          // Only update if there are changes
          if (Object.keys(updateData).length > 0) {
            await Transfer.update(transfer.id, updateData);
            updated++;
          }
          
          // Add delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 200));
          
        } catch (err) {
          console.error(`Error updating transfer ${transfer.id}:`, err);
          failed++;
        }
      }
      
      setResult({
        total: totalTransfers,
        updated,
        failed
      });
      
      setCompleted(true);
    } catch (err) {
      setError(`שגיאה במהלך המיגרציה: ${err.message}`);
    } finally {
      setLoading(false);
      setProgress(100);
    }
  };
  
  return (
    <Card className="bg-yellow-50 border-yellow-200 mb-6">
      <CardHeader>
        <CardTitle className="text-amber-800">נדרש עדכון נתונים</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertDescription>
            נמצאו נתוני העברות שדורשים עדכון למבנה הנתונים החדש. 
            הפעל את העדכון פעם אחת כדי להשלים את המעבר.
          </AlertDescription>
        </Alert>
        
        {loading && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>מעדכן...</span>
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
              <div className="font-medium text-green-600">
                העדכון הושלם בהצלחה!
              </div>
              <div className="text-sm mt-1">
                סה"כ: {result.total} רשומות,
                עודכנו: {result.updated},
                נכשלו: {result.failed}
              </div>
            </AlertDescription>
          </Alert>
        )}
        
        <Button 
          onClick={runMigration}
          disabled={loading || completed}
          className={completed ? "bg-green-600" : ""}
        >
          {completed ? (
            <>
              <CheckCircle className="h-4 w-4 mr-2" />
              העדכון הושלם
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              הפעל עדכון נתונים
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}