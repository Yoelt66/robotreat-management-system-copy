import React from 'react';
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

export default function ImportTemplateDownload() {
  const downloadTemplate = () => {
    // Create sample data for the template
    const templateData = [
      {
        description: "החלפת מסנן חלב ראשי",
        safety_note: "לכבות את המכונה לפני החלפת המסנן",
        part_1_sku: "FILTER-001",
        part_1_quantity: 1,
        part_2_sku: "GASKET-002", 
        part_2_quantity: 2,
        part_3_sku: "",
        part_3_quantity: 0,
        part_4_sku: "",
        part_4_quantity: 0,
        part_5_sku: "",
        part_5_quantity: 0
      },
      {
        description: "בדיקת מפלס שמן במשאבה",
        safety_note: "לוודא שהמכונה קרה לפני הבדיקה",
        part_1_sku: "OIL-PREMIUM",
        part_1_quantity: 1,
        part_2_sku: "",
        part_2_quantity: 0,
        part_3_sku: "",
        part_3_quantity: 0,
        part_4_sku: "",
        part_4_quantity: 0,
        part_5_sku: "",
        part_5_quantity: 0
      },
      {
        description: "ניקוי חיישני טמפרטורה",
        safety_note: "להשתמש בחומר ניקוי מאושר בלבד",
        part_1_sku: "CLEANER-TEMP",
        part_1_quantity: 1,
        part_2_sku: "CLOTH-CLEAN",
        part_2_quantity: 3,
        part_3_sku: "",
        part_3_quantity: 0,
        part_4_sku: "",
        part_4_quantity: 0,
        part_5_sku: "",
        part_5_quantity: 0
      }
    ];

    // Define headers in English (as required by the import system)
    const headers = [
      'description',
      'safety_note', 
      'part_1_sku',
      'part_1_quantity',
      'part_2_sku',
      'part_2_quantity',
      'part_3_sku',
      'part_3_quantity',
      'part_4_sku',
      'part_4_quantity',
      'part_5_sku',
      'part_5_quantity'
    ];

    // Create CSV content without BOM
    let csvContent = "";
    
    // Add headers
    csvContent += headers.join(",") + "\r\n";
    
    // Add data rows
    templateData.forEach(row => {
      const csvRow = headers.map(header => {
        const value = row[header];
        const valueStr = value == null ? '' : String(value);
        // Quote if it contains a comma, quote, or newline
        if (/[",\n]/.test(valueStr)) {
            return `"${valueStr.replace(/"/g, '""')}"`;
        }
        return valueStr;
      });
      csvContent += csvRow.join(",") + "\r\n";
    });

    // Add instructions in Hebrew at the end
    csvContent += "\r\n";
    csvContent += '"=== הוראות ==="\r\n';
    csvContent += '"1. עמודת description - תיאור השלב (חובה)"\r\n';
    csvContent += '"2. עמודת safety_note - הערת בטיחות (אופציונלי)"\r\n';
    csvContent += '"3. עמודות part_X_sku - מקט החלק (עד 5 חלקים)"\r\n';
    csvContent += '"4. עמודות part_X_quantity - כמות החלק (השתמש ב-0 אם אין כמות)"\r\n';
    csvContent += '"5. יש למלא את כל העמודות, גם אם אין נתונים"\r\n';
    csvContent += '"6. שמור את הקובץ בפורמט CSV (קידוד UTF-8 מומלץ)"\r\n';

    // Create and download the file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    link.setAttribute("href", url);
    link.setAttribute("download", "maintenance_steps_template.csv");
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  };

  return (
    <Button 
      variant="outline" 
      onClick={downloadTemplate}
      className="w-full"
    >
      <Download className="w-4 h-4 ml-2" />
      הורד תבנית לייבוא
    </Button>
  );
}