import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Download, CheckCircle2, XCircle, Loader2, AlertCircle, Plus } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";

// ─── How many SKU columns in the steps template ──────────────────────────
const MAX_PARTS = 8;

// ─── Template definitions ───────────────────────────────────────────────
function buildStepsHeaders() {
  const headers = ["name", "description", "explanation", "brand_name", "unit_type"];
  const headerLabels = ['שם פעולה *', 'תיאור', 'הסבר מפורט', 'שם מותג', 'סוג יחידה'];
  for (let i = 1; i <= MAX_PARTS; i++) {
    headers.push(`sku_${i}`, `qty_${i}`);
    headerLabels.push(`מק"ט ${i}`, `כמות ${i}`);
  }
  return { headers, headerLabels };
}

const { headers: STEPS_HEADERS, headerLabels: STEPS_HEADER_LABELS } = buildStepsHeaders();

const STEPS_EXAMPLE = [
  "החלפת סנן", "החלפת סנן ראשי", "יש לנתק חשמל לפני", "DeLaval", "A3",
  "SKU001", "1", "SKU002", "2",
  ...Array((MAX_PARTS - 2) * 2).fill(""),
];

const TEMPLATES = {
  types: {
    label: "סוגי תחזוקה",
    filename: "template_maintenance_types.xlsx",
    headers: ["name", "description", "estimated_duration_hours", "color", "brand_name", "unit_type"],
    headerLabels: ['שם סוג תחזוקה *', 'תיאור', 'משך משוער (שעות)', 'צבע (hex)', 'שם מותג', 'סוג יחידה'],
    example: ["טיפול 6 חודשי", "טיפול תקופתי כל חצי שנה", "2", "#10b981", "DeLaval", "A3"],
  },
  steps: {
    label: "פעולות תחזוקה",
    filename: "template_maintenance_steps.xlsx",
    headers: STEPS_HEADERS,
    headerLabels: STEPS_HEADER_LABELS,
    example: STEPS_EXAMPLE,
  },
  matrix: {
    label: "מטריצת טיפולים",
    filename: "template_maintenance_matrix.xlsx",
    headers: [], // dynamic — built at download time
    headerLabels: [],
    example: [],
  },
};

async function downloadMatrixTemplate(unitBrands = []) {
  // Fetch live data for matrix template
  const [allTypes, allSteps] = await Promise.all([
    base44.entities.MaintenanceType.list(),
    base44.entities.MaintenanceStep.list(),
  ]);

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("נתונים");

  if (allTypes.length === 0 || allSteps.length === 0) {
    toast.error("יש ליצור סוגי תחזוקה ופעולות תחזוקה לפני הורדת התבנית");
    return;
  }

  // Header row: "שם פעולה" + one column per maintenance type
  const typeNames = allTypes.map(t => t.name);
  const headerRow = ws.addRow(["שם פעולת תחזוקה", ...typeNames]);
  headerRow.font = { bold: true };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2EFDA" } };

  // One row per step
  allSteps.forEach(step => {
    const row = [step.name, ...typeNames.map(() => "")];
    ws.addRow(row);
  });

  // Auto-width
  ws.columns = ["שם פעולת תחזוקה", ...typeNames].map((label) => ({
    width: Math.max(label.length + 4, 12),
  }));

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "template_maintenance_matrix.xlsx"; a.click();
  URL.revokeObjectURL(url);
}

async function downloadTemplate(tabKey, unitBrands = []) {
  if (tabKey === "matrix") { await downloadMatrixTemplate(unitBrands); return; }
  const tpl = TEMPLATES[tabKey];
  const wb = new ExcelJS.Workbook();

  const hasLists = unitBrands.length > 0 && (tabKey === "types" || tabKey === "steps");
  const brandNames = unitBrands.map(b => b.name);
  const allUnitTypes = [...new Set(unitBrands.flatMap(b => b.unit_types || []))];

  if (hasLists) {
    const refSheet = wb.addWorksheet("רשימות עזר");
    refSheet.addRow(["מותגים קיימים", "סוגי יחידות"]);
    const maxRows = Math.max(brandNames.length, allUnitTypes.length);
    for (let i = 0; i < maxRows; i++) {
      refSheet.addRow([brandNames[i] || "", allUnitTypes[i] || ""]);
    }
  }

  const ws = wb.addWorksheet("נתונים");
  const headerRow = ws.addRow(tpl.headerLabels);
  headerRow.font = { bold: true };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2EFDA" } };
  ws.addRow(tpl.example);
  ws.columns = tpl.headerLabels.map((label, i) => ({
    width: Math.max(label.length + 4, (tpl.example[i] || "").length + 4),
  }));

  if (hasLists) {
    const brandColNum = tabKey === "types" ? 5 : 4;
    const unitColNum  = tabKey === "types" ? 6 : 5;
    const brandColLetter = String.fromCharCode(64 + brandColNum);
    const unitColLetter  = String.fromCharCode(64 + unitColNum);

    if (brandNames.length > 0) {
      for (let row = 2; row <= 1000; row++) {
        ws.getCell(`${brandColLetter}${row}`).dataValidation = {
          type: "list", allowBlank: true,
          formulae: [`'רשימות עזר'!$A$2:$A$${1 + brandNames.length}`],
          showErrorMessage: true, errorStyle: "stop",
          errorTitle: "מותג לא תקין", error: "בחר מותג מהרשימה",
        };
      }
    }
    if (allUnitTypes.length > 0) {
      for (let row = 2; row <= 1000; row++) {
        ws.getCell(`${unitColLetter}${row}`).dataValidation = {
          type: "list", allowBlank: true,
          formulae: [`'רשימות עזר'!$B$2:$B$${1 + allUnitTypes.length}`],
          showErrorMessage: true, errorStyle: "stop",
          errorTitle: "סוג יחידה לא תקין", error: "בחר סוג יחידה מהרשימה",
        };
      }
    }
  }

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = tpl.filename; a.click();
  URL.revokeObjectURL(url);
}

function parseXlsx(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: "array" });
        const sheetName = wb.SheetNames.includes("נתונים") ? "נתונים" : wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
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

// Parse parts from new column format (sku_1, qty_1, sku_2, qty_2, ...)
function parsePartsFromRow(obj) {
  const parts = [];
  for (let i = 1; i <= MAX_PARTS; i++) {
    const sku = obj[`sku_${i}`]?.trim();
    if (!sku) continue;
    const qty = parseFloat(obj[`qty_${i}`]) || 1;
    parts.push({ part_sku: sku, quantity: qty });
  }
  return parts;
}

// ─── Missing SKU resolution dialog ───────────────────────────────────────
function MissingSkuResolver({ missingSKUs, allParts, onResolve }) {
  const [resolutions, setResolutions] = useState(() => {
    const init = {};
    missingSKUs.forEach(sku => { init[sku] = { action: "skip", newSku: "", newName: "", newCategory: "general" }; });
    return init;
  });

  const setAction = (sku, action) => {
    setResolutions(prev => ({ ...prev, [sku]: { ...prev[sku], action } }));
  };
  const setField = (sku, field, value) => {
    setResolutions(prev => ({ ...prev, [sku]: { ...prev[sku], [field]: value } }));
  };

  const handleConfirm = () => {
    onResolve(resolutions);
  };

  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
        <div className="flex items-center gap-2 text-amber-700 font-medium text-sm mb-1">
          <AlertCircle className="h-4 w-4" />
          נמצאו {missingSKUs.length} מק"טים שאינם קיימים בניהול פריטים
        </div>
        <p className="text-xs text-amber-600">בחר פעולה לכל מק"ט</p>
      </div>

      <div className="space-y-3 max-h-80 overflow-y-auto">
        {missingSKUs.map(sku => {
          const res = resolutions[sku];
          return (
            <div key={sku} className="border rounded-lg p-3 space-y-2 bg-white">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono text-xs">{sku}</Badge>
                <span className="text-xs text-slate-500">לא נמצא בניהול פריטים</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: "skip", label: "דלג" },
                  { value: "create", label: "צור פריט חדש" },
                  { value: "replace", label: "בחר חלוף" },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setAction(sku, opt.value)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                      res.action === opt.value
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {res.action === "create" && (
                <div className="space-y-2 pt-1">
                  <Input
                    placeholder="שם הפריט *"
                    value={res.newName}
                    onChange={e => setField(sku, "newName", e.target.value)}
                    className="h-8 text-sm"
                  />
                  <Input
                    placeholder="קטגוריה"
                    value={res.newCategory}
                    onChange={e => setField(sku, "newCategory", e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
              )}

              {res.action === "replace" && (
                <Select value={res.newSku} onValueChange={v => setField(sku, "newSku", v)}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="בחר פריט חלוף..." />
                  </SelectTrigger>
                  <SelectContent>
                    {allParts.map(p => (
                      <SelectItem key={p.sku} value={p.sku}>
                        {p.sku} — {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-end pt-2 border-t">
        <Button onClick={handleConfirm} className="gap-2">
          <CheckCircle2 className="h-4 w-4" />
          המשך ייבוא
        </Button>
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────
export default function MaintenanceImportDialog({ open, onClose, tabKey, unitBrands = [], onImported }) {
  const [file, setFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState(null);
  // Steps-specific SKU resolution state
  const [pendingData, setPendingData] = useState(null); // { objects, existingSteps }
  const [missingSKUs, setMissingSKUs] = useState(null); // array of sku strings
  const [allParts, setAllParts] = useState([]);

  const tpl = TEMPLATES[tabKey] || TEMPLATES.types;

  const handleFile = (e) => {
    setFile(e.target.files[0] || null);
    setResults(null);
    setMissingSKUs(null);
    setPendingData(null);
  };

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    setResults(null);
    setMissingSKUs(null);
    setPendingData(null);

    try {
      const rows = await parseXlsx(file);
      const objects = rowsToObjects(rows, tpl.headers);

      if (objects.length === 0) {
        toast.error("לא נמצאו שורות תקינות בקובץ");
        setImporting(false);
        return;
      }

      if (tabKey === "types") {
        await importTypes(objects);
      } else if (tabKey === "steps") {
        await prepareStepsImport(objects);
      } else if (tabKey === "matrix") {
        await importMatrix(); // parses raw rows internally
      }
    } catch (e) {
      toast.error("שגיאה בעיבוד הקובץ: " + e.message);
    } finally {
      setImporting(false);
    }
  };

  // ── Import: types (unchanged logic) ────────────────────────────────────
  const importTypes = async (objects) => {
    const existingTypes = await base44.entities.MaintenanceType.list();
    let successCount = 0;
    const errors = [];

    for (const obj of objects) {
      if (!obj.name) { errors.push("שורה ללא שם סוג תחזוקה"); continue; }
      let brand = null;
      if (obj.brand_name) {
        brand = unitBrands.find(b => b.name.toLowerCase() === obj.brand_name.toLowerCase());
        if (!brand) { errors.push(`מותג לא קיים: "${obj.brand_name}" (שורה: ${obj.name})`); continue; }
      }
      const unit_type = obj.unit_type || "";
      if (brand && unit_type && !(brand.unit_types || []).some(ut => ut.toLowerCase() === unit_type.toLowerCase())) {
        errors.push(`סוג יחידה "${unit_type}" לא קיים במותג "${obj.brand_name}" (שורה: ${obj.name})`); continue;
      }
      const brand_id = brand?.id || "";
      const existing = existingTypes.find(t =>
        t.name === obj.name && (t.brand_id || "") === brand_id && (t.unit_type || "") === unit_type
      );
      try {
        const payload = {
          name: obj.name,
          description: obj.description || "",
          estimated_duration_hours: parseFloat(obj.estimated_duration_hours) || 1,
          color: obj.color || "#10b981",
          brand_id,
          unit_type,
        };
        if (existing) {
          await base44.entities.MaintenanceType.update(existing.id, payload);
        } else {
          await base44.entities.MaintenanceType.create(payload);
        }
        successCount++;
      } catch (e) { errors.push(`שגיאה ב-"${obj.name}": ${e.message}`); }
    }

    setResults({ success: successCount, errors });
    if (successCount > 0) { toast.success(`יובאו בהצלחה ${successCount} רשומות`); if (onImported) onImported(); }
  };

  // ── Import: steps — phase 1: parse & check SKUs ─────────────────────────
  const prepareStepsImport = async (objects) => {
    const [existingSteps, parts] = await Promise.all([
      base44.entities.MaintenanceStep.list(),
      base44.entities.PartCore.list(),
    ]);
    setAllParts(parts);

    // Collect all unique SKUs from the file
    const allSkus = new Set();
    for (const obj of objects) {
      const parts_raw = parsePartsFromRow(obj);
      parts_raw.forEach(p => allSkus.add(p.part_sku));
    }

    const partMap = {};
    parts.forEach(p => { partMap[p.sku] = p; });

    const missing = [...allSkus].filter(sku => !partMap[sku]);

    if (missing.length > 0) {
      setMissingSKUs(missing);
      setPendingData({ objects, existingSteps, partMap });
      return; // pause — wait for user to resolve
    }

    // All SKUs found — proceed directly
    await finishStepsImport(objects, existingSteps, partMap, {});
  };

  // ── Import: steps — phase 2: after SKU resolution ───────────────────────
  const handleSkuResolved = async (resolutions) => {
    setImporting(true);
    const { objects, existingSteps, partMap } = pendingData;

    // Apply resolutions: create new parts, build replacement map
    const replacementMap = {}; // missing sku → actual sku to use (or null = skip)
    const errors = [];

    for (const [sku, res] of Object.entries(resolutions)) {
      if (res.action === "skip") {
        replacementMap[sku] = null;
      } else if (res.action === "replace") {
        if (!res.newSku) { errors.push(`לא נבחר חלוף עבור ${sku} — שלב ידולג`); replacementMap[sku] = null; }
        else {
          const part = allParts.find(p => p.sku === res.newSku);
          replacementMap[sku] = res.newSku;
          if (part) partMap[res.newSku] = part;
        }
      } else if (res.action === "create") {
        if (!res.newName) { errors.push(`לא הוזן שם עבור מק"ט ${sku} — שלב ידולג`); replacementMap[sku] = null; continue; }
        try {
          const created = await base44.entities.PartCore.create({
            sku,
            name: res.newName,
            category: res.newCategory || "general",
            unit: "יח'",
          });
          partMap[sku] = created;
          replacementMap[sku] = sku; // keep original sku
        } catch (e) {
          errors.push(`שגיאה ביצירת פריט ${sku}: ${e.message}`);
          replacementMap[sku] = null;
        }
      }
    }

    const { success, importErrors } = await finishStepsImport(objects, existingSteps, partMap, replacementMap);
    setResults({ success, errors: [...errors, ...importErrors] });
    setMissingSKUs(null);
    setPendingData(null);
    setImporting(false);
  };

  const finishStepsImport = async (objects, existingSteps, partMap, replacementMap) => {
    let successCount = 0;
    const errors = [];

    for (const obj of objects) {
      if (!obj.name) { errors.push("שורה ללא שם פעולה"); continue; }

      let brand = null;
      if (obj.brand_name) {
        brand = unitBrands.find(b => b.name.toLowerCase() === obj.brand_name.toLowerCase());
        if (!brand) { errors.push(`מותג לא קיים: "${obj.brand_name}" (שורה: ${obj.name})`); continue; }
      }
      const unit_type = obj.unit_type || "";
      if (brand && unit_type && !(brand.unit_types || []).some(ut => ut.toLowerCase() === unit_type.toLowerCase())) {
        errors.push(`סוג יחידה "${unit_type}" לא קיים במותג "${obj.brand_name}" (שורה: ${obj.name})`); continue;
      }
      const brand_id = brand?.id || "";

      // Build parts_required with resolved SKUs and names from PartCore
      const rawParts = parsePartsFromRow(obj);
      const parts_required = [];
      for (const p of rawParts) {
        let sku = p.part_sku;
        if (replacementMap.hasOwnProperty(sku)) {
          sku = replacementMap[sku]; // may be null (skip)
        }
        if (!sku) continue; // skip this part
        const partData = partMap[sku];
        parts_required.push({
          part_sku: sku,
          part_name: partData?.name || sku,
          quantity: p.quantity,
        });
      }

      const existing = existingSteps.find(s =>
        s.name === obj.name && (s.brand_id || "") === brand_id && (s.unit_type || "") === unit_type
      );
      try {
        const payload = {
          name: obj.name,
          description: obj.description || "",
          explanation: obj.explanation || "",
          brand_id,
          unit_type,
          parts_required,
        };
        if (existing) {
          await base44.entities.MaintenanceStep.update(existing.id, payload);
        } else {
          await base44.entities.MaintenanceStep.create(payload);
        }
        successCount++;
      } catch (e) { errors.push(`שגיאה ב-"${obj.name}": ${e.message}`); }
    }

    if (!missingSKUs) {
      // called directly (no missing SKUs path)
      setResults({ success: successCount, errors });
      if (successCount > 0) { toast.success(`יובאו בהצלחה ${successCount} רשומות`); if (onImported) onImported(); }
    } else {
      if (successCount > 0) { toast.success(`יובאו בהצלחה ${successCount} רשומות`); if (onImported) onImported(); }
    }

    return { success: successCount, importErrors: errors };
  };

  // ── Import: matrix (pivoted format) ────────────────────────────────────
  // Rows = steps, Columns = maintenance types, X = included
  const importMatrix = async () => {
    const [allTypes, allSteps] = await Promise.all([
      base44.entities.MaintenanceType.list(),
      base44.entities.MaintenanceStep.list(),
    ]);

    // Parse raw rows (not rowsToObjects — we need the raw array format)
    const rawRows = await parseXlsx(file);
    if (rawRows.length < 2) { setResults({ success: 0, errors: ["הקובץ ריק"] }); return; }

    const headerRow = rawRows[0].map(h => String(h).trim());
    // headerRow[0] = "שם פעולת תחזוקה", headerRow[1..] = maintenance type names
    const typeNamesInFile = headerRow.slice(1);

    // Map type names → type objects
    const typeMap = {};
    const errors = [];
    typeNamesInFile.forEach(name => {
      const found = allTypes.find(t => t.name === name);
      if (!found) errors.push(`סוג תחזוקה לא נמצא: "${name}"`);
      else typeMap[name] = found;
    });

    // Build a map: typeId → list of step configs to add
    const typeStepConfigs = {}; // typeId → Set of step ids to include
    allTypes.forEach(t => { typeStepConfigs[t.id] = new Set(); });

    for (let i = 1; i < rawRows.length; i++) {
      const row = rawRows[i];
      const stepName = String(row[0] || "").trim();
      if (!stepName) continue;
      const step = allSteps.find(s => s.name === stepName);
      if (!step) { errors.push(`פעולת תחזוקה לא נמצאה: "${stepName}"`); continue; }

      typeNamesInFile.forEach((typeName, colIdx) => {
        const cell = String(row[colIdx + 1] || "").trim().toLowerCase();
        if (cell === "x" || cell === "✓" || cell === "v") {
          const mType = typeMap[typeName];
          if (mType) typeStepConfigs[mType.id].add(step.id);
        }
      });
    }

    // Update each type with its new step configs
    let successCount = 0;
    for (const mType of allTypes) {
      const stepIdsToAdd = typeStepConfigs[mType.id];
      if (stepIdsToAdd.size === 0) continue;

      const existingConfigs = mType.step_configs || [];
      const mergedConfigs = [...existingConfigs];
      for (const stepId of stepIdsToAdd) {
        if (mergedConfigs.find(c => c.step_id === stepId)) continue;
        const step = allSteps.find(s => s.id === stepId);
        if (!step) continue;
        const defaultParts = (step.parts_required || []).map(p => ({ ...p }));
        mergedConfigs.push({ step_id: step.id, step_name: step.name, enabled: true, custom_parts: defaultParts });
      }
      try {
        await base44.entities.MaintenanceType.update(mType.id, { step_configs: mergedConfigs });
        successCount++;
      } catch (e) { errors.push(`שגיאה ב-"${mType.name}": ${e.message}`); }
    }

    setResults({ success: successCount, errors });
    if (successCount > 0) { toast.success(`עודכנו ${successCount} סוגי תחזוקה`); if (onImported) onImported(); }
  };

  const handleClose = () => {
    setFile(null);
    setResults(null);
    setMissingSKUs(null);
    setPendingData(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && handleClose()}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-emerald-600" />
            ייבוא {tpl.label} מאקסל
          </DialogTitle>
        </DialogHeader>

        {/* Phase 2: SKU resolution */}
        {missingSKUs ? (
          <MissingSkuResolver
            missingSKUs={missingSKUs}
            allParts={allParts}
            onResolve={handleSkuResolved}
          />
        ) : (
          <div className="space-y-4">
            {/* Step 1: Download template */}
            <div className="bg-slate-50 rounded-lg p-4 space-y-2">
              <p className="text-sm font-medium text-slate-700">שלב 1 — הורד תבנית</p>
              {tabKey === "steps" && (
                <p className="text-xs text-slate-500">
                  הטמפלט כולל {MAX_PARTS} זוגות עמודות מק"ט/כמות. שם החלק יאוכלס אוטומטית מניהול פריטים.
                </p>
              )}
              <p className="text-xs text-slate-500">הורד את קובץ האקסל לדוגמה, מלא את הנתונים ושמור.</p>
              <Button variant="outline" size="sm" onClick={() => downloadTemplate(tabKey, unitBrands)} className="gap-2">
                <Download className="h-4 w-4" />
                הורד תבנית ({tpl.filename})
              </Button>
            </div>

            {/* Step 2: Upload */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">שלב 2 — העלה קובץ</p>
              <label className={`flex flex-col items-center gap-2 p-4 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${file ? "border-emerald-400 bg-emerald-50" : "border-slate-300 hover:border-emerald-400 hover:bg-slate-50"}`}>
                <Upload className={`h-8 w-8 ${file ? "text-emerald-500" : "text-slate-400"}`} />
                <span className="text-sm text-slate-600">{file ? file.name : 'לחץ לבחירת קובץ .xlsx'}</span>
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
        )}
      </DialogContent>
    </Dialog>
  );
}