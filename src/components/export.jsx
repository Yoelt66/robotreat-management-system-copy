import { format } from "date-fns";

export const exportOrderToCsv = (order) => {
  if (!order) return;

  const headers = [
    "מק\"ט",
    "שם פריט",
    "כמות מוזמנת",
    "כמות שהתקבלה",
    "מחיר עלות",
    "מטבע"
  ];

  const rows = order.items.map(item => [
    `"${item.part_sku}"`,
    `"${item.part_name}"`,
    item.quantity,
    item.received_quantity || 0,
    item.cost_price || 0,
    `"${item.currency || 'ILS'}"`
  ].join(","));

  let csvContent = "\uFEFF"; // BOM for Excel to recognize UTF-8
  csvContent += headers.join(",") + "\r\n";
  csvContent += rows.join("\r\n");
  
  // Add order summary details at the end
  csvContent += "\r\n\r\n";
  csvContent += `מספר הזמנה,"${order.order_number}"\r\n`;
  csvContent += `ספק,"${order.supplier_name || order.supplier}"\r\n`;
  csvContent += `תאריך הזמנה,"${format(new Date(order.order_date || order.created_date), 'dd/MM/yyyy')}"\r\n`;
  csvContent += `סטטוס,"${order.status}"\r\n`;

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `order_${order.order_number}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};