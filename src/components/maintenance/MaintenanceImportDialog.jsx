import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, Download, CheckCircle2, XCircle, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

// ─── Template definitions ───────────────────────────────────────────────
const TEMPLATES = {
  types: {
    label: "סוגי תחזוקה",
    filename: "template_maintenance_types.xlsx",
    headers: ["name", "description", "estimated_duration_hours", "color"],
    headerLabels: ["שם סוג תחזוקה *", "תיאור", "משך משוער (שעות)", "צבע (hex)"],
    example: ["טיפול 6 חודשי", "טיפול תקופתי כל חצי שנה", "2", "#10b981"],
  },
  steps: {
    label: "פעולות תחזוקה",
    filename: "template_maintenance_steps.xlsx",
    headers: ["name", "description", "explanation", "brand_name", "unit_type", "parts_skus", "parts_names", "parts_quantities"],
    headerLabels: ["שם פעולה *", "תיאור", "הסבר מפורט", "שם מותג", "סוג יחידה", "מק\"ט חלקים (בפסיק)", "שם חלקים (בפסיק)", "כמויות (בפסיק)"],
    example: ["החלפת סנן", "החלפת סנן ראשי", "יש לנתק חשמל לפני", "DeLaval", "A3", "SKU001,SKU002", "סנן ראשי,אוטומה", "1,2"],
  },
  matrix: {
    label: "מטריצת טיפולים",
    filename: "template_maintenance_matrix.xlsx",
    headers: ["maintenance_type_name", "step_names"],
    headerLabels: ["שם סוג תחזוקה *", "שמות פעולות (מופרדות בפסיק) *"],
    example: ["טיפול 6 חודשי", "החלפת סנן,ניקוי מחלב,בדיקת לחץ"],
  },
};

function downloadTemplate(tabKey) {
  const tpl = TEMPLATES[tabKey];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([tpl.headerLabels, tpl.example]);
  XLSX.utils.book_append_sheet(wb, ws, "נתונים");
  XLSX.writeFile(wb, tpl.filename);
}

// ─── Parse helpers ───────────────────────────────────────────────────────
function parseXlsx(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
        resolve(rows);
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

function rowsToObjects(rows, headers) {
  if (rows.length < 2) return [];
  return rows.slice(1).filter(r => r.some(c => String(c).trim())).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = String(row[i] || "").trim(); });
    return obj;
  });
}

export default function MaintenanceImportDialog({ open, onClose, tabKey, unitBrands = [], onImported }) {
  const [file, setFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState(null); // {success, errors}

  const tpl = TEMPLATES[tabKey] || TEMPLATES.types;

  const handleFile = (e) => {
    setFile(e.target.files[0] || null);
    setResults(null);
  };

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    setResults(null);
    try {
      const rows = await parseXlsx(file);
      const objects = rowsToObjects(rows, tpl.headers);

      if (objects.length === 0) {
        toast.error("לא נמצאו שורות תקינות בקובץ");
        setImporting(false);
        return;
      }

      let successCount = 0;
      const errors = [];

      if (tabKey === "types") {
        for (const obj of objects) {
          if (!obj.name) { errors.push(`שורה ללא שם סוג תחזוקה`); continue; }
          try {
            await base44.entities.MaintenanceType.create({
              name: obj.name,
              description: obj.description || "",
              estimated_duration_hours: parseFloat(obj.estimated_duration_hours) || 1,
              color: obj.color || "#10b981",
            });
            successCount++;
          } catch (e) { errors.push(`שגיאה ב-"${obj.name}": ${e.message}`); }
        }
      }

      else if (tabKey === "steps") {
        for (const obj of objects) {
          if (!obj.name) { errors.push(`שורה ללא שם פעולה`); continue; }
          // resolve brand_id from name
          const brand = unitBrands.find(b => b.name === obj.brand_name);
          const brand_id = brand?.id || "";

          // parse parts
          let parts_required = [];
          if (obj.parts_skus) {
            const skus = obj.parts_skus.split(",").map(s => s.trim()).filter(Boolean);
            const names = obj.parts_names.split(",").map(s => s.trim());
            const qtys = obj.parts_quantities.split(",").map(s => parseFloat(s.trim()) || 1);
            parts_required = skus.map((sku, i) => ({ part_sku: sku, part_name: names[i] || sku, quantity: qtys[i] || 1 }));
          }
          try {
            await base44.entities.MaintenanceStep.create({
              name: obj.name,
              description: obj.description || "",
              explanation: obj.explanation || "",
              brand_id,
              unit_type: obj.unit_type || "",
              parts_required,
            });
            successCount++;
          } catch (e) { errors.push(`שגיאה ב-"${obj.name}": ${e.message}`); }
        }
      }

      else if (tabKey === "matrix") {
        // Load all types and steps first
        const [allTypes, allSteps] = await Promise.all([
          base44.entities.MaintenanceType.list(),
          base44.entities.MaintenanceStep.list(),
        ]);
        for (const obj of objects) {
          if (!obj.maintenance_type_name || !obj.step_names) { errors.push(`שורה חסרה`); continue; }
          const mType = allTypes.find(t => t.name === obj.maintenance_type_name);
          if (!mType) { errors.push(`סוג תחזוקה לא נמצא: "${obj.maintenance_type_name}"`); continue; }
          const stepNames = obj.step_names.split(",").map(s => s.trim()).filter(Boolean);
          const newConfigs = [];
          for (const sName of stepNames) {
            const step = allSteps.find(s => s.name === sName);
            if (!step) { errors.push(`פעולה לא נמצאה: "${sName}" (סוג: ${obj.maintenance_type_name})`); continue; }
            const defaultParts = (step.parts_required || []).map(p => ({ ...p }));
            newConfigs.push({ step_id: step.id, step_name: step.name, enabled: true, custom_parts: defaultParts });
          }
          // Merge with existing configs
          const existingConfigs = mType.step_configs || [];
          const mergedConfigs = [...existingConfigs];
          for (const nc of newConfigs) {
            if (!mergedConfigs.find(c => c.step_id === nc.step_id)) mergedConfigs.push(nc);
          }
          try {
            await base44.entities.MaintenanceType.update(mType.id, { step_configs: mergedConfigs });
            successCount++;
          } catch (e) { errors.push(`שגיאה ב-"${obj.maintenance_type_name}": ${e.message}`); }
        }
      }

      setResults({ success: successCount, errors });
      if (successCount > 0) {
        toast.success(`יובאו בהצלחה ${successCount} רשומות`);
        if (onImported) onImported();
      }
    } catch (e) {
      toast.error("שגיאה בעיבוד הקובץ: " + e.message);
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setResults(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={open => !open && handleClose()}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-emerald-600" />
            ייבוא {tpl.label} מאקסל
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Step 1: Download template */}
          <div className="bg-slate-50 rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium text-slate-700">שלב 1 — הורד תבנית</p>
            <p className="text-xs text-slate-500">הורד את קובץ האקסל לדוגמה, מלא את הנתונים ושמור.</p>
            <Button variant="outline" size="sm" onClick={() => downloadTemplate(tabKey)} className="gap-2">
              <Download className="h-4 w-4" />
              הורד תבנית ({tpl.filename})
            </Button>
          </div>

          {/* Step 2: Upload */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700">שלב 2 — העלה קובץ</p>
            <label className={`flex flex-col items-center gap-2 p-4 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${file ? "border-emerald-400 bg-emerald-50" : "border-slate-300 hover:border-emerald-400 hover:bg-slate-50"}`}>
              <Upload className={`h-8 w-8 ${file ? "text-emerald-500" : "text-slate-400"}`} />
              <span className="text-sm text-slate-600">{file ? file.name : "לחץ לבחירת קובץ .xlsx"}</span>
              <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
            </label>
          </div>

          {/* Results */}
          {results && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span className="text-emerald-700 font-medium">{results.success} רשומות יובאו בהצלחה</span>
              </div>
              {results.errors.length > 0 && (
                <div className="bg-red-50 rounded-lg p-3 space-y-1 max-h-32 overflow-y-auto">
                  {results.errors.map((err, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-xs text-red-700">
                      <XCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <span>{err}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={handleClose}>סגור</Button>
            <Button onClick={handleImport} disabled={!file || importing} className="gap-2">
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {importing ? "מייבא..." : "ייבא"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}