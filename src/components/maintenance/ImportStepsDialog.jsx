
import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UploadFile, ExtractDataFromUploadedFile } from "@/integrations/Core";
import { MaintenanceStep } from "@/entities/MaintenanceStep";
import { toast } from "@/components/ui/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Upload, CheckCircle, XCircle, Info } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import ImportTemplateDownload from "./ImportTemplateDownload";

// Simplified schema - extract each row as a simple object
const stepsSchema = {
  type: "array",
  items: {
    type: "object",
    properties: {
      description: { type: "string" },
      safety_note: { type: "string" },
      part_1_sku: { type: "string" },
      part_1_quantity: { type: "string" },
      part_2_sku: { type: "string" },
      part_2_quantity: { type: "string" },
      part_3_sku: { type: "string" },
      part_3_quantity: { type: "string" },
      part_4_sku: { type: "string" },
      part_4_quantity: { type: "string" },
      part_5_sku: { type: "string" },
      part_5_quantity: { type: "string" },
    },
  },
};

export default function ImportStepsDialog({ open, onOpenChange, deviceType, onImportComplete }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [progress, setProgress] = useState(0);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setError('');
    setResult(null);
  };

  const resetDialog = () => {
    setFile(null);
    setLoading(false);
    setError('');
    setResult(null);
    setProgress(0);
    if (onOpenChange) {
      onOpenChange(false);
    }
  };

  const handleImport = async () => {
    if (!file) {
      setError('אנא בחר קובץ לייבוא.');
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);
    setProgress(10);

    try {
      // 1. Upload the file
      const { file_url } = await UploadFile({ file });
      if (!file_url) throw new Error("File upload failed.");
      setProgress(30);

      // 2. Extract data from the file with simplified schema
      const extractionResult = await ExtractDataFromUploadedFile({
        file_url,
        json_schema: stepsSchema,
      });

      if (extractionResult.status !== 'success' || !extractionResult.output) {
        throw new Error(extractionResult.details || "Failed to extract data from file.");
      }
      setProgress(60);

      const extractedSteps = extractionResult.output; // Changed access from output.steps to just output
      if (!Array.isArray(extractedSteps) || extractedSteps.length === 0) { // Added Array.isArray check
        throw new Error("No steps found in the uploaded file.");
      }

      // 3. Transform data and create MaintenanceStep entities
      const stepsToCreate = extractedSteps.map(step => {
        const parts_required = [];
        for (let i = 1; i <= 5; i++) {
          const sku = step[`part_${i}_sku`];
          const quantityStr = step[`part_${i}_quantity`];
          if (sku && quantityStr) {
            const quantity = Number(quantityStr);
            if (!isNaN(quantity) && quantity > 0) {
              parts_required.push({ part_sku: sku.toString(), part_name: sku.toString(), quantity: quantity });
            }
          }
        }
        return {
          description: step.description,
          safety_note: step.safety_note || '',
          parts_required,
          device_type: deviceType,
        };
      });

      await MaintenanceStep.bulkCreate(stepsToCreate);
      setProgress(100);
      setResult({ success: true, count: stepsToCreate.length });
      toast({ title: "הייבוא הושלם בהצלחה", description: `${stepsToCreate.length} שלבים נוספו.` });
      
      if (onImportComplete) {
        onImportComplete();
      }
      resetDialog();
    } catch (err) {
      console.error("Import failed:", err);
      setError(err.message || 'אירעה שגיאה לא צפויה.');
      setResult({ success: false });
    } finally {
      setLoading(false);
    }
  };

  const deviceTypeLabel = {
    Astronaut_A3: "Astronaut A3",
    Astronaut_A3N: "Astronaut A3N", 
    Astronaut_A4: "Astronaut A4",
    Delaval_2008: "Delaval 2008",
    Delaval_2011: "Delaval 2011",
    Milk_tank: "מיכל חלב",
    CRS: "CRS+",
    Juno_100: "Juno 100",
    Juno_150: "Juno 150", 
    Luna: "Luna",
    other: "אחר"
  }[deviceType] || deviceType;
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-2xl" onEscapeKeyDown={resetDialog} onPointerDownOutside={resetDialog}>
        <DialogHeader>
          <DialogTitle>ייבוא שלבי תחזוקה</DialogTitle>
          <DialogDescription>
            ייבוא שלבי תחזוקה עבור: <span className="font-bold">{deviceTypeLabel}</span>
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-6">
          
          {/* Template Download Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-blue-500" />
              <h4 className="font-medium">שלב 1: הורד תבנית</h4>
            </div>
            <p className="text-sm text-gray-600">
              הורד את קובץ התבנית כדי לראות את המבנה הנדרש ודוגמאות לנתונים.
            </p>
            <ImportTemplateDownload />
          </div>

          {/* File Upload Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Upload className="h-4 w-4 text-green-500" />
              <h4 className="font-medium">שלב 2: העלה קובץ</h4>
            </div>
            <div>
              <Label htmlFor="import-file">בחר קובץ CSV</Label>
              <Input 
                id="import-file" 
                type="file" 
                onChange={handleFileChange} 
                accept=".csv"
                className="mt-1"
              />
            </div>
          </div>

          {/* Instructions */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>הוראות לשימוש</AlertTitle>
            <AlertDescription className="space-y-1 text-sm">
              <div>• הקובץ חייב להכיל עמודה <code>description</code> עם תיאור השלב</div>
              <div>• עמודת <code>safety_note</code> אופציונלית להערות בטיחות</div>
              <div>• ניתן להוסיף עד 5 חלקים לכל שלב:</div>
              <div className="mr-4">- <code>part_1_sku</code>, <code>part_1_quantity</code></div>
              <div className="mr-4">- <code>part_2_sku</code>, <code>part_2_quantity</code></div>
              <div className="mr-4">- וכן הלאה עד <code>part_5_sku</code>, <code>part_5_quantity</code></div>
              <div>• השאר תאים ריקים אם אין חלק נדרש</div>
            </AlertDescription>
          </Alert>

          {/* Progress */}
          {loading && (
            <div className="space-y-2">
              <Progress value={progress} />
              <p className="text-sm text-center text-gray-500">מעבד נתונים...</p>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertTitle>שגיאה בייבוא</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Success Display */}
          {result?.success && (
            <Alert variant="default" className="bg-green-50 border-green-200 text-green-800">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertTitle>הצלחה!</AlertTitle>
              <AlertDescription>
                {result.count} שלבי תחזוקה יובאו בהצלחה עבור {deviceTypeLabel}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={resetDialog}>
            ביטול
          </Button>
          <Button onClick={handleImport} disabled={loading || !file}>
            <Upload className="w-4 h-4 ml-2" />
            {loading ? 'מייבא...' : 'התחל ייבוא'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
