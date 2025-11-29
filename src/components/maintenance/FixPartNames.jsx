import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, AlertTriangle, Wrench } from "lucide-react";
import { MaintenanceStep, Part } from "@/entities/all";

export default function FixPartNames() {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const fixPartNames = async () => {
    setIsRunning(true);
    setProgress(0);
    setError('');
    setResult(null);

    try {
      // Load all parts from stock for reference
      const allParts = await Part.list();
      const partsBySku = new Map(allParts.map(part => [part.sku, part]));

      // Load all maintenance steps
      const maintenanceSteps = await MaintenanceStep.list();
      
      let totalSteps = maintenanceSteps.length;
      let updatedSteps = 0;
      let fixedParts = 0;

      for (let i = 0; i < maintenanceSteps.length; i++) {
        const step = maintenanceSteps[i];
        setProgress(Math.floor(((i + 1) / totalSteps) * 100));

        let hasChanges = false;
        const updatedPartsRequired = [];

        if (step.parts_required && Array.isArray(step.parts_required)) {
          for (const part of step.parts_required) {
            if (part.part_sku && part.part_name === part.part_sku) {
              // Part name matches SKU, need to fix it
              const stockPart = partsBySku.get(part.part_sku);
              if (stockPart && stockPart.name !== part.part_sku) {
                // Found the part in stock with a different name
                updatedPartsRequired.push({
                  ...part,
                  part_name: stockPart.name
                });
                hasChanges = true;
                fixedParts++;
              } else {
                updatedPartsRequired.push(part);
              }
            } else {
              updatedPartsRequired.push(part);
            }
          }
        }

        if (hasChanges) {
          await MaintenanceStep.update(step.id, {
            parts_required: updatedPartsRequired
          });
          updatedSteps++;
        }

        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      setResult({
        totalSteps,
        updatedSteps,
        fixedParts
      });

    } catch (err) {
      console.error('Error fixing part names:', err);
      setError(`שגיאה בתיקון שמות החלקים: ${err.message}`);
    } finally {
      setIsRunning(false);
      setProgress(100);
    }
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wrench className="h-5 w-5 text-blue-600" />
          תיקון שמות חלקים בשלבי תחזוקה
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>פעולה חד פעמית:</strong> יתקן שמות חלקים בשלבי תחזוקה שבהם שם החלק זהה למק"ט. 
            השם יעודכן לפי שם החלק האמיתי במלאי.
          </AlertDescription>
        </Alert>

        {isRunning && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>מתקן שמות חלקים...</span>
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

        {result && (
          <Alert>
            <CheckCircle className="h-4 w-4 text-green-500" />
            <AlertDescription>
              <div className="font-medium text-green-600 mb-2">
                התיקון הושלם בהצלחה!
              </div>
              <div className="text-sm space-y-1">
                <div>סה"כ שלבי תחזוקה נבדקו: {result.totalSteps}</div>
                <div>שלבי תחזוקה עודכנו: {result.updatedSteps}</div>
                <div>שמות חלקים תוקנו: {result.fixedParts}</div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <Button 
          onClick={fixPartNames}
          disabled={isRunning || (result && result.fixedParts === 0)}
          className={result && result.fixedParts >= 0 ? "bg-green-600 hover:bg-green-700" : ""}
        >
          {result && result.fixedParts >= 0 ? (
            <>
              <CheckCircle className="h-4 w-4 mr-2" />
              התיקון הושלם
            </>
          ) : (
            <>
              <Wrench className="h-4 w-4 mr-2" />
              {isRunning ? "מתקן..." : "הפעל תיקון שמות חלקים"}
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}