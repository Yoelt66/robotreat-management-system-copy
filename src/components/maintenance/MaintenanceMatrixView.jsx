import React, { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import BrandUnitFilter from "@/components/maintenance/BrandUnitFilter";

export default function MaintenanceMatrixView({ maintenanceTypes, maintenanceSteps, unitBrands, onUpdateType }) {
  const [filterBrand, setFilterBrand] = useState("");
  const [filterUnitType, setFilterUnitType] = useState("");

  const filteredTypes = maintenanceTypes.filter(t => {
    if (!filterBrand) return false;
    if (filterBrand && t.brand_id !== filterBrand) return false;
    if (filterUnitType && t.unit_type !== filterUnitType) return false;
    return true;
  });

  const getStepConfig = (type, stepId) => type.step_configs?.find(sc => sc.step_id === stepId);

  const toggleStep = (type, step) => {
    const existing = getStepConfig(type, step.id);
    let newConfigs;
    if (existing) {
      newConfigs = (type.step_configs || []).filter(sc => sc.step_id !== step.id);
    } else {
      const defaultParts = (step.parts_required || []).map(p => ({ ...p }));
      newConfigs = [...(type.step_configs || []), { step_id: step.id, step_name: step.name, enabled: true, custom_parts: defaultParts }];
    }
    onUpdateType(type.id, { step_configs: newConfigs });
  };

  const updateQty = (type, stepId, partSku, qty) => {
    const newConfigs = (type.step_configs || []).map(sc =>
      sc.step_id === stepId
        ? { ...sc, custom_parts: sc.custom_parts.map(p => p.part_sku === partSku ? { ...p, quantity: qty } : p) }
        : sc
    );
    onUpdateType(type.id, { step_configs: newConfigs });
  };

  const filterUI = (
    <BrandUnitFilter
      unitBrands={unitBrands}
      filterBrandId={filterBrand}
      filterUnitType={filterUnitType}
      onBrandChange={v => { setFilterBrand(v); setFilterUnitType(""); }}
      onUnitTypeChange={setFilterUnitType}
    />
  );

  if (!filterBrand || maintenanceSteps.length === 0 || filteredTypes.length === 0) {
    return (
      <div className="space-y-4">
        {filterUI}
        <div className="text-center py-16 text-slate-400 border-2 border-dashed rounded-lg">
          {!filterBrand ? "בחר מותג כדי להציג את המטריצה" : maintenanceSteps.length === 0 ? "אין פעולות תחזוקה מוגדרות" : "אין סוגי תחזוקה להצגה"}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {filterUI}
        <span className="text-sm text-slate-400">{filteredTypes.length} טיפולים</span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50">
              <th className="sticky right-0 z-10 bg-slate-50 border-b border-l border-slate-200 p-3 text-right font-semibold text-slate-700 min-w-[200px]">
                פעולת תחזוקה
              </th>
              {filteredTypes.map(type => (
                <th key={type.id} className="border-b border-l border-slate-200 p-3 text-center font-semibold min-w-[160px]">
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: type.color || "#10b981" }} />
                    <span className="text-slate-800">{type.name}</span>
                    {type.unit_type && <Badge variant="outline" className="text-xs">{type.unit_type}</Badge>}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {maintenanceSteps.map((step, si) => (
              <tr key={step.id} className={si % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                <td className="sticky right-0 z-10 border-b border-l border-slate-200 p-3 font-medium text-slate-700" style={{ backgroundColor: si % 2 === 0 ? "white" : "rgb(248 250 252 / 0.5)" }}>
                  <div>
                    <p>{step.name}</p>
                    {step.description && <p className="text-xs text-slate-400 font-normal">{step.description}</p>}
                  </div>
                </td>
                {filteredTypes.map(type => {
                  const config = getStepConfig(type, step.id);
                  const isEnabled = !!config;
                  return (
                    <td key={type.id} className="border-b border-l border-slate-200 p-2 align-top">
                      <div className="flex flex-col items-center gap-1">
                        <Checkbox
                          checked={isEnabled}
                          onCheckedChange={() => toggleStep(type, step)}
                          className="mt-1"
                        />
                        {isEnabled && config.custom_parts?.length > 0 && (
                          <div className="w-full space-y-1 mt-1">
                            {config.custom_parts.map(part => (
                              <div key={part.part_sku} className="bg-emerald-50 rounded p-1">
                                <p className="text-xs text-slate-600 truncate" title={part.part_name}>{part.part_name}</p>
                                <div className="flex items-center gap-1 mt-0.5">
                                  <span className="text-xs text-slate-400">×</span>
                                  <Input
                                    type="number" min="1"
                                    value={part.quantity}
                                    onChange={e => updateQty(type, step.id, part.part_sku, parseInt(e.target.value) || 1)}
                                    className="h-6 text-xs w-full"
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}