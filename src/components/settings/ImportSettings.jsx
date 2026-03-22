import React, { useState, useEffect } from "react";
import { ImportMapping, Customer, ServiceUnit, ServiceCall, User, Part, Warehouse, UnitBrand } from "@/entities/all";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Edit, Trash2, Users, HardDrive, Wrench, ClipboardPlus } from "lucide-react";
import ImportMappingForm from "./ImportMappingForm";

import DataImporter from "./import/DataImporter";

// Customer import configuration
const customerTemplateHeaders = ["name", "company", "phone", "email", "address", "notes"];
const customerTemplateDisplayHeaders = ["שם", "חברה", "טלפון", "אימייל", "כתובת", "הערות"];
const customerRequiredFields = ["name", "phone"];
const preImportCustomers = async () => {
    const customers = await Customer.list();
    return { customerNameMap: new Map(customers.map(c => [c.name.toLowerCase(), c.id])) };
};
const mapCustomerRow = (row, { customerNameMap }) => {
  const name = row[0];
  const nameKey = name.toLowerCase();
  
  // Check for duplicates
  if (customerNameMap.has(nameKey)) {
    throw new Error(`שם הלקוח "${name}" כבר קיים במערכת.`);
  }
  
  // Add to map to prevent duplicates within the same batch
  customerNameMap.set(nameKey, true);
  
  return {
    name: name,
    company: row[1] || null,
    phone: row[2],
    email: row[3] || null,
    address: row[4] || null,
    notes: row[5] || null,
  };
};

// ServiceUnit import configuration
const serviceUnitTemplateHeaders = ["customer_name", "name", "type", "brand_name", "serial_number", "location"];
const serviceUnitTemplateDisplayHeaders = ["שם לקוח (מפתח)", "שם מכשיר", "סוג", "מותג", "מספר סידורי", "מיקום"];
const serviceUnitRequiredFields = ["customer_name", "name"];
const preImportServiceUnits = async () => {
    const [customers, serviceUnits, brands] = await Promise.all([Customer.list(), ServiceUnit.list(), UnitBrand.list()]);
    const serviceUnitMap = new Map(serviceUnits.map(su => [`${su.customer_id}:${su.name.toLowerCase()}`, su]));
    const changeDetector = {};
    for (const su of serviceUnits) {
        changeDetector[su.id] = su;
    }
    return { 
        customerMap: new Map(customers.map(c => [c.name.toLowerCase(), c.id])),
        serviceUnitMap,
        brandMap: new Map(brands.map(b => [b.name.toLowerCase(), b.id])),
        changeDetector
    };
};
const mapServiceUnitRow = (row, { customerMap, serviceUnitMap, brandMap }) => {
    const customerId = customerMap.get(row[0].toLowerCase());
    if (!customerId) throw new Error(`שורה ${row.join(',')}: לא נמצא לקוח עם שם ${row[0]}.`);
    
    const unitNameKey = `${customerId}:${row[1].toLowerCase()}`;
    const existing = serviceUnitMap.get(unitNameKey);
    
    // If unit exists in batch, prevent duplicate
    if (existing && existing === true) {
        throw new Error(`כפל בקובץ: מכשיר עם שם "${row[1]}" ללקוח "${row[0]}" מופיע יותר מפעם אחת.`);
    }
    
    // Normalize input by replacing spaces with underscores
    const normalizedInput = row[2] ? row[2].replace(/ /g, '_') : '';
    
    // Map Hebrew display names and other aliases to system keys
    const hebrewDeviceTypeMap = {
      "מיכל_חלב": "Milk_tank",
      "מערכת_אחרת": "other",
      "CRS+": "CRS",
    };

    const deviceType = hebrewDeviceTypeMap[normalizedInput] || normalizedInput;
    
    const validTypes = ["Astronaut_A3", "Astronaut_A3N", "Astronaut_A4", "Delaval_2008", "Delaval_2011", "Milk_tank", "CRS", "Juno_100", "Juno_150", "Luna", "other"];
    if (!validTypes.includes(deviceType)) throw new Error(`שורה ${row.join(',')}: סוג מכשיר לא תקין: ${row[2]}`);
    
    const brandId = row[3] ? brandMap.get(row[3].toLowerCase()) : null;
    
    // Mark unit in batch to prevent duplicates
    serviceUnitMap.set(unitNameKey, true);
    
    return {
        id: existing?.id,
        customer_id: customerId,
        name: row[1],
        type: row[2] || null,
        brand_id: brandId || null,
        serial_number: row[4] || null,
        location: row[5] || null,
    };
};

// ServiceCall import configuration
const serviceCallTemplateHeaders = [
    "call_number", 
    "client_name", 
    "device_name",
    "status", 
    "service_type",
    "description",
    "notes",
    "scheduled_date",
    "start_time",
    "end_time",
    "assigned_to_email",
    "location",
    "no_travel",
    "no_work_hours",
    "photos"
];
const serviceCallTemplateDisplayHeaders = [
    "מספר קריאה", 
    "שם לקוח (מפתח)", 
    "שם מכשיר (מפתח)",
    "סטטוס", 
    "סוג שירות",
    "תיאור תקלה",
    "הערות",
    "תאריך מתוכנן",
    "שעת התחלה",
    "שעת סיום",
    "אימייל טכנאי",
    "מיקום",
    "ללא נסיעה (true/false)",
    "ללא שעות עבודה (true/false)",
    "תמונות (מופרד בפסיק)"
];
const serviceCallRequiredFields = ["call_number", "client_name", "status"];

const parseImportedDate = (dateString) => {
    if (!dateString) return null;
    
    // Try to parse DD.MM.YYYY or DD/MM/YYYY
    const parts = dateString.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})$/);
    if (parts) {
        // parts[1] is day, parts[2] is month, parts[3] is year
        const isoDate = `${parts[3]}-${String(parts[2]).padStart(2, '0')}-${String(parts[1]).padStart(2, '0')}`;
        if (!isNaN(new Date(isoDate).getTime())) {
            return isoDate;
        }
    }

    // Try to parse as is (assuming YYYY-MM-DD or other valid format)
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
    }
    
    return null; // Return null if format is unrecognized
};

const preImportServiceCalls = async () => {
    const [customers, users, serviceUnits] = await Promise.all([Customer.list(), User.list(), ServiceUnit.list()]);
    return { 
        customerMap: new Map(customers.map(c => [c.name, c])),
        userMap: new Map(users.map(u => [u.email, u])),
        serviceUnitMap: new Map(serviceUnits.map(su => [`${su.customer_id}:${su.name}`, su]))
    };
};
const mapServiceCallRow = (row, { customerMap, userMap, serviceUnitMap }) => {
    const rowData = {};
    serviceCallTemplateHeaders.forEach((header, index) => {
        rowData[header] = row[index] || null;
    });

    const customer = customerMap.get(rowData.client_name);
    if (!customer) throw new Error(`שורה ${row.join(',')}: לא נמצא לקוח עם השם ${rowData.client_name}.`);
    
    const user = userMap.get(rowData.assigned_to_email);
    
    let serviceUnit = null;
    if(rowData.device_name && customer) {
        const serviceUnitKey = `${customer.id}:${rowData.device_name}`;
        serviceUnit = serviceUnitMap.get(serviceUnitKey);
    }

    const hebrewStatusMap = {
      "זמני": "temporary", 
      "טיוטה": "pending",
      "סגור": "assigned",
      "אושר": "in_progress",
      "הוקלדו": "completed",
      "סופי": "final", 
      "מבוטל": "cancelled"
    };
    const hebrewServiceTypeMap = {
      "תקלה": "repair",
      "תקלה חוזרת": "inspection",
      "בדיקה": "inspection",
      "טיפול": "maintenance",
      "חלקים": "parts", // Added alternative spelling
      "חירום": "emergency", 
      "התקנה": "installation", 
      "אחר": "other"
    };

    const rawStatus = rowData.status;
    const status = hebrewStatusMap[rawStatus] || rawStatus;
    const validStatuses = ["temporary", "pending", "assigned", "in_progress", "completed", "final", "cancelled"];
    if (!validStatuses.includes(status)) throw new Error(`שורה ${row.join(',')}: סטטוס לא תקין: ${rawStatus}`);

    const rawServiceType = rowData.service_type;
    const serviceType = hebrewServiceTypeMap[rawServiceType] || rawServiceType;
    const validServiceTypes = ["repair", "inspection", "maintenance", "parts", "emergency", "installation", "other"];
    if (rawServiceType && !validServiceTypes.includes(serviceType)) throw new Error(`שורה ${row.join(',')}: סוג שירות לא תקין: ${rawServiceType}`);

    const toBoolean = (val) => {
        if (!val) return false;
        const lowerVal = String(val).toLowerCase();
        return lowerVal === 'true' || lowerVal === 'כן';
    };

    return {
        call_number: rowData.call_number,
        client_name: customer.name,
        client_phone: customer.phone,
        device: serviceUnit ? serviceUnit.name : null,
        device_id: serviceUnit ? serviceUnit.id : null,
        device_type: serviceUnit ? serviceUnit.type : null,
        location: rowData.location,
        status: status,
        service_type: serviceType,
        description: rowData.description,
        notes: rowData.notes,
        scheduled_date: parseImportedDate(rowData.scheduled_date),
        start_time: rowData.start_time || null,
        end_time: rowData.end_time || null,
        assigned_to: user ? user.email : null,
        assigned_to_nickname: user ? (user.nickname || user.full_name) : null,
        no_travel: toBoolean(rowData.no_travel),
        no_work_hours: toBoolean(rowData.no_work_hours),
        photos: rowData.photos ? rowData.photos.split(',').map(p => p.trim()) : [],
        is_draft: false,
        parts_used: [],
    };
};

const upsertServiceCalls = async (batch) => {
    if (!batch || batch.length === 0) return;

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    const callNumbers = batch.map(b => b.call_number).filter(Boolean);
    
    const toCreateWithoutNumber = batch.filter(item => !item.call_number);

    let existingCallsMap = new Map();
    if (callNumbers.length > 0) {
        const existingCalls = await ServiceCall.filter({ call_number: { $in: callNumbers } });
        existingCallsMap = new Map(existingCalls.map(c => [c.call_number, c]));
    }

    const toCreate = [...toCreateWithoutNumber];
    const toUpdate = [];

    for (const item of batch) {
        if (!item.call_number) continue; // Already handled

        const existing = existingCallsMap.get(item.call_number);
        if (existing) {
            toUpdate.push({ id: existing.id, data: item });
        } else {
            toCreate.push(item);
        }
    }

    if (toCreate.length > 0) {
        await ServiceCall.bulkCreate(toCreate);
    }

    for (const update of toUpdate) {
        await ServiceCall.update(update.id, update.data);
        await sleep(300); // Increased delay to prevent rate limiting
    }
};


// Service Call Parts import configuration
const serviceCallPartsTemplateHeaders = ["call_number", "part_sku", "quantity", "has_serial", "old_serial", "new_serial"];
const serviceCallPartsTemplateDisplayHeaders = ["מספר קריאה (מפתח)", "מק\"ט חלק", "כמות", "האם סריאלי (true/false)", "מספר סידורי ישן", "מספר סידורי חדש"];
const serviceCallPartsRequiredFields = ["call_number", "part_sku", "quantity"];

const preImportServiceCallParts = async () => {
    const [serviceCalls, parts] = await Promise.all([ServiceCall.list(), Part.list()]);
    return {
        serviceCallMap: new Map(serviceCalls.map(sc => [sc.call_number, sc])),
        partMap: new Map(parts.map(p => [p.sku, p]))
    };
};

const mapServiceCallPartRow = (row, { serviceCallMap, partMap }) => {
    const callNumber = row[0];
    const partSku = row[1];
    const quantity = parseFloat(row[2]);

    if (!serviceCallMap.has(callNumber)) {
        throw new Error(`שורה ${row.join(',')}: לא נמצאה קריאת שירות עם מספר ${callNumber}.`);
    }
    if (!partMap.has(partSku)) {
        throw new Error(`שורה ${row.join(',')}: לא נמצא חלק עם מק"ט ${partSku}.`);
    }

    const part = partMap.get(partSku);

    return {
        call_number: callNumber,
        part_to_add: {
            name: part.name,
            part_number: part.sku,
            quantity: quantity,
            has_serial: row[3] ? row[3].toLowerCase() === 'true' : false,
            old_serial: row[4] || null,
            new_serial: row[5] || null,
        }
    };
};

const updateServiceCallsWithParts = async (batch) => {
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    const groupedByCallNumber = batch.reduce((acc, { call_number, part_to_add }) => {
        if (!acc[call_number]) {
            acc[call_number] = [];
        }
        acc[call_number].push(part_to_add);
        return acc;
    }, {});

    const callNumbersToUpdate = Object.keys(groupedByCallNumber);
    if (callNumbersToUpdate.length === 0) return;

    const serviceCallsToUpdate = await ServiceCall.filter({ call_number: { $in: callNumbersToUpdate } });
    const serviceCallMap = new Map(serviceCallsToUpdate.map(sc => [sc.call_number, sc]));

    let skippedCount = 0;
    let updatedCallsCount = 0;

    for (const callNumber of callNumbersToUpdate) {
        const serviceCall = serviceCallMap.get(callNumber);
        if (serviceCall) {
            const existingParts = serviceCall.parts_used || [];
            const partsToAddFromCsv = groupedByCallNumber[callNumber];
            
            const existingPartSkus = new Set(existingParts.map(p => p.part_number));
            
            const newPartsToAdd = partsToAddFromCsv.filter(partToAdd => {
                if (existingPartSkus.has(partToAdd.part_number)) {
                    skippedCount++;
                    return false; // Skip this part, it's a duplicate
                }
                return true; // Keep this part, it's new
            });

            if (newPartsToAdd.length > 0) {
                const updatedParts = [...existingParts, ...newPartsToAdd];
                await ServiceCall.update(serviceCall.id, { parts_used: updatedParts });
                updatedCallsCount++;
                await sleep(300); // Add delay to prevent rate limiting
            }
        }
    }
    

};


export default function ImportSettings() {
  const [mappings, setMappings] = useState([]);
  const [editingMapping, setEditingMapping] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadMappings();
  }, []);

  const loadMappings = async () => {
    setLoading(true);
    try {
      const data = await ImportMapping.list();
      setMappings(data);
    } catch (error) {
      console.error("Error loading import mappings:", error);

    } finally {
      setLoading(false);
    }
  };

  const handleAddNew = () => {
    setEditingMapping(null);
    setShowForm(true);
  };

  const handleEdit = (mapping) => {
    setEditingMapping(mapping);
    setShowForm(true);
  };

  const handleDelete = async (mappingId) => {
    if (confirm("האם אתה בטוח שברצונך למחוק הגדרת מיפוי זו?")) {
      try {
        await ImportMapping.delete(mappingId);
  
        loadMappings();
      } catch (error) {
        console.error("Error deleting mapping:", error);
  
      }
    }
  };

  const handleSave = async (data) => {
    try {
      if (data.is_default) {
        for (const mapping of mappings) {
          if (mapping.is_default && mapping.id !== data.id) {
            await ImportMapping.update(mapping.id, { is_default: false });
          }
        }
      }

      if (editingMapping) {
        await ImportMapping.update(editingMapping.id, data);
  
      } else {
        await ImportMapping.create(data);
  
      }
      
      setShowForm(false);
      setEditingMapping(null);
      await loadMappings();
    } catch (error) {
      console.error("Error saving mapping:", error);

    }
  };

  const handleRefreshMappings = async () => {
    if (!confirm("פעולה זו תוסיף את כל השדות החדשים לתבניות הקיימות. האם להמשיך?")) {
      return;
    }

    setIsRefreshing(true);
    try {
      const warehouses = await Warehouse.list() || [];
      
      const allFields = [
        { key: 'sku', label: 'מקט', checked: true, is_required: true },
        { key: 'name', label: 'שם פריט', checked: true, is_required: true },
        { key: 'category', label: 'קטגוריה', checked: true, is_required: false },
        { key: 'unit', label: 'יחידת מידה', checked: true, is_required: false },
        { key: 'minimum_stock', label: 'מלאי מינימום', checked: true, is_required: false },
        { key: 'notes', label: 'הערות', checked: true, is_required: false },
        { key: 'cost_price', label: 'מחיר עלות', checked: true, is_required: false },
        { key: 'current_location', label: 'מיקום נוכחי', checked: false, is_required: false },
        { key: 'supplier_part_number', label: 'מקט אצל ספק', checked: false, is_required: false },
        { key: 'replaced_sku', label: 'מקט חלופי', checked: false, is_required: false },
        { key: 'supplier_number', label: 'מספר ספק', checked: false, is_required: false },
        { key: 'cost_currency', label: 'מטבע עלות', checked: false, is_required: false },
        { key: 'sale_currency', label: 'מטבע מכירה', checked: false, is_required: false },
        { key: 'import_percentage', label: 'אחוז ייבוא', checked: false, is_required: false },
        { key: 'markup_percentage', label: 'אחוז רווח', checked: false, is_required: false },
        { key: 'manual_sale_price', label: 'מחיר מכירה ידני', checked: false, is_required: false },
        ...warehouses.map(w => ({
          key: w.warehouse_id,
          label: `מלאי: ${w.name}`,
          checked: false,
          is_required: false
        }))
      ];

      for (const mapping of mappings) {
        const existingMapping = Array.isArray(mapping.mapping) ? mapping.mapping : [];
        const existingKeys = new Set(existingMapping.map(f => f.key));
        
        const newFields = allFields.filter(f => !existingKeys.has(f.key));
        
        if (newFields.length > 0) {
          const updatedMapping = [...existingMapping, ...newFields];
          await ImportMapping.update(mapping.id, { 
            ...mapping, 
            mapping: updatedMapping 
          });
        }
      }

      await loadMappings();
      alert(`עודכנו ${mappings.length} תבניות בהצלחה!`);
    } catch (error) {
      console.error("Error refreshing mappings:", error);
      alert("שגיאה בעדכון התבניות");
    } finally {
      setIsRefreshing(false);
    }
  };

  if (loading) return <div>טוען הגדרות ייבוא...</div>;

  return (
    <div className="space-y-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>הגדרות מיפוי לייבוא פריטים</CardTitle>
            {!showForm && (
              <div className="flex gap-2">
                <Button onClick={handleRefreshMappings} variant="outline" disabled={isRefreshing || mappings.length === 0}>
                  {isRefreshing ? "מעדכן..." : "רענן תבניות"}
                </Button>
                <Button onClick={handleAddNew}>
                  <Plus className="h-4 w-4 ml-2" />
                  הוסף הגדרה חדשה
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {showForm ? (
              <ImportMappingForm
                mappingData={editingMapping}
                onSave={handleSave}
                onCancel={() => {
                  setShowForm(false);
                  setEditingMapping(null);
                }}
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>שם ההגדרה</TableHead>
                    <TableHead>ברירת מחדל</TableHead>
                    <TableHead className="text-right">פעולות</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mappings.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan="3" className="text-center">לא נמצאו הגדרות שמורות.</TableCell>
                    </TableRow>
                  ) : (
                    mappings.map((mapping) => (
                      <TableRow key={mapping.id}>
                        <TableCell className="font-medium">{mapping.name}</TableCell>
                        <TableCell>{mapping.is_default ? 'כן' : 'לא'}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <Button variant="outline" size="sm" onClick={() => handleEdit(mapping)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="destructive" size="sm" onClick={() => handleDelete(mapping.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
        
        <div className="space-y-4">
            <h2 className="text-xl font-semibold border-b pb-2">ייבוא ישיר</h2>
            <div className="grid md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                <DataImporter 
                    title="ייבוא לקוחות"
                    description="ייבא רשימת לקוחות חדשים. ניתן להשתמש בקובץ CSV או טקסט עם הפרדת טאב (.txt/.tsv). לשמירה על תאימות עם עברית, יש לשמור את הקובץ בקידוד UTF-8."
                    entityName="Customer"
                    templateHeaders={customerTemplateHeaders}
                    templateDisplayHeaders={customerTemplateDisplayHeaders}
                    requiredFields={customerRequiredFields}
                    preImportTask={preImportCustomers}
                    mapRowToEntity={mapCustomerRow}
                    entityCreateFn={(batch) => Customer.bulkCreate(batch)}
                    icon={Users}
                />
                 <DataImporter 
                    title="ייבוא מכשירים"
                    description="ייבא רשימת מכשירים ושייך ללקוחות. קובץ CSV או טקסט עם הפרדת טאב בקידוד UTF-8. בדיקה אוטומטית למניעת כפילויות שמות."
                    entityName="ServiceUnit"
                    templateHeaders={serviceUnitTemplateHeaders}
                    templateDisplayHeaders={serviceUnitTemplateDisplayHeaders}
                    requiredFields={serviceUnitRequiredFields}
                    preImportTask={preImportServiceUnits}
                    mapRowToEntity={mapServiceUnitRow}
                    entityCreateFn={(batch) => ServiceUnit.bulkCreate(batch)}
                    icon={HardDrive}
                />
                <DataImporter 
                    title="ייבוא קריאות שירות (שלב 1)"
                    description="ייבא קריאות שירות. ניתן להשתמש בקובץ CSV או טקסט עם הפרדת טאב (.txt/.tsv). אם מספר קריאה כבר קיים, הרשומה תעודכן. אחרת, תיווצר רשומה חדשה."
                    entityName="ServiceCall"
                    templateHeaders={serviceCallTemplateHeaders}
                    templateDisplayHeaders={serviceCallTemplateDisplayHeaders}
                    requiredFields={serviceCallRequiredFields}
                    preImportTask={preImportServiceCalls}
                    mapRowToEntity={mapServiceCallRow}
                    entityCreateFn={upsertServiceCalls}
                    icon={Wrench}
                />
                <DataImporter
                    title="ייבוא חלפים לקריאות (שלב 2)"
                    description="ייבא רשימת חלפים ושייך לקריאות שירות קיימות באמצעות מספר קריאה. ניתן להשתמש בקובץ CSV או טקסט עם הפרדת טאב (.txt/.tsv). לשמירה על תאימות עם עברית, יש לשמור את הקובץ בקידוד UTF-8."
                    entityName="ServiceCallParts"
                    templateHeaders={serviceCallPartsTemplateHeaders}
                    templateDisplayHeaders={serviceCallPartsTemplateDisplayHeaders}
                    requiredFields={serviceCallPartsRequiredFields}
                    preImportTask={preImportServiceCallParts}
                    mapRowToEntity={mapServiceCallPartRow}
                    entityCreateFn={updateServiceCallsWithParts}
                    icon={ClipboardPlus}
                />
            </div>
        </div>
    </div>
  );
}