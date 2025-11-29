
import React from "react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Edit } from "lucide-react";

export default function CurrencyList({ currencies, onEdit, disabled = false }) {
  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-center">קוד</TableHead>
            <TableHead className="text-center">שם</TableHead>
            <TableHead className="text-center">סמל</TableHead>
            <TableHead className="text-center">שער לשקל</TableHead>
            <TableHead className="text-center">עדכון אחרון</TableHead>
            <TableHead className="text-center">פעולות</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {currencies.map((currency) => (
            <TableRow key={currency.id}>
              <TableCell className="text-center font-mono font-bold">
                {currency.code}
              </TableCell>
              <TableCell className="text-center">{currency.name}</TableCell>
              <TableCell className="text-center font-mono text-lg">
                {currency.symbol}
              </TableCell>
              <TableCell className="text-center font-mono">
                {currency.rate_to_ils ? currency.rate_to_ils.toFixed(4) : '-'}
              </TableCell>
              <TableCell className="text-center text-sm text-gray-500">
                {currency.last_update 
                  ? new Date(currency.last_update).toLocaleDateString('he-IL')
                  : '-'
                }
              </TableCell>
              <TableCell className="text-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(currency)}
                  disabled={disabled}
                >
                  <Edit className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      
      {disabled && (
        <div className="text-center text-sm text-gray-500 bg-yellow-50 p-3 rounded-lg">
          מעדכן פריטים עם שערי החליפין החדשים...
        </div>
      )}
    </div>
  );
}
