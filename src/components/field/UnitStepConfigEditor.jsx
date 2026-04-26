import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, Settings2, AlertTriangle, Plus } from "lucide-react";
import PartSearchPopover from "./PartSearchPopover";

export default function UnitStepConfigEditor({ stepConfigs = [], allStepDefs = [], onChange }) {
  const [expanded, setExpanded] = useState(null);
  const [showPartSearch, setShowPartSearch] = useState(null); // stepId שבו פתוח החיפוש

  if (allStepDefs.length === 0) {
    return <div className="text-xs text-slate-400 italic px-2 py-1">אין פעולות תחזוקה מוגדרות לסוג זה</div>;
  }

  const configs = allStepDefs.map(def => {
    const existing = stepConfigs.find(c => c.step_id === def.id);
    return existing || { step_id: def.id, step_name: def.name, enabled: true, manual_override: false, use_custom_parts: false, custom_parts: [] };
  });

  const updateConfig = (stepId, patch) => {
    const updated = configs.map(c => c.step_id !== stepId ? c : { ...c, ...patch, manual_override: true });
    onChange(updated);
  };

  const resetConfig = (stepId) => {
    const def = allStepDefs.find(d => d.id === stepId);
    const updated = configs.map(c => c.step_id !== stepId ? c : {
      step_id: stepId, step_name: def?.name || stepId, enabled: true, manual_override: false, use_custom_parts: false, custom_parts: [],
    });
    onChange(updated);
  };

  const enableCustomParts = (stepId) => {
    const cfg = configs.find(c => c.step_id === stepId);
    const def = allStepDefs.find(d => d.id === stepId);
    const defaultParts = def?.parts_required || [];
    const initialParts = (cfg?.custom_parts?.length > 0) ? cfg.custom_parts : defaultParts.map(p => ({ ...p }));
    updateConfig(stepId, { use_custom_parts: true, custom_parts: initialParts });
  };

  const updateCustomPart = (stepId, partIdx, field, value) => {
    const cfg = configs.find(c => c.step_id === stepId);
    updateConfig(stepId, { custom_parts: (cfg?.custom_parts || []).map((p, i) => i === partIdx ? { ...p, [field]: value } : p) });
  };

  const removeCustomPart = (stepId, partIdx) => {
    const cfg = configs.find(c => c.step_id === stepId);
    const newParts = (cfg?.custom_parts || []).filter((_, i) => i !== partIdx);
    updateConfig(stepId, { custom_parts: newParts, use_custom_parts: newParts.length > 0 });
  };

  const addPartFromSearch = (stepId, part) => {
    const cfg = configs.find(c => c.step_id === stepId);
    updateConfig(stepId, {
      custom_parts: [...(cfg?.custom_parts || []), part],
      use_custom_parts: true,
    });
  };

  return (
    <div className="space-y-1.5 mt-2">
      {configs.map(cfg => {
        const def = allStepDefs.find(d => d.id === cfg.step_id);
        const isExpanded = expanded === cfg.step_id;
        const defaultParts = def?.parts_required || [];

        return (
          <div key={cfg.step_id} className={`rounded border text-xs ${cfg.enabled ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-50 opacity-60"}`}>
            <div className="flex items-center gap-2 px-3 py-2">
              <Switch checked={cfg.enabled} onCheckedChange={v => updateConfig(cfg.step_id, { enabled: v })} className="scale-75" />
              <div className="flex-1 min-w-0">
                <span className={`font-medium text-xs ${!cfg.enabled ? "line-through text-slate-400" : "text-slate-700"}`}>
                  {cfg.step_name || def?.name}
                </span>
                {def?.description && (
                  <p className="text-[10px] text-slate-400 mt-0.5 truncate">{def.description}</p>
                )}
              </div>
              {cfg.manual_override && (
                <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-600 py-0 px-1.5">
                  <AlertTriangle className="h-2.5 w-2.5 ml-0.5" />ידני
                </Badge>
              )}
              {cfg.use_custom_parts && (
                <Badge variant="outline" className="text-[10px] border-blue-400 text-blue-600 py-0 px-1.5">חלקים מותאמים</Badge>
              )}
              <div className="flex gap-1">
                {cfg.manual_override && (
                  <Button type="button" variant="ghost" size="icon" className="h-5 w-5 text-slate-400 hover:text-red-500"
                    onClick={() => resetConfig(cfg.step_id)} title="אפס לברירת מחדל">
                    <Settings2 className="h-3 w-3" />
                  </Button>
                )}
                <Button type="button" variant="ghost" size="icon" className="h-5 w-5 text-slate-400"
                  onClick={() => setExpanded(isExpanded ? null : cfg.step_id)}>
                  {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </Button>
              </div>
            </div>

            {isExpanded && (
              <div className="px-3 pb-3 border-t border-slate-100 pt-2 space-y-2">
                <div className="flex items-center gap-2">
                  <Switch checked={cfg.use_custom_parts}
                    onCheckedChange={v => v ? enableCustomParts(cfg.step_id) : updateConfig(cfg.step_id, { use_custom_parts: false })}
                    className="scale-75" />
                  <Label className="text-xs text-slate-600">השתמש בחלקים מותאמים אישית במקום ברירת המחדל</Label>
                </div>

                {/* חלקי ברירת מחדל (read-only) */}
                {!cfg.use_custom_parts && defaultParts.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[10px] text-slate-400 font-medium">חלקים מברירת מחדל:</p>
                    {defaultParts.map(p => (
                      <div key={p.part_sku} className="flex justify-between text-[10px] bg-slate-50 px-2 py-1 rounded">
                        <span className="text-slate-500">{p.part_name || p.part_sku}</span>
                        <span className="text-slate-600 font-medium">×{p.quantity}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* חלקים מותאמים */}
                {cfg.use_custom_parts && (
                  <div className="space-y-1.5">
                    {(cfg.custom_parts || []).map((part, partIdx) => (
                      <div key={partIdx} className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-500 truncate flex-1 min-w-0">
                          {part.part_name || part.part_sku}
                          {part.part_sku && part.part_name && (
                            <span className="text-slate-400 mr-1">({part.part_sku})</span>
                          )}
                        </span>
                        <Input
                          type="number"
                          min="1"
                          value={part.quantity}
                          onChange={e => updateCustomPart(cfg.step_id, partIdx, "quantity", parseInt(e.target.value) || 1)}
                          className="h-7 text-xs w-14 text-center shrink-0"
                        />
                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-red-400 shrink-0"
                          onClick={() => removeCustomPart(cfg.step_id, partIdx)}>×</Button>
      </div>
                    ))}

                    {/* כפתור הוסף חלק + פופאובר חיפוש */}
                    <div className="relative">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs w-full"
                        onClick={() => setShowPartSearch(showPartSearch === cfg.step_id ? null : cfg.step_id)}
                      >
                        <Plus className="h-3 w-3 ml-1" />הוסף חלק
                      </Button>
                      {showPartSearch === cfg.step_id && (
                        <PartSearchPopover
                          onSelect={part => addPartFromSearch(cfg.step_id, part)}
                          onClose={() => setShowPartSearch(null)}
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}