import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const MAX_RETRIES = 3;
const UPDATE_BATCH_SIZE = 10;

async function apiCallWithRetry(apiCall, retries, callName) {
  for (let i = 0; i < retries; i++) {
    try {
      return await apiCall();
    } catch (error) {
      const status = error.response?.status ||
        (error.message?.includes('429') ? 429 : null) ||
        (error.message?.includes('500') ? 500 : null) ||
        (error.message?.includes('503') ? 503 : null);

      if (i < retries - 1) {
        const isRateLimit = status === 429;
        const isServerError = status === 500 || status === 503;
        let waitTime = 1000;
        if (isRateLimit) waitTime = Math.min(3000 * Math.pow(2, i), 30000);
        else if (isServerError) waitTime = Math.min(2000 * Math.pow(2, i), 16000);
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

// Sequential processing with concurrency limit
async function processWithConcurrency(items, concurrency, processor, onProgress) {
  const results = [];
  let index = 0;
  let done = 0;

  async function worker() {
    while (index < items.length) {
      const i = index++;
      try {
        await processor(items[i]);
        results[i] = { success: true };
      } catch (err) {
        results[i] = { success: false, error: err.message, item: items[i] };
      }
      done++;
      if (onProgress) onProgress(done, items.length, results[i]);
      // Small delay between tasks
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);
  return results;
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
    if (!fileResponse.ok) throw new Error('Failed to fetch file from URL');
    let text = await fileResponse.text();

    // Check for encoding issues
    const hasGarbledChars = /[\xC0-\xFF]{2,}/.test(text) && !/[\u0590-\u05FF]/.test(text);
    if (hasGarbledChars) {
      addLog('זוהה קידוד לא תקין, מנסה קידוד חלופי...', 'info');
      const fileResponse2 = await fetch(file_url);
      const arrayBuffer = await fileResponse2.arrayBuffer();
      const decoder = new TextDecoder('windows-1255');
      text = decoder.decode(arrayBuffer);
    }

    addLog('קריאת הקובץ הסתיימה, מנתח תוכן...', 'success');

    const isTabDelimited = text.includes('\t');
    const delimiter = isTabDelimited ? '\t' : ',';
    if (isTabDelimited) addLog('מזהה קובץ עם הפרדת טאב...', 'info');

    const parsedData = parseCSV(text, hasHeaders, delimiter);
    addLog(`ניתוח הסתיים, נמצאו ${parsedData.length} שורות נתונים.`, 'success');

    if (parsedData.length === 0) throw new Error('הקובץ ריק או לא הכיל נתונים חוקיים.');

    const sortedFieldMapping = fieldMapping
      .filter(field => field.checked)
      .sort((a, b) => (a.column || Infinity) - (b.column || Infinity));

    // PREVIEW MODE
    if (!selectedChanges || selectedChanges.length === 0) {
      const changes = parsedData.slice(0, 50).map(rowValues => {
        const formattedRow = {};
        sortedFieldMapping.forEach((field, index) => {
          let value = rowValues[index];
          if (value === null || value === undefined || value === '') value = null;
          else if (typeof value === 'string') { value = value.trim(); if (value === '') value = null; }
          formattedRow[field.key] = value;
        });
        if (!formattedRow.sku) return null;
        return { sku: formattedRow.sku, name: formattedRow.name || 'לא מוגדר', type: 'update', shouldUpdate: true, changes: ['תצוגה מקדימה'] };
      }).filter(Boolean);

      return Response.json({ success: true, preview: true, changes, stats: { created: 0, updated: 0, errors: 0, total: changes.length }, logs });
    }

    // ACTUAL IMPORT MODE
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

    const pricingMap = new Map(partPricingData.map(p => [p.part_sku, p]));
    const supplierMap = new Map(partSupplierData.map(p => [p.part_sku, p]));
    const stockByPart = new Map();
    partStockData.forEach(stock => {
      if (!stockByPart.has(stock.part_sku)) stockByPart.set(stock.part_sku, {});
      stockByPart.get(stock.part_sku)[stock.warehouse_id] = stock.quantity;
    });

    const allParts = partCoreData.map(core => {
      const { id: _pid, ...pricing } = pricingMap.get(core.sku) || {};
      const { id: _sid, ...supplier } = supplierMap.get(core.sku) || {};
      const stocks = stockByPart.get(core.sku) || {};
      return { ...pricing, ...supplier, ...stocks, ...core };
    });

    addLog(`נטענו ${allParts.length} פריטים קיימים`, 'info');
    const partMap = new Map(allParts.map(p => [String(p.sku).trim(), p]));

    const categoryMap = new Map(allCategories.map(c => [c.code, c]));
    const categoryNameMap = new Map(allCategories.map(c => [c.name, c]));
    const unitMap = new Map(allUnits.map(u => [u.code, u]));
    const unitNameMap = new Map(allUnits.map(u => [u.name, u]));

    addLog(`מנתח ${selectedChanges.length} שינויים נבחרים...`, 'info');

    // Build SKU -> row index map
    const skuField = sortedFieldMapping.find(f => f.key === 'sku');
    const skuColumnIndex = skuField ? sortedFieldMapping.indexOf(skuField) : -1;
    if (skuColumnIndex === -1) throw new Error('לא נמצאה עמודת SKU במיפוי');

    const skuToRowIndex = new Map();
    parsedData.forEach((row, index) => {
      const sku = row[skuColumnIndex];
      if (sku) skuToRowIndex.set(String(sku).trim(), index);
    });

    const coreFields = ['name', 'category', 'unit', 'minimum_stock', 'notes', 'current_location', 'replaced_sku', 'requires_serial_number', 'last_count_date'];
    const pricingFields = ['cost_price', 'cost_currency', 'sale_currency', 'import_percentage', 'markup_percentage', 'manual_sale_price', 'is_manual'];
    const numericCoreFields = ['minimum_stock'];
    const numericPricingFields = ['cost_price', 'import_percentage', 'markup_percentage', 'manual_sale_price'];
    const supplierFields = ['supplier_number', 'supplier_part_number'];

    async function resolveCategoryCode(code) {
      if (!code) return allCategories.length > 0 ? allCategories[0].code : 'other';
      if (categoryMap.has(code)) return code;
      const byName = categoryNameMap.get(code);
      if (byName) return byName.code;
      try {
        const created = await apiCallWithRetry(
          () => base44.asServiceRole.entities.Category.create({ code, name: code, color: 'bg-gray-100 text-gray-800' }),
          MAX_RETRIES, `Create category ${code}`
        );
        categoryMap.set(code, created);
        return code;
      } catch {
        return allCategories.length > 0 ? allCategories[0].code : 'other';
      }
    }

    async function resolveUnitCode(code) {
      if (!code) return allUnits.length > 0 ? allUnits[0].code : 'pieces';
      if (unitMap.has(code)) return code;
      const byName = unitNameMap.get(code);
      if (byName) return byName.code;
      try {
        const created = await apiCallWithRetry(
          () => base44.asServiceRole.entities.Unit.create({ code, name: code, type: 'quantity', is_active: true }),
          MAX_RETRIES, `Create unit ${code}`
        );
        unitMap.set(code, created);
        return code;
      } catch {
        return allUnits.length > 0 ? allUnits[0].code : 'pieces';
      }
    }

    // Build changes list from selected SKUs
    const changesToProcess = [];
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
        if (value === null || value === undefined || value === '') value = null;
        else if (typeof value === 'string') { value = value.trim(); if (value === '') value = null; }
        formattedRow[field.key] = value;
      });

      if (!formattedRow.sku) continue;

      // Apply category defaults
      if (formattedRow.category) {
        const categorySettings = categoryMap.get(formattedRow.category) || allCategories.find(c => c.name === formattedRow.category);
        if (categorySettings) {
          if (!formattedRow.supplier_number && categorySettings.supplier_number) formattedRow.supplier_number = categorySettings.supplier_number;
          if (!formattedRow.cost_currency && categorySettings.cost_currency) formattedRow.cost_currency = categorySettings.cost_currency;
          if (!formattedRow.sale_currency && categorySettings.sale_currency) formattedRow.sale_currency = categorySettings.sale_currency;
          if (formattedRow.import_percentage == null) formattedRow.import_percentage = categorySettings.import_percentage;
          if (formattedRow.markup_percentage == null) formattedRow.markup_percentage = categorySettings.margin_percentage;
        }
      }

      const existingPart = partMap.get(String(formattedRow.sku).trim());
      changesToProcess.push({ type: existingPart ? 'update' : 'new', newData: formattedRow, existingPart });
    }

    addLog(`נמצאו ${changesToProcess.length} שינויים לעיבוד`, 'success');

    let createdCount = 0;
    let updatedCount = 0;
    let errorCount = 0;

    // Process CREATE
    const newItems = changesToProcess.filter(c => c.type === 'new');
    if (newItems.length > 0) {
      addLog(`יוצר ${newItems.length} פריטים חדשים...`, 'info');
      const results = await processWithConcurrency(newItems, 2, async (change) => {
        const formattedRow = change.newData;
        const sku = String(formattedRow.sku).trim();
        if (!sku || !formattedRow.name) throw new Error(`חסרים שדות חובה`);

        const categoryCode = await resolveCategoryCode(formattedRow.category);
        const unitCode = await resolveUnitCode(formattedRow.unit);

        await apiCallWithRetry(() => base44.asServiceRole.entities.PartCore.create({
          sku, name: String(formattedRow.name).trim(), category: categoryCode, unit: unitCode,
          minimum_stock: parseFloat(formattedRow.minimum_stock) || 0, notes: formattedRow.notes || '',
          current_location: formattedRow.current_location || '', replaced_sku: formattedRow.replaced_sku || '',
          requires_serial_number: formattedRow.requires_serial_number || false,
        }), MAX_RETRIES, `PartCore.create ${sku}`);

        await apiCallWithRetry(() => base44.asServiceRole.entities.PartPricing.create({
          part_sku: sku,
          cost_price: parseFloat(formattedRow.cost_price) || 0,
          cost_currency: formattedRow.cost_currency || 'ILS',
          sale_currency: formattedRow.sale_currency || 'ILS',
          import_percentage: formattedRow.import_percentage != null ? parseFloat(formattedRow.import_percentage) : 0,
          markup_percentage: formattedRow.markup_percentage != null ? parseFloat(formattedRow.markup_percentage) : 0,
          manual_sale_price: formattedRow.manual_sale_price ? parseFloat(formattedRow.manual_sale_price) : 0,
          is_manual: !!(formattedRow.manual_sale_price),
        }), MAX_RETRIES, `PartPricing.create ${sku}`);

        await apiCallWithRetry(() => base44.asServiceRole.entities.PartSupplier.create({
          part_sku: sku, supplier_number: formattedRow.supplier_number || '', supplier_part_number: formattedRow.supplier_part_number || '',
        }), MAX_RETRIES, `PartSupplier.create ${sku}`);

        await Promise.all(allWarehouses.map(wh =>
          apiCallWithRetry(() => base44.asServiceRole.entities.PartStock.create({
            part_sku: sku, warehouse_id: wh.warehouse_id, quantity: parseFloat(formattedRow[wh.warehouse_id]) || 0,
          }), MAX_RETRIES, `PartStock.create ${sku}/${wh.warehouse_id}`)
        ));
      }, (done, total, result) => {
        if (!result.success) {
          errorCount++;
          addLog(`שגיאה ביצירת מק"ט ${result.item?.newData?.sku}: ${result.error}`, 'error');
        } else {
          createdCount++;
        }
        if (done % UPDATE_BATCH_SIZE === 0) addLog(`יצירה: ${done}/${total}`, 'info');
      });
    }

    // Process UPDATE
    const itemsToUpdate = changesToProcess.filter(c => c.type === 'update');
    if (itemsToUpdate.length > 0) {
      addLog(`מעדכן ${itemsToUpdate.length} פריטים קיימים...`, 'info');
      await processWithConcurrency(itemsToUpdate, 3, async (change) => {
        const formattedRow = change.newData;
        const existingPart = change.existingPart;
        const sku = existingPart.sku;

        // Update PartCore
        const coreUpdate = {};
        for (const field of coreFields) {
          if (formattedRow[field] != null && formattedRow[field] !== '') {
            const newValue = numericCoreFields.includes(field) ? parseFloat(formattedRow[field]) || 0 : formattedRow[field];
            const existingValue = numericCoreFields.includes(field) ? parseFloat(existingPart[field]) || 0 : existingPart[field] || '';
            if (String(existingValue) !== String(newValue)) coreUpdate[field] = newValue;
          }
        }
        if (Object.keys(coreUpdate).length > 0) {
          await apiCallWithRetry(() => base44.asServiceRole.entities.PartCore.update(existingPart.id, coreUpdate), MAX_RETRIES, `PartCore.update ${sku}`);
        }

        // Update PartPricing
        const pricingUpdate = {};
        for (const field of pricingFields) {
          if (formattedRow[field] != null && formattedRow[field] !== '') {
            const newValue = numericPricingFields.includes(field) ? parseFloat(formattedRow[field]) || 0 : formattedRow[field];
            const existingValue = numericPricingFields.includes(field) ? parseFloat(existingPart[field]) || 0 : existingPart[field] || '';
            if (String(existingValue) !== String(newValue)) pricingUpdate[field] = newValue;
          }
        }
        if (formattedRow.manual_sale_price != null && formattedRow.manual_sale_price !== '') pricingUpdate.is_manual = true;
        if (Object.keys(pricingUpdate).length > 0) {
          const existingPricingRecord = pricingMap.get(sku);
          if (existingPricingRecord) {
            await apiCallWithRetry(() => base44.asServiceRole.entities.PartPricing.update(existingPricingRecord.id, pricingUpdate), MAX_RETRIES, `PartPricing.update ${sku}`);
          } else {
            await apiCallWithRetry(() => base44.asServiceRole.entities.PartPricing.create({ part_sku: sku, ...pricingUpdate }), MAX_RETRIES, `PartPricing.create ${sku}`);
          }
        }

        // Update PartSupplier
        const supplierUpdate = {};
        for (const field of supplierFields) {
          if (formattedRow[field] != null && formattedRow[field] !== '') {
            if (String(existingPart[field] || '') !== String(formattedRow[field])) supplierUpdate[field] = formattedRow[field];
          }
        }
        if (Object.keys(supplierUpdate).length > 0) {
          const existingSupplierRecord = supplierMap.get(sku);
          if (existingSupplierRecord) {
            await apiCallWithRetry(() => base44.asServiceRole.entities.PartSupplier.update(existingSupplierRecord.id, supplierUpdate), MAX_RETRIES, `PartSupplier.update ${sku}`);
          } else {
            await apiCallWithRetry(() => base44.asServiceRole.entities.PartSupplier.create({ part_sku: sku, ...supplierUpdate }), MAX_RETRIES, `PartSupplier.create ${sku}`);
          }
        }

        // Update PartStock
        await Promise.all(
          allWarehouses
            .filter(wh => formattedRow[wh.warehouse_id] != null && formattedRow[wh.warehouse_id] !== '')
            .map(async wh => {
              const newQty = parseFloat(formattedRow[wh.warehouse_id]) || 0;
              const existingStock = partStockData.find(s => s.part_sku === sku && s.warehouse_id === wh.warehouse_id);
              if (existingStock) {
                if (existingStock.quantity !== newQty) {
                  await apiCallWithRetry(() => base44.asServiceRole.entities.PartStock.update(existingStock.id, { quantity: newQty }), MAX_RETRIES, `PartStock.update ${sku}/${wh.warehouse_id}`);
                }
              } else {
                await apiCallWithRetry(() => base44.asServiceRole.entities.PartStock.create({ part_sku: sku, warehouse_id: wh.warehouse_id, quantity: newQty }), MAX_RETRIES, `PartStock.create ${sku}/${wh.warehouse_id}`);
              }
            })
        );
      }, (done, total, result) => {
        if (!result.success) {
          errorCount++;
          addLog(`שגיאה בעדכון מק"ט ${result.item?.newData?.sku}: ${result.error}`, 'error');
        } else {
          updatedCount++;
        }
        if (done % UPDATE_BATCH_SIZE === 0) addLog(`עדכון: ${done}/${total}`, 'info');
      });
    }

    addLog('=== סיכום ייבוא ===', 'success');
    addLog(`פריטים חדשים שנוצרו: ${createdCount}`, 'success');
    addLog(`פריטים קיימים שעודכנו: ${updatedCount}`, 'success');
    addLog(`שגיאות: ${errorCount}`, errorCount > 0 ? 'error' : 'success');
    addLog(errorCount === 0 ? 'הייבוא הושלם בהצלחה! 🎉' : `הייבוא הושלם עם ${errorCount} שגיאות.`, errorCount === 0 ? 'success' : 'warn');

    return Response.json({ success: true, stats: { created: createdCount, updated: updatedCount, errors: errorCount, total: changesToProcess.length }, logs });

  } catch (error) {
    console.error('Import failed:', error);
    return Response.json({ success: false, error: error.message, logs: [{ message: `הייבוא נכשל: ${error.message}`, type: 'error', timestamp: new Date().toISOString() }] }, { status: 500 });
  }
});