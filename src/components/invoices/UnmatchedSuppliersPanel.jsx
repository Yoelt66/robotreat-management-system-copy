import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Link2, Plus, Loader2, CheckCircle2, X } from "lucide-react";
import { toast } from "sonner";

/**
 * Fuzzy-match: returns similarity ratio between two normalized strings (0-1).
 * Uses character bigrams for a language-agnostic approach.
 */
function similarity(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const getBigrams = (str) => {
    const s = new Set();
    for (let i = 0; i < str.length - 1; i++) s.add(str.substring(i, i + 2));
    return s;
  };
  const bigramsA = getBigrams(a);
  const bigramsB = getBigrams(b);
  let intersection = 0;
  for (const bigram of bigramsA) if (bigramsB.has(bigram)) intersection++;
  return (2 * intersection) / (bigramsA.size + bigramsB.size);
}

function normalizeName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .trim()
    .replace(/בע"מ|בעמ|בע מ|ltd\.?|inc\.?|gmbh|co\.|s\.a\.|llc\.?/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export default function UnmatchedSuppliersPanel({ suppliers, onSuppliersChanged }) {
  const [open, setOpen] = useState(false);
  const [unmatchedNames, setUnmatchedNames] = useState([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [hasUnmatched, setHasUnmatched] = useState(false);

  // Link state
  const [linkingName, setLinkingName] = useState(null);
  const [linkTarget, setLinkTarget] = useState("");
  const [savingLink, setSavingLink] = useState(false);

  // Create new supplier state
  const [creatingFor, setCreatingFor] = useState(null);
  const [newSupplierName, setNewSupplierName] = useState("");
  const [savingNew, setSavingNew] = useState(false);
  const [similarWarning, setSimilarWarning] = useState(null);

  const generateSupplierNumber = async () => {
    const allSuppliers = await base44.entities.Supplier.list();
    const existingNumbers = allSuppliers
      .map(s => s.supplier_number)
      .filter(num => num && num.startsWith('SUP-'))
      .map(num => parseInt(num.replace('SUP-', '')) || 0);
    const maxNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
    return `SUP-${String(maxNumber + 1).padStart(4, '0')}`;
  };

  const loadUnmatched = useCallback(async () => {
    setLoadingStats(true);
    try {
      const result = await base44.functions.invoke('getSupplierStats', {
        year: new Date().getFullYear()
      });
      const names = result.data?.unmatched_names || [];
      setUnmatchedNames(names);
      setHasUnmatched(names.length > 0);
    } catch (err) {
      console.error("Error loading unmatched suppliers:", err);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    loadUnmatched();
  }, [loadUnmatched]);

  // Check for similar supplier names as user types
  useEffect(() => {
    if (!newSupplierName || newSupplierName.length < 3) {
      setSimilarWarning(null);
      return;
    }
    const norm = normalizeName(newSupplierName);
    const matches = suppliers
      .map(s => ({ s, score: similarity(norm, normalizeName(s.name)) }))
      .filter(x => x.score > 0.6)
      .sort((a, b) => b.score - a.score);
    setSimilarWarning(matches.length > 0 ? matches[0].s : null);
  }, [newSupplierName, suppliers]);

  const handleLinkToExisting = async () => {
    if (!linkingName || !linkTarget) return;
    setSavingLink(true);
    try {
      const supplier = suppliers.find(s => s.id === linkTarget);
      if (!supplier) throw new Error("ספק לא נמצא");
      const currentAliases = supplier.aliases || [];
      if (!currentAliases.includes(linkingName)) {
        await base44.entities.Supplier.update(supplier.id, {
          aliases: [...currentAliases, linkingName]
        });
      }
      toast.success(`"${linkingName}" שויך ל"${supplier.name}" בהצלחה`);
      setLinkingName(null);
      setLinkTarget("");
      await loadUnmatched();
      onSuppliersChanged?.();
    } catch (err) {
      toast.error("שגיאה בשמירת השיוך");
    } finally {
      setSavingLink(false);
    }
  };

  const handleCreateNew = async (forceCreate = false) => {
    if (!creatingFor || !newSupplierName.trim()) return;
    if (similarWarning && !forceCreate) return;

    setSavingNew(true);
    try {
      const supplierNumber = await generateSupplierNumber();
      const created = await base44.entities.Supplier.create({
        name: newSupplierName.trim(),
        supplier_number: supplierNumber,
        aliases: creatingFor !== newSupplierName.trim() ? [creatingFor] : [],
        is_active: true,
      });
      toast.success(`ספק "${newSupplierName}" נוצר ושויך בהצלחה`);
      setCreatingFor(null);
      setNewSupplierName("");
      setSimilarWarning(null);
      await loadUnmatched();
      onSuppliersChanged?.();
    } catch (err) {
      toast.error("שגיאה ביצירת הספק");
    } finally {
      setSavingNew(false);
    }
  };

  if (loadingStats) return null;
  if (!hasUnmatched) return null;

  return (
    <>
      <Alert className="border-amber-300 bg-amber-50 cursor-pointer" onClick={() => setOpen(true)}>
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <AlertDescription className="flex items-center justify-between">
          <span className="text-amber-800 font-medium">
            {unmatchedNames.length} ספקי חשבוניות לא משויכים לספק רשמי
          </span>
          <Button size="sm" variant="outline" className="border-amber-400 text-amber-700 hover:bg-amber-100 mr-2">
            <Link2 className="h-3.5 w-3.5 ml-1" />
            נהל שיוכים
          </Button>
        </AlertDescription>
      </Alert>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              ספקים לא משויכים ({unmatchedNames.length})
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            {unmatchedNames.map((name) => (
              <div key={name} className="border rounded-lg p-3 bg-slate-50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-800 text-sm">{name}</span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-7"
                      onClick={() => {
                        setCreatingFor(null);
                        setLinkingName(name);
                        setLinkTarget("");
                      }}
                    >
                      <Link2 className="h-3 w-3 ml-1" />
                      שייך לקיים
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-7"
                      onClick={() => {
                        setLinkingName(null);
                        setCreatingFor(name);
                        setNewSupplierName(name);

                        setSimilarWarning(null);
                      }}
                    >
                      <Plus className="h-3 w-3 ml-1" />
                      ספק חדש
                    </Button>
                  </div>
                </div>

                {/* Link to existing supplier */}
                {linkingName === name && (
                  <div className="space-y-2 border-t pt-2">
                    <Label className="text-xs text-slate-600">בחר ספק קיים לשייך אליו:</Label>
                    <Select value={linkTarget} onValueChange={setLinkTarget}>
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="בחר ספק..." />
                      </SelectTrigger>
                      <SelectContent>
                        {suppliers.map(s => (
                          <SelectItem key={s.id} value={s.id}>{s.name} ({s.supplier_number})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex gap-2">
                      <Button size="sm" className="h-7 text-xs" onClick={handleLinkToExisting} disabled={!linkTarget || savingLink}>
                        {savingLink ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3 ml-1" />}
                        שמור שיוך
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setLinkingName(null)}>
                        ביטול
                      </Button>
                    </div>
                  </div>
                )}

                {/* Create new supplier */}
                {creatingFor === name && (
                  <div className="space-y-2 border-t pt-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-600">שם רשמי לספק *</Label>
                      <Input
                        value={newSupplierName}
                        onChange={e => setNewSupplierName(e.target.value)}
                        placeholder="שם הספק הרשמי"
                        className="h-8 text-sm"
                      />
                    </div>

                    {similarWarning && (
                      <Alert className="border-orange-300 bg-orange-50 py-2">
                        <AlertTriangle className="h-3.5 w-3.5 text-orange-600" />
                        <AlertDescription className="text-xs text-orange-800">
                          ספק דומה קיים: <strong>{similarWarning.name}</strong>.
                          <br />
                          <button className="underline ml-1" onClick={() => { setLinkingName(name); setCreatingFor(null); setLinkTarget(similarWarning.id); }}>
                            שייך אליו במקום
                          </button>
                          {" | "}
                          <button className="underline" onClick={() => handleCreateNew(true)}>
                            צור בכל זאת
                          </button>
                        </AlertDescription>
                      </Alert>
                    )}

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => handleCreateNew(false)}
                        disabled={!newSupplierName.trim() || savingNew || !!similarWarning}
                      >
                        {savingNew ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3 ml-1" />}
                        צור ספק
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setCreatingFor(null); setSimilarWarning(null); }}>
                        ביטול
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}