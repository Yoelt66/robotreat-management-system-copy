import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const MAX_RETRIES = 3;
const CREATE_BATCH_SIZE = 5;
const UPDATE_BATCH_SIZE = 10;

async function apiCallWithRetry(apiCall, retries, callName) {
  for (let i = 0; i < retries; i++) {
    try {
      return await apiCall();
    } catch (error) {
      console.error(`API call failed attempt ${i + 1}/${retries} for ${callName}:`, error);
      
      const status = error.response?.status || 
                     (error.message?.includes('429') ? 429 : null) ||
                     (error.message?.includes('500') ? 500 : null) ||
                     (error.message?.includes('503') ? 503 : null);
      
      const isRateLimit = status === 429 || error.message?.includes('Rate limit');
      const isServerError = status === 500 || status === 503;
      
      if (i < retries - 1) {
        let waitTime;
        if (isRateLimit) {
          waitTime = Math.min(3000 * Math.pow(2, i), 30000); // 3s, 6s, 12s...
        } else if (isServerError) {
          waitTime = Math.min(2000 * Math.pow(2, i), 16000); // 2s, 4s, 8s...
        } else {
          waitTime = 1000;
        }
        console.log(`${callName} attempt ${i + 1} failed (status: ${status}), waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } else {
        throw new Error(`Failed ${callName} after ${retries} attempts: ${error.message}`);
      }
    }
  }
}

function parseCSV(text, hasHeaders, delimiter = ',') {
  const lines = text.trim().split(/\r\n|\n/);
  if (lines.length === 0) return [];

  const splitLine = (line, delim) => {
    const result = [];
    let inQuote = false;
    let currentField = '';
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuote = !inQuote;
      } else if (char === delim && !inQuote) {
        result.push(currentField.trim());
        currentField = '';
      } else {
        currentField += char;
      }
    }
    result.push(currentField.trim());
    return result;
  };

  const data = [];
  const startIndex = hasHeaders ? 1 : 0;

  for (let i = startIndex; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = splitLine(lines[i], delimiter);
    data.push(values.map(v => v.replace(/"/g, '')));
  }
  return data;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { file_url, fieldMapping, hasHeaders, selectedChanges } = await req.json();
    
    if (!file_url || !fieldMapping) {
      return Response.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const logs = [];
    const addLog = (message, type = 'info') => {
      logs.push({ message, type, timestamp: new Date().toISOString() });
    };

    addLog('מתחיל עיבוד קובץ...', 'info');

    // Fetch file content
    const fileResponse = await fetch(file_url);
    if (!fileResponse.ok) {
      throw new Error('Failed to fetch file from URL');
    }
    let text = await fileResponse.text();
    
    // Check for encoding issues
    const hasGarbledChars = /[\xC0-\xFF]{2,}/.test(text) && !/[\u0590-\u05FF]/.test(text);
    if (hasGarbledChars) {
      addLog('זוהה קידוד לא תקין, מנסה קידוד חלופי...', 'info');
      const blob = await fileResponse.blob();
      const arrayBuffer = await blob.arrayBuffer();
      const decoder = new TextDecoder('windows-1255');
      text = decoder.decode(arrayBuffer);
    }

    addLog('קריאת הקובץ הסתיימה, מנתח תוכן...', 'success');

    // Detect delimiter
    const isTabDelimited = text.includes('\t');
    const delimiter = isTabDelimited ? '\t' : ',';

    if (isTabDelimited) {
      addLog('מזהה קובץ עם הפרדת טאב...', 'info');
    }

    const parsedData = parseCSV(text, hasHeaders, delimiter);
    addLog(`ניתוח הסתיים, נמצאו ${parsedData.length} שורות נתונים.`, 'success');

    if (parsedData.length === 0) {
      throw new Error('הקובץ ריק או לא הכיל נתונים חוקיים.');
    }

    // Sort field mapping to match data columns
    const sortedFieldMapping = fieldMapping
      .filter(field => field.checked)
      .sort((a, b) => (a.column || Infinity) - (b.column || Infinity));

    // PREVIEW MODE - super fast, no data loading
    if (!selectedChanges || selectedChanges.length === 0) {
      addLog('מצב תצוגה מקדימה - ניתוח מהיר ללא טעינת נתונים', 'info');

      const dataToAnalyze = parsedData.slice(0, 50);
      const changes = [];

      for (const rowValues of dataToAnalyze) {
        const formattedRow = {};
        sortedFieldMapping.forEach((field, index) => {
          let value = rowValues[index];
          if (value === null || value === undefined || value === '') {
            value = null;
          } else if (typeof value === 'string') {
            value = value.trim();
            if (value === '') value = null;
          }
          formattedRow[field.key] = value;
        });

        if (formattedRow.sku) {
          changes.push({
            sku: formattedRow.sku,
            name: formattedRow.name || 'לא מוגדר',
            type: 'update', // Default to update in preview
            shouldUpdate: true,
            changes: ['תצוגה מקדימה']
          });
        }
      }

      addLog(`תצוגה מקדימה: ${changes.length} שורות נותחו`, 'success');

      return Response.json({
        success: true,
        preview: true,
        changes: changes,
        stats: {
          created: 0,
          updated: 0,
          errors: 0,
          total: changes.length
        },
        logs
      });
    }

    // ACTUAL IMPORT MODE - load all required data
    addLog('מצב ייבוא מלא - טוען נתוני מערכת...', 'info');

    const [allCategories, allWarehouses, allUnits, partCoreData, partPricingData, partSupplierData, partStockData] = await Promise.all([
      apiCallWithRetry(() => base44.asServiceRole.entities.Category.list(), MAX_RETRIES, "Category.list").catch(() => []),
      apiCallWithRetry(() => base44.asServiceRole.entities.Warehouse.list(), MAX_RETRIES, "Warehouse.list").catch(() => []),
      apiCallWithRetry(() => base44.asServiceRole.entities.Unit.list(), MAX_RETRIES, "Unit.list").catch(() => []),
      apiCallWithRetry(() => base44.asServiceRole.entities.PartCore.list(), MAX_RETRIES, "PartCore.list").catch(() => []),
      apiCallWithRetry(() => base44.asServiceRole.entities.PartPricing.list(), MAX_RETRIES, "PartPricing.list").catch(() => []),
      apiCallWithRetry(() => base44.asServiceRole.entities.PartSupplier.list(), MAX_RETRIES, "PartSupplier.list").catch(() => []),
      apiCallWithRetry(() => base44.asServiceRole.entities.PartStock.list(), MAX_RETRIES, "PartStock.list").catch(() => [])
    ]);

    // Build parts map
    const pricingMap = new Map(partPricingData.map(p => [p.part_sku, p]));
    const supplierMap = new Map(partSupplierData.map(p => [p.part_sku, p]));

    // Build stock by warehouse map
    const stockByPart = new Map();
    partStockData.forEach(stock => {
      if (!stockByPart.has(stock.part_sku)) {
        stockByPart.set(stock.part_sku, {});
      }
      stockByPart.get(stock.part_sku)[stock.warehouse_id] = stock.quantity;
    });

    // Merge all part data
    const allParts = partCoreData.map(core => {
      const pricing = pricingMap.get(core.sku) || {};
      const supplier = supplierMap.get(core.sku) || {};
      const stocks = stockByPart.get(core.sku) || {};
      return { ...core, ...pricing, ...supplier, ...stocks };
    });

    addLog(`נטענו ${allParts.length} פריטים קיימים`, 'info');
    const partMap = new Map(allParts.map(p => [String(p.sku).trim(), p]));

    const categoryMap = new Map(allCategories.map(c => [c.code, c]));
    const categoryNameMap = new Map(allCategories.map(c => [c.name, c]));
    const unitMap = new Map(allUnits.map(u => [u.code, u]));
    const unitNameMap = new Map(allUnits.map(u => [u.name, u]));

    addLog(`מנתח ${selectedChanges.length} שינויים נבחרים...`, 'info');

    // Build a map of SKU -> row index for fast lookup
    const skuToRowIndex = new Map();
    const skuField = sortedFieldMapping.find(f => f.key === 'sku');
    const skuColumnIndex = skuField ? sortedFieldMapping.indexOf(skuField) : -1;

    if (skuColumnIndex === -1) {
      throw new Error('לא נמצאה עמודת SKU במיפוי');
    }

    parsedData.forEach((row, index) => {
      const sku = row[skuColumnIndex];
      if (sku) {
        const normalizedSku = String(sku).trim();
        skuToRowIndex.set(normalizedSku, index);
      }
    });

    const changes = [];
    const selectedSkuSet = new Set(selectedChanges);

    // Process ONLY the selected rows
    for (const selectedSku of selectedChanges) {
      const rowIndex = skuToRowIndex.get(selectedSku);
      if (rowIndex === undefined) {
        addLog(`לא נמצאה שורה עבור מק"ט ${selectedSku}`, 'warn');
        continue;
      }

      const rowValues = parsedData[rowIndex];
      const formattedRow = {};

      sortedFieldMapping.forEach((field, index) => {
        let value = rowValues[index];
        if (value === null || value === undefined || value === '') {
          value = null;
        } else if (typeof value === 'string') {
          value = value.trim();
          if (value === '') {
            value = null;
          }
        }
        formattedRow[field.key] = value;
      });

      if (!formattedRow.sku) continue;

      // Skip detailed change analysis in preview mode - just track what would be created/updated
      if (!selectedChanges || selectedChanges.length === 0) {
        const existingPart = partMap.get(String(formattedRow.sku).trim());
        changes.push({
          sku: formattedRow.sku,
          name: formattedRow.name || (existingPart?.name) || 'לא מוגדר',
          type: existingPart ? 'update' : 'new',
          shouldUpdate: true,
          changes: existingPart ? ['עדכון'] : ['יצירה חדשה']
        });
        continue;
      }

      // Apply category settings
      if (formattedRow.category) {
        let categorySettings = categoryMap.get(formattedRow.category);
        if (!categorySettings) {
          categorySettings = allCategories.find(c => c.name === formattedRow.category);
        }
        
        if (categorySettings) {
          if (!formattedRow.supplier_number && categorySettings.supplier_number) {
            formattedRow.supplier_number = categorySettings.supplier_number;
          }
          if (!formattedRow.cost_currency && categorySettings.cost_currency) {
            formattedRow.cost_currency = categorySettings.cost_currency;
          }
          if (!formattedRow.sale_currency && categorySettings.sale_currency) {
            formattedRow.sale_currency = categorySettings.sale_currency;
          }
          if (formattedRow.import_percentage === undefined || formattedRow.import_percentage === null) {
            if (categorySettings.import_percentage !== undefined && categorySettings.import_percentage !== null) {
              formattedRow.import_percentage = categorySettings.import_percentage;
            }
          }
          if (formattedRow.markup_percentage === undefined || formattedRow.markup_percentage === null) {
            if (categorySettings.margin_percentage !== undefined && categorySettings.margin_percentage !== null) {
              formattedRow.markup_percentage = categorySettings.margin_percentage;
            }
          }
        }
      }

      const existingPart = partMap.get(String(formattedRow.sku).trim());
      

      
      if (!existingPart) {
        changes.push({
          sku: formattedRow.sku,
          name: formattedRow.name || 'לא מוגדר',
          type: 'new',
          shouldUpdate: true,
          newData: formattedRow
        });
      } else {
        const itemChanges = [];
        const allFields = [
          'name', 'category', 'unit', 'minimum_stock', 'notes', 'current_location', 
          'replaced_sku', 'requires_serial_number', 'cost_price', 'cost_currency', 
          'sale_currency', 'import_percentage', 'markup_percentage', 'manual_sale_price', 
          'supplier_number', 'supplier_part_number'
        ];
        
        allFields.forEach(field => {
          if (formattedRow[field] !== undefined && formattedRow[field] !== null) {
            const oldValue = existingPart[field];
            const newValue = formattedRow[field];
            
            if (String(oldValue || '') !== String(newValue || '')) {
              itemChanges.push({
                field: field,
                old: oldValue || 'ריק',
                new: newValue || 'ריק'
              });
            }
          }
        });

        // Check stock changes
        const stockChanges = [];
        allWarehouses.forEach(warehouse => {
          const stockValue = formattedRow[String(warehouse.warehouse_id)];
          
          if (stockValue !== null && stockValue !== undefined && stockValue !== '') {
            const newQuantity = parseInt(stockValue) || 0;
            const currentQuantity = existingPart[warehouse.warehouse_id] || 0;
            
            if (newQuantity !== currentQuantity) {
              stockChanges.push({
                field: `מלאי ${warehouse.name}`,
                old: currentQuantity,
                new: newQuantity
              });
            }
          }
        });

        const allChanges = [...itemChanges, ...stockChanges];
        
        if (allChanges.length > 0) {
          const changeType = itemChanges.length > 0 ? 'update' : 'stock_only';
          changes.push({
            sku: formattedRow.sku,
            name: formattedRow.name || existingPart.name,
            type: changeType,
            shouldUpdate: true,
            changes: allChanges,
            newData: formattedRow,
            existingData: existingPart
          });
        }
      }
      }

      addLog(`נמצאו ${changes.length} שינויים לעיבוד`, 'success');
      const changesToProcess = changes;

    // Process changes
    const newItems = changesToProcess.filter(c => c.type === 'new');
    const allItemsToProcess = changesToProcess.filter(c => c.type !== 'no_change');
    
    let createdCount = 0;
    let updatedCount = 0;
    let errorCount = 0;

    // Phase 1: Create new items in batches
    if (newItems.length > 0) {
      addLog(`יוצר רשומות בסיסיות עבור ${newItems.length} פריטים חדשים בקבוצות של ${CREATE_BATCH_SIZE}...`, 'info');

      for (let i = 0; i < newItems.length; i += CREATE_BATCH_SIZE) {
        const batch = newItems.slice(i, i + CREATE_BATCH_SIZE);
        addLog(`יוצר קבוצה ${Math.floor(i / CREATE_BATCH_SIZE) + 1}/${Math.ceil(newItems.length / CREATE_BATCH_SIZE)} (${batch.length} פריטים)...`, 'info');

      for (let bi = 0; bi < batch.length; bi++) {
        const change = batch[bi];
        try {
          const formattedRow = change.newData;
          
          // Validate required fields
          if (!formattedRow.sku || !formattedRow.name) {
            throw new Error(`חסרים שדות חובה: sku=${formattedRow.sku}, name=${formattedRow.name}`);
          }
          
          // Validate and normalize category - auto-create if needed
          let categoryCode = formattedRow.category || null;
          if (categoryCode) {
            // Try to find by code first
            if (!categoryMap.has(categoryCode)) {
              // Try by name
              const categoryByName = categoryNameMap.get(categoryCode);
              if (categoryByName) {
                categoryCode = categoryByName.code;
              } else {
                // Create new category automatically
                addLog(`יוצר קטגוריה חדשה: ${categoryCode}`, 'info');
                try {
                  const newCategory = await apiCallWithRetry(
                    () => base44.asServiceRole.entities.Category.create({
                      code: categoryCode,
                      name: categoryCode,
                      color: 'bg-gray-100 text-gray-800'
                    }),
                    MAX_RETRIES,
                    `Create category ${categoryCode}`
                  );
                  categoryMap.set(categoryCode, newCategory);
                  allCategories.push(newCategory);
                } catch (catError) {
                  // Unique constraint: category may have been created by a concurrent process - re-fetch
                  const existing = await base44.asServiceRole.entities.Category.filter({ code: categoryCode }).catch(() => []);
                  if (existing && existing.length > 0) {
                    categoryMap.set(categoryCode, existing[0]);
                    addLog(`קטגוריה ${categoryCode} כבר קיימת, נמצאה בהצלחה.`, 'info');
                  } else {
                    addLog(`שגיאה ביצירת קטגוריה ${categoryCode}: ${catError.message}. משתמש בברירת מחדל.`, 'warn');
                    categoryCode = allCategories.length > 0 ? allCategories[0].code : 'other';
                  }
                }
              }
            }
          } else {
            categoryCode = allCategories.length > 0 ? allCategories[0].code : 'other';
          }
          
          // Validate and normalize unit - auto-create if needed
          let unitCode = formattedRow.unit || null;
          if (unitCode) {
            // Try to find by code first
            if (!unitMap.has(unitCode)) {
              // Try by name
              const unitByName = unitNameMap.get(unitCode);
              if (unitByName) {
                unitCode = unitByName.code;
              } else {
                // Create new unit automatically
                addLog(`יוצר יחידת מידה חדשה: ${unitCode}`, 'info');
                try {
                  const newUnit = await apiCallWithRetry(
                    () => base44.asServiceRole.entities.Unit.create({
                      code: unitCode,
                      name: unitCode,
                      type: 'quantity',
                      is_active: true
                    }),
                    MAX_RETRIES,
                    `Create unit ${unitCode}`
                  );
                  unitMap.set(unitCode, newUnit);
                  allUnits.push(newUnit);
                } catch (unitError) {
                  // Unique constraint: unit may have been created by a concurrent process - re-fetch
                  const existing = await base44.asServiceRole.entities.Unit.filter({ code: unitCode }).catch(() => []);
                  if (existing && existing.length > 0) {
                    unitMap.set(unitCode, existing[0]);
                    addLog(`יחידת מידה ${unitCode} כבר קיימת, נמצאה בהצלחה.`, 'info');
                  } else {
                    addLog(`שגיאה ביצירת יחידת מידה ${unitCode}: ${unitError.message}. משתמש בברירת מחדל.`, 'warn');
                    unitCode = allUnits.length > 0 ? allUnits[0].code : 'pieces';
                  }
                }
              }
            }
          } else {
            unitCode = allUnits.length > 0 ? allUnits[0].code : 'pieces';
          }
          
          const partPayload = {
            sku: String(formattedRow.sku).trim(),
            name: String(formattedRow.name).trim(),
            category: categoryCode,
            unit: unitCode,
            minimum_stock: parseFloat(formattedRow.minimum_stock) || 0,
            notes: formattedRow.notes || '',
            current_location: formattedRow.current_location || '',
            replaced_sku: formattedRow.replaced_sku || '',
            requires_serial_number: formattedRow.requires_serial_number || false,
            warehouses: allWarehouses.map(wh => ({
              warehouse_id: wh.warehouse_id,
              quantity: parseFloat(formattedRow[wh.warehouse_id]) || 0
            })),
            cost_price: parseFloat(formattedRow.cost_price) || 0,
            cost_currency: formattedRow.cost_currency || 'ILS',
            sale_currency: formattedRow.sale_currency || 'ILS',
            import_percentage: formattedRow.import_percentage !== undefined && formattedRow.import_percentage !== null && formattedRow.import_percentage !== '' ? parseFloat(formattedRow.import_percentage) : 0,
            markup_percentage: formattedRow.markup_percentage !== undefined && formattedRow.markup_percentage !== null && formattedRow.markup_percentage !== '' ? parseFloat(formattedRow.markup_percentage) : 0,
            manual_sale_price: formattedRow.manual_sale_price && formattedRow.manual_sale_price !== '' ? parseFloat(formattedRow.manual_sale_price) : 0,
            is_manual: formattedRow.manual_sale_price && formattedRow.manual_sale_price !== '' ? true : false,
            supplier_number: formattedRow.supplier_number || '',
            supplier_part_number: formattedRow.supplier_part_number || ''
          };
          
          let response;
          try {
            response = await apiCallWithRetry(
              () => base44.functions.invoke('createPart', partPayload),
              MAX_RETRIES,
              `createPart ${formattedRow.sku}`
            );
          } catch (invokeError) {
            const errorDetails = invokeError.response?.data || invokeError.message;
            addLog(`שגיאת קריאה ל-createPart (${formattedRow.sku}): ${JSON.stringify(errorDetails)}`, 'error');
            throw invokeError;
          }
          
          if (response?.data?.error) {
            throw new Error(response.data.error);
          }
          
          if (!response?.data?.success) {
            throw new Error('התשובה מהשרת לא מצביעה על הצלחה');
          }
          
          createdCount++;
          } catch (e) {
          const errorDetails = e.response?.data || e.message;
          addLog(`שגיאה ביצירת פריט ${change.newData.sku}: ${JSON.stringify(errorDetails)}`, 'error');
          errorCount++;
          }

          // Short delay every 3 items to avoid rate limiting
          if (bi % 3 === 2) {
            await new Promise(resolve => setTimeout(resolve, 200));
          }
          }

          // Short delay between batches
          if (i + CREATE_BATCH_SIZE < newItems.length) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
          }
          addLog(`${createdCount} פריטים חדשים נוצרו בהצלחה.`, 'success');
          }

    // Phase 2: Update existing items only (skip newly created ones)
    const itemsToUpdate = allItemsToProcess.filter(c => c.type !== 'new');
    
    if (itemsToUpdate.length > 0) {
      addLog(`מעדכן ${itemsToUpdate.length} פריטים קיימים...`, 'info');

      // Use already-loaded partMap (no need to reload from DB)
      const partMapUpdated = partMap;
      
      const coreFields = ['name', 'category', 'unit', 'minimum_stock', 'notes', 'current_location', 'replaced_sku', 'requires_serial_number', 'last_count_date'];
      const pricingFields = ['cost_price', 'cost_currency', 'sale_currency', 'import_percentage', 'markup_percentage', 'manual_sale_price', 'is_manual'];
      const numericCoreFields = ['minimum_stock'];
      const numericPricingFields = ['cost_price', 'import_percentage', 'markup_percentage', 'manual_sale_price'];
      const supplierFields = ['supplier_number', 'supplier_part_number'];

      for (let i = 0; i < itemsToUpdate.length; i++) {
        const change = itemsToUpdate[i];
        try {
          const formattedRow = change.newData;
          const existingPart = partMapUpdated.get(formattedRow.sku);
          
          if (!existingPart) {
            addLog(`פריט ${formattedRow.sku} לא נמצא במערכת, מדלג`, 'warn');
            continue;
          }

          const updateData = { sku: existingPart.sku };
          let hasChanges = false;

          coreFields.forEach(field => {
            if (formattedRow[field] !== undefined && formattedRow[field] !== null && formattedRow[field] !== '') {
              const newValue = numericCoreFields.includes(field) ? parseFloat(formattedRow[field]) || 0 : formattedRow[field];
              const existingValue = numericCoreFields.includes(field) ? parseFloat(existingPart[field]) || 0 : existingPart[field] || '';
              if (String(existingValue) !== String(newValue)) { updateData[field] = newValue; hasChanges = true; }
            }
          });

          pricingFields.forEach(field => {
            if (formattedRow[field] !== undefined && formattedRow[field] !== null && formattedRow[field] !== '') {
              const newValue = numericPricingFields.includes(field) ? parseFloat(formattedRow[field]) || 0 : formattedRow[field];
              const existingValue = numericPricingFields.includes(field) ? parseFloat(existingPart[field]) || 0 : existingPart[field] || '';
              if (String(existingValue) !== String(newValue)) { updateData[field] = newValue; hasChanges = true; }
            }
          });

          if (formattedRow.manual_sale_price !== undefined && formattedRow.manual_sale_price !== null && formattedRow.manual_sale_price !== '') {
            updateData.is_manual = true; hasChanges = true;
          }

          supplierFields.forEach(field => {
            if (formattedRow[field] !== undefined && formattedRow[field] !== null && formattedRow[field] !== '') {
              if (String(existingPart[field] || '') !== String(formattedRow[field])) { updateData[field] = formattedRow[field]; hasChanges = true; }
            }
          });

          // Add warehouse stock updates
          const warehousesToUpdate = allWarehouses
            .map(wh => ({ warehouse_id: wh.warehouse_id, quantity: parseFloat(formattedRow[wh.warehouse_id]) || 0 }))
            .filter(wh => formattedRow[wh.warehouse_id] !== null && formattedRow[wh.warehouse_id] !== undefined && formattedRow[wh.warehouse_id] !== '');
          
          if (warehousesToUpdate.length > 0) {
            updateData.warehouses = warehousesToUpdate;
            hasChanges = true;
          }

          if (hasChanges) {
            const response = await apiCallWithRetry(
              () => base44.functions.invoke('updatePart', updateData),
              MAX_RETRIES,
              `Part Update ${existingPart.sku}`
            );
            if (response?.data?.error) throw new Error(response.data.error);
            updatedCount++;
          }

          // Short delay every 3 items to avoid rate limiting
          if (i % 3 === 2) {
            await new Promise(resolve => setTimeout(resolve, 200));
          }

        } catch (e) {
          errorCount++;
          addLog(`שגיאה בעדכון מק"ט ${change.sku || 'לא ידוע'}: ${e.message}`, 'error');
        }

        if (i % UPDATE_BATCH_SIZE === UPDATE_BATCH_SIZE - 1) {
          addLog(`עודכנו ${Math.min(i + 1, itemsToUpdate.length)}/${itemsToUpdate.length} פריטים...`, 'info');
        }
      }
    }

    addLog('=== סיכום ייבוא ===', 'success');
    addLog(`פריטים חדשים שנוצרו: ${createdCount}`, 'success');
    addLog(`פריטים קיימים שעודכנו: ${updatedCount}`, 'success');
    addLog(`שגיאות: ${errorCount}`, errorCount > 0 ? 'error' : 'success');
    
    if (errorCount === 0) {
      addLog('הייבוא הושלם בהצלחה! 🎉', 'success');
    } else {
      addLog(`הייבוא הושלם עם ${errorCount} שגיאות.`, 'warn');
    }

    return Response.json({
      success: true,
      stats: {
        created: createdCount,
        updated: updatedCount,
        errors: errorCount,
        total: changesToProcess.length
      },
      logs
    });

  } catch (error) {
    console.error('Import failed:', error);
    return Response.json({
      success: false,
      error: error.message,
      logs: [{ message: `הייבוא נכשל: ${error.message}`, type: 'error', timestamp: new Date().toISOString() }]
    }, { status: 500 });
  }
});