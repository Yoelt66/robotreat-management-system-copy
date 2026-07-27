import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Shows search results as a table, with a quantity input next to the add button,
// and (below each row) the alternative/replaced part if one exists - clicking it
// puts that part's SKU into the search box.
export default function AvailablePartsSearchTable({
  results,
  parts,
  fromWarehouse,
  getAvailableStock,
  getPartLocation,
  getStockStatusColor,
  disabled,
  onAdd,
  onPickSku,
}) {
  const [quantities, setQuantities] = useState({});

  const getQuantity = (sku) => quantities[sku] ?? 1;
  const setQuantity = (sku, value) => setQuantities(prev => ({ ...prev, [sku]: value }));

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>מק"ט</TableHead>
          <TableHead>שם פריט</TableHead>
          <TableHead className="text-center">מיקום</TableHead>
          <TableHead className="text-center">זמין</TableHead>
          <TableHead className="text-center">כמות</TableHead>
          <TableHead className="text-center">הוסף</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {results.map(part => {
          const availableQty = fromWarehouse ? getAvailableStock(fromWarehouse.id, part.id) : 0;
          const location = getPartLocation(part.sku);
          const altPart = part.replaced_sku ? parts.find(p => p.sku === part.replaced_sku) : null;

          return (
            <React.Fragment key={part.id}>
              <TableRow>
                <TableCell className="font-mono">{part.sku}</TableCell>
                <TableCell>{part.name}</TableCell>
                <TableCell className="text-center">{location}</TableCell>
                <TableCell className={`text-center font-medium ${getStockStatusColor(availableQty)}`}>
                  {availableQty}
                </TableCell>
                <TableCell className="text-center">
                  <Input
                    type="number"
                    min="1"
                    value={getQuantity(part.sku)}
                    onChange={(e) => setQuantity(part.sku, e.target.value)}
                    disabled={disabled}
                    className="w-20 text-center mx-auto"
                  />
                </TableCell>
                <TableCell className="text-center">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={disabled}
                    onClick={() => onAdd(part, Number(getQuantity(part.sku)) || 1)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
              {part.replaced_sku && (
                <TableRow
                  className="cursor-pointer bg-blue-50/50 hover:bg-blue-100"
                  onClick={() => onPickSku(part.replaced_sku)}
                >
                  <TableCell colSpan={2} className="text-xs text-blue-700 py-1.5">
                    פריט חלופי: {part.replaced_sku}{altPart ? ` - ${altPart.name}` : ''}
                  </TableCell>
                  <TableCell className="text-center text-xs text-blue-700 py-1.5">
                    {altPart ? getPartLocation(altPart.sku) : '-'}
                  </TableCell>
                  <TableCell className={`text-center text-xs py-1.5 ${altPart && fromWarehouse ? getStockStatusColor(getAvailableStock(fromWarehouse.id, altPart.id)) : 'text-blue-700'}`}>
                    {altPart && fromWarehouse ? getAvailableStock(fromWarehouse.id, altPart.id) : '-'}
                  </TableCell>
                  <TableCell colSpan={2} />
                </TableRow>
              )}
            </React.Fragment>
          );
        })}
      </TableBody>
    </Table>
  );
}