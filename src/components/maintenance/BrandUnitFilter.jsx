import React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * BrandUnitFilter
 * Shows brand buttons in row 1, unit type buttons in row 2 (when brand selected).
 * filterBrandId: "" = none selected, or brand id
 * filterUnitType: "" = none, or unit type string
 */
export default function BrandUnitFilter({ unitBrands, filterBrandId, filterUnitType, onBrandChange, onUnitTypeChange }) {
  const selectedBrand = unitBrands.find(b => b.id === filterBrandId);
  const unitTypes = selectedBrand?.unit_types || [];

  const handleBrandClick = (brandId) => {
    if (filterBrandId === brandId) {
      onBrandChange("");
      onUnitTypeChange("");
    } else {
      onBrandChange(brandId);
      onUnitTypeChange("");
    }
  };

  const handleUnitTypeClick = (ut) => {
    if (filterUnitType === ut) {
      onUnitTypeChange("");
    } else {
      onUnitTypeChange(ut);
    }
  };

  return (
    <div className="space-y-2">
      {/* Brand buttons */}
      <div className="flex flex-wrap gap-2">
        {unitBrands.map(brand => (
          <Button
            key={brand.id}
            variant="outline"
            size="sm"
            onClick={() => handleBrandClick(brand.id)}
            className={cn(
              "rounded-full transition-all",
              filterBrandId === brand.id
                ? "bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700 hover:border-emerald-700 hover:text-white"
                : "text-slate-600 hover:bg-slate-100"
            )}
          >
            {brand.name}
          </Button>
        ))}
      </div>

      {/* Unit type buttons (shown only when brand selected) */}
      {filterBrandId && unitTypes.length > 0 && (
        <div className="flex flex-wrap gap-2 pr-1">
          {unitTypes.map(ut => (
            <Button
              key={ut}
              variant="outline"
              size="sm"
              onClick={() => handleUnitTypeClick(ut)}
              className={cn(
                "rounded-full text-xs transition-all",
                filterUnitType === ut
                  ? "bg-blue-600 text-white border-blue-600 hover:bg-blue-700 hover:border-blue-700 hover:text-white"
                  : "text-slate-500 hover:bg-slate-100"
              )}
            >
              {ut}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}