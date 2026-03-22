import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Pencil, Trash2, Plus, ChevronDown, ChevronUp,
  Phone, MapPin, Settings2, Circle, CheckCircle2
} from "lucide-react";
import UnitDialog from "./UnitDialog";

export default function CustomerWithUnits({
  customer, units, unitBrands, maintenanceTypes,
  onEditCustomer, onDeleteCustomer, onSaveUnit, onDeleteUnit,
}) {
  const [expanded, setExpanded] = useState(false);
  const [showUnitDialog, setShowUnitDialog] = useState(false);
  const [editingUnit, setEditingUnit] = useState(null);

  const getBrandName = (brandId) => unitBrands.find(b => b.id === brandId)?.name || "-";

  const getSequenceSummary = (unit) => {
    if (unit.visit_sequence?.length > 0) {
      return `${unit.visit_sequence.length} שלבים ברצף`;
    }
    return `כל ${unit.visit_interval_months || 3} חודשים`;
  };

  const openNewUnit = () => {
    setEditingUnit(null);
    setShowUnitDialog(true);
  };

  const openEditUnit = (unit) => {
    setEditingUnit(unit);
    setShowUnitDialog(true);
  };

  const handleSaveUnit = (data) => {
    onSaveUnit(data, editingUnit?.id);
    setShowUnitDialog(false);
    setEditingUnit(null);
  };

  return (
    <>
      <Card className={`border transition-shadow ${expanded ? "shadow-md border-slate-300" : "hover:shadow-sm"}`}>
        <CardContent className="p-0">
          {/* Customer header */}
          <div
            className="flex items-center gap-4 p-4 cursor-pointer select-none"
            onClick={() => setExpanded(!expanded)}
          >
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-1 min-w-0">
              <div className="font-semibold text-slate-800 truncate">{customer.name}</div>
              <div className="flex items-center gap-1 text-sm text-slate-500">
                {customer.phone && <><Phone className="h-3 w-3 shrink-0" /><span>{customer.phone}</span></>}
              </div>
              <div className="flex items-center gap-1 text-sm text-slate-400 truncate">
                {customer.address && <><MapPin className="h-3 w-3 shrink-0" /><span className="truncate">{customer.address}</span></>}
              </div>
            </div>

            <Badge variant={units.length > 0 ? "default" : "outline"} className="shrink-0 gap-1">
              <Settings2 className="h-3 w-3" />
              {units.length} יחידות
            </Badge>

            <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEditCustomer}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={onDeleteCustomer}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            {expanded
              ? <ChevronUp className="h-5 w-5 text-slate-400 shrink-0" />
              : <ChevronDown className="h-5 w-5 text-slate-400 shrink-0" />
            }
          </div>

          {/* Units panel */}
          {expanded && (
            <div className="border-t border-slate-100 bg-slate-50/60 p-4 space-y-2">
              {units.length === 0 ? (
                <div className="text-center py-4 text-slate-400 text-sm">אין יחידות שירות ללקוח זה</div>
              ) : (
                units.map(unit => (
                  <div key={unit.id} className="flex items-center gap-4 bg-white rounded-lg p-3 border border-slate-200 hover:border-slate-300 transition-colors">
                    <div className="shrink-0">
                      {unit.active !== false
                        ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        : <Circle className="h-4 w-4 text-slate-300" />
                      }
                    </div>
                    <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm min-w-0">
                      <div className="font-medium text-slate-800 truncate">{unit.name}</div>
                      <div className="text-slate-500 truncate">
                        {getBrandName(unit.brand_id)}
                        {unit.type ? ` · ${unit.type}` : ""}
                      </div>
                      <div className="text-slate-400 text-xs">
                        {unit.serial_number ? `ס"נ: ${unit.serial_number}` : "ללא מ"ס"}
                      </div>
                      <div className="text-slate-400 text-xs flex items-center gap-1">
                        <Settings2 className="h-3 w-3" />
                        {getSequenceSummary(unit)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditUnit(unit)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => onDeleteUnit(unit)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}

              <Button variant="outline" size="sm" className="w-full mt-1 border-dashed text-slate-500 hover:text-slate-700" onClick={openNewUnit}>
                <Plus className="h-4 w-4 ml-2" />
                הוסף יחידת שירות
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {showUnitDialog && (
        <UnitDialog
          unit={editingUnit}
          customerId={customer.id}
          unitBrands={unitBrands}
          maintenanceTypes={maintenanceTypes}
          onSave={handleSaveUnit}
          onClose={() => { setShowUnitDialog(false); setEditingUnit(null); }}
        />
      )}
    </>
  );
}