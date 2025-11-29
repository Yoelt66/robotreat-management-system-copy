import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, CheckCircle, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Stock, Part } from "@/entities/all";

export default function StockDataMigration() {
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
      console.log("Starting stock data migration...");
      
      // Get all stock records and parts
      const [stocks, parts] = await Promise.all([
        Stock.list(),
        Part.list()
      ]);
      
      console.log(`Found ${stocks.length} stock records and ${parts.length} parts`);
      
      let updated = 0;
      let failed = 0;
      let skipped = 0;
      
      for (let i = 0; i < stocks.length; i++) {
        const stock = stocks[i];
        setProgress(Math.floor((i / stocks.length) * 100));
        
        try {
          // Check if part_id is integer (needs migration)
          if (typeof stock.part_id === 'number') {
            console.log(`Migrating stock record ${stock.id}: part_id ${stock.part_id} (number) needs to be converted to string`);
            
            // Find the corresponding part by part_id (integer)
            const part = parts.find(p => p.part_id === stock.part_id);
            if (part) {
              // Update stock record to use part.id (string) instead of part.part_id (integer)
              const updateData = {
                part_id: part.id // Use the actual Part entity ID (string)
              };
              
              console.log(`Updating stock ${stock.id}: part_id ${stock.part_id} -> ${part.id}`);
              await Stock.update(stock.id, updateData);
              updated++;
            } else {
              console.error(`Part not found for part_id ${stock.part_id}`);
              failed++;
            }
          } else {
            // part_id is already a string, no migration needed
            skipped++;
          }
          
          // Add delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (err) {
          console.error(`Error updating stock ${stock.id}:`, err);
          failed++;
        }
      }
      
      setResult({
        total: stocks.length,
        updated,
        failed,
        skipped
      });
      
      setCompleted(true);
      console.log(`Migration completed: ${updated} updated, ${skipped} skipped, ${failed} failed`);
      
    } catch (err) {
      console.error("Migration error:", err);
      setError(`שגיאה במהלך המיגרציה: ${err.message}`);
    } finally {
      setLoading(false);
      setProgress(100);
    }
  };
  
  return (
    <Card className="bg-orange-50 border-orange-200 mb-6">
      <CardHeader>
        <CardTitle className="text-orange-800 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          נדרש עדכון נתוני מלאי
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertDescription>
            זוהו רשומות מלאי עם פורמט נתונים ישן שדורש עדכון. 
            המיגרציה תעדכן את הקישור בין רשומות המלאי לפריטים.
          </AlertDescription>
        </Alert>
        
        {loading && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>מעדכן נתוני מלאי...</span>
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
              <div className="text-sm mt-1 space-y-1">
                <div>סה"כ רשומות: {result.total}</div>
                <div>עודכנו: {result.updated}</div>
                <div>כבר מעודכנות: {result.skipped}</div>
                <div>נכשלו: {result.failed}</div>
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
              הפעל עדכון נתוני מלאי
            </>
          )}
        </Button>
        
        {completed && (
          <Button 
            onClick={() => window.location.reload()}
            variant="outline"
            className="w-full mt-2"
          >
            רענן דף לראות תוצאות
          </Button>
        )}
      </CardContent>
    </Card>
  );
}