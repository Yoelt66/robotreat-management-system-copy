import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Database, RefreshCw, Copy, CheckCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Warehouse } from "@/entities/all";
import { toast } from "@/components/ui/use-toast";

export default function StockSchemaUpdater() {
  const [warehouses, setWarehouses] = useState([]);
  const [stockSchema, setStockSchema] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadWarehouses();
  }, []);

  const loadWarehouses = async () => {
    try {
      const warehousesData = await Warehouse.list();
      setWarehouses(warehousesData.sort((a, b) => (a.number || 0) - (b.number || 0)));
    } catch (error) {
      console.error("Error loading warehouses:", error);
    }
  };

  const generateStockSchema = () => {
    const schema = {
      "name": "Stock",
      "type": "object",
      "properties": {
        "part_id": {
          "type": "string",
          "description": "מזהה הפריט - מקושר לטבלת הפריטים"
        },
        "last_count_date": {
          "type": "string",
          "format": "date",
          "description": "תאריך ספירת מלאי אחרונה"
        },
        "notes": {
          "type": "string",
          "description": "הערות על המלאי"
        }
      },
      "required": ["part_id"]
    };

    // Add warehouse columns
    warehouses.forEach(warehouse => {
      schema.properties[warehouse.warehouse_id] = {
        "type": "number",
        "default": 0,
        "description": `כמות במחסן ${warehouse.name}`
      };
    });

    return schema;
  };

  const updateStockSchema = async () => {
    setLoading(true);
    try {
      const newSchema = generateStockSchema();
      setStockSchema(newSchema);
      
      // Copy schema to clipboard
      const schemaJson = JSON.stringify(newSchema, null, 2);
      await navigator.clipboard.writeText(schemaJson);
      
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
      
      toast({
        title: "סכמת Stock הועתקה ללוח",
        description: "יש להחליף את התוכן של entities/Stock.json עם התוכן שהועתק",
        duration: 8000
      });
      
      console.log("=== COPY THIS TO entities/Stock.json ===");
      console.log(schemaJson);
      console.log("=== END STOCK SCHEMA ===");
      
    } catch (error) {
      console.error("Error updating stock schema:", error);
      toast({
        variant: "destructive",
        title: "שגיאה בהעתקה",
        description: "לא ניתן להעתיק ללוח. בדוק את הקונסול"
      });
    } finally {
      setLoading(false);
    }
  };

  const currentSchema = generateStockSchema();

  return (
    <Card className="bg-blue-50 border-blue-200">
      <CardHeader>
        <CardTitle className="text-blue-800 flex items-center gap-2">
          <Database className="h-5 w-5" />
          עדכון אוטומטי של סכמת Stock
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertDescription>
            <div className="space-y-2">
              <p>כלי זה מעדכן את סכמת Stock לכלול את כל המחסנים הנוכחיים.</p>
              <p className="text-sm text-gray-600">
                <strong>הוראות:</strong> לחץ על הכפתור למטה, הסכמה תועתק ללוח. 
                לאחר מכן העתק את התוכן לקובץ entities/Stock.json
              </p>
            </div>
          </AlertDescription>
        </Alert>

        <div className="text-sm">
          <div className="font-medium mb-2">מחסנים קיימים ({warehouses.length}):</div>
          <div className="space-y-1">
            {warehouses.map(warehouse => (
              <div key={warehouse.id} className="flex items-center gap-2">
                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-mono">
                  {warehouse.warehouse_id}
                </span>
                <span>{warehouse.name}</span>
              </div>
            ))}
          </div>
        </div>

        <Button 
          onClick={updateStockSchema} 
          disabled={loading}
          className="w-full"
        >
          {copied ? (
            <>
              <CheckCircle className="w-4 h-4 mr-2" />
              הועתק בהצלחה!
            </>
          ) : (
            <>
              <Copy className="w-4 h-4 mr-2" />
              {loading ? "מעתיק..." : "העתק סכמת Stock עם כל המחסנים"}
            </>
          )}
        </Button>

        {stockSchema && (
          <div className="mt-4">
            <div className="text-sm font-medium mb-2">סכמה עם כל המחסנים (הועתקה ללוח):</div>
            <pre className="bg-gray-100 p-3 rounded text-xs overflow-auto max-h-60 border">
              {JSON.stringify(currentSchema, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}