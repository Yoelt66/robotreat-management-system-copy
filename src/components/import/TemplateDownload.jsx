import React from 'react';
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

export default function TemplateDownload({ fieldMapping = [] }) {
  const generateTemplate = () => {
    // Filter for checked fields and sort by column number
    const activeFields = fieldMapping
      .filter(f => f.checked && f.column)
      .sort((a, b) => a.column - b.column);

    if (activeFields.length === 0) {
      alert("נא לבחור לפחות שדה אחד לייצוא בתבנית.");
      return;
    }

    // Create an array for the final headers, placed at the correct column index
    const maxColumn = Math.max(...activeFields.map(f => f.column));
    const headerRow = new Array(maxColumn).fill('');
    activeFields.forEach(field => {
      headerRow[field.column - 1] = field.label;
    });

    // Create an example row in the same way
    const exampleRow = new Array(maxColumn).fill('');
    const exampleValues = {
        sku: 'ABC-123',
        name: 'פריט לדוגמה',
        category: 'electronics',
        unit: 'pieces',
        minimum_stock: '10',
        notes: 'הערה לדוגמה',
        cost_price: '50.5',
        currency: 'ILS',
    };
    activeFields.forEach(field => {
        let value = exampleValues[field.key] || '';
        if (field.key.startsWith('quantity_')) value = '5';
        if (field.key.startsWith('location_')) value = 'A1-R2-S3';
        exampleRow[field.column - 1] = value;
    });

    const csvContent = [
        headerRow.join(','),
        exampleRow.join(','),
    ].join('\n');
    
    // Create and download file
    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'template_import_stock.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  return (
    <Button onClick={generateTemplate} variant="outline">
      <Download className="h-4 w-4 ml-2" /> הורד תבנית CSV
    </Button>
  );
}