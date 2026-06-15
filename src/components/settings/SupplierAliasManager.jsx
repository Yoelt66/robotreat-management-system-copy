import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Supplier } from "@/entities/Supplier";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, X, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function SupplierAliasManager() {
  const [suppliers, setSuppliers] = useState([]);
  const [unmatchedNames, setUnmatchedNames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null); // supplier id being saved
  const [newAlias, setNewAlias] = useState({}); // keyed by supplier id

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [suppliersData, statsResult] = await Promise.all([
        Supplier.list(),
        base44.functions.invoke('getSupplierStats', {}),
      ]);
      setSuppliers(suppliersData);
      setUnmatchedNames(statsResult.data?.unmatched_names || []);
    } catch (error) {
      console.error("Error loading alias data:", error);
      toast.error("שגיאה בטעינת הנתונים");
    } finally {
      setLoading(false);
    }
  };

  const handleAddAlias = async (supplier, alias) => {
    if (!alias || !alias.trim()) return;
    const trimmed = alias.trim();

    // Check for duplicate across all suppliers
    const duplicate = suppliers.find(
      (s) => s.id !== supplier.id && (s.aliases || []).some(
        (a) => a.toLowerCase() === trimmed.toLowerCase()
      )
    );
    if (duplicate) {
      toast.error(`הכינוי "${trimmed}" כבר משויך לספק "${duplicate.name}"`);
      return;
    }

    const updatedAliases = [...(supplier.aliases || []), trimmed];
    setSaving(supplier.id);
    try {
      await Supplier.update(supplier.id, { aliases: updatedAliases });
      setSuppliers((prev) =>
        prev.map((s) => s.id === supplier.id ? { ...s, aliases: updatedAliases } : s)
      );
      setNewAlias((prev) => ({ ...prev, [supplier.id]: '' }));
      // Remove from unmatched if it was there
      setUnmatchedNames((prev) => prev.filter(
        (n) => n.toLowerCase() !== trimmed.toLowerCase()
      ));
      toast.success("כינוי נוסף בהצלחה");
    } catch (error) {
      toast.error("שגיאה בשמירת הכינוי");
    } finally {
      setSaving(null);
    }
  };

  const handleRemoveAlias = async (supplier, aliasToRemove) => {
    const updatedAliases = (supplier.aliases || []).filter((a) => a !== aliasToRemove);
    setSaving(supplier.id);
    try {
      await Supplier.update(supplier.id, { aliases: updatedAliases });
      setSuppliers((prev) =>
        prev.map((s) => s.id === supplier.id ? { ...s, aliases: updatedAliases } : s)
      );
      toast.success("כינוי הוסר");
    } catch (error) {
      toast.error("שגיאה בהסרת הכינוי");
    } finally {
      setSaving(null);
    }
  };

  const handleAssignUnmatched = async (unmatchedName, supplierNumber) => {
    if (!supplierNumber) return;
    const supplier = suppliers.find((s) => s.supplier_number === supplierNumber);
    if (!supplier) return;
    await handleAddAlias(supplier, unmatchedName);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Unmatched names section */}
      {unmatchedNames.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-800">
              <AlertCircle className="h-5 w-5" />
              שמות לא מזוהים בחשבוניות ({unmatchedNames.length})
            </CardTitle>
            <CardDescription className="text-amber-700">
              שמות אלו מופיעים בחשבוניות אך לא משויכים לאף ספק. שייך כל אחד לספק הנכון.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {unmatchedNames.map((name) => (
              <div key={name} className="flex items-center gap-3 bg-white p-3 rounded-lg border border-amber-200">
                <span className="flex-1 font-medium text-slate-700">{name}</span>
                <Select onValueChange={(val) => handleAssignUnmatched(name, val)}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="שייך לספק..." />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.filter((s) => s.is_active !== false).map((s) => (
                      <SelectItem key={s.id} value={s.supplier_number}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {unmatchedNames.length === 0 && (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="py-4">
            <div className="flex items-center gap-2 text-emerald-700">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">כל שמות הספקים בחשבוניות מזוהים ומשויכים.</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Aliases per supplier */}
      <Card>
        <CardHeader>
          <CardTitle>ניהול כינויים לפי ספק</CardTitle>
          <CardDescription>
            הוסף כינויים (שמות בעברית/אנגלית/וריאציות) לכל ספק. המערכת תזהה אוטומטית את החשבוניות.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {suppliers.map((supplier) => (
            <div key={supplier.id} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold text-slate-800">{supplier.name}</span>
                  <span className="text-xs text-slate-400 mr-2">{supplier.supplier_number}</span>
                </div>
                {saving === supplier.id && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
              </div>

              {/* Existing aliases */}
              <div className="flex flex-wrap gap-2">
                {(supplier.aliases || []).length === 0 && (
                  <span className="text-sm text-slate-400">אין כינויים</span>
                )}
                {(supplier.aliases || []).map((alias) => (
                  <Badge key={alias} variant="secondary" className="flex items-center gap-1 pr-1">
                    {alias}
                    <button
                      onClick={() => handleRemoveAlias(supplier, alias)}
                      className="mr-1 hover:text-red-500 transition-colors"
                      disabled={saving === supplier.id}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>

              {/* Add new alias */}
              <div className="flex gap-2">
                <Input
                  placeholder="הוסף כינוי (עברית/אנגלית)..."
                  value={newAlias[supplier.id] || ''}
                  onChange={(e) => setNewAlias((prev) => ({ ...prev, [supplier.id]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddAlias(supplier, newAlias[supplier.id]);
                    }
                  }}
                  className="text-sm"
                  disabled={saving === supplier.id}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAddAlias(supplier, newAlias[supplier.id])}
                  disabled={saving === supplier.id || !newAlias[supplier.id]?.trim()}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}