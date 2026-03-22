import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';
import * as XLSX from 'npm:xlsx@0.18.5';

const MAX_RETRIES = 10;
const UPDATE_BATCH_SIZE = 20;
const CONCURRENCY = 3;
const ITEM_DELAY_MS = 300;

async function apiCallWithRetry(apiCall, retries = MAX_RETRIES) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await apiCall();
    } catch (err) {
      if (attempt === retries) throw err;
      const delay = Math.min(500 * attempt, 8000); // exponential backoff up to 8s
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

function parseFileData(arrayBuffer, hasHeaders) {
  const workbook = XLSX.read(arrayBuffer, { type: 'array', codepage: 65001 });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const allRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: null });

  const startIndex = hasHeaders ? 1 : 0;
  const data = [];

  for (let i = startIndex; i < allRows.length; i++) {
    const row = allRows[i];
    if (!row || row.every(cell => cell === null || cell === undefined || String(cell).trim() === '')) continue;
    data.push(row.map(cell => {
      if (cell === null || cell === undefined) return null;
      const str = String(cell).trim();
      return str === '' ? null : str;
    }));
  }

  return data;
}

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
      await new Promise(resolve => setTimeout(resolve, ITEM_DELAY_MS));
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

    addLog(`מתחיל עיבוד קובץ (MAX_RETRIES=${MAX_RETRIES}, CONCURRENCY=${CONCURRENCY})...`, 'info');

    const fileResponse = await fetch(file_url);
    if (!fileResponse.ok) throw new Error('Failed to fetch file from URL');
    const arrayBuffer = await fileResponse.arrayBuffer();

    addLog('קריאת הקובץ הסתיימה, מנתח תוכן...', 'success');
    const parsedData = parseFileData(arrayBuffer, hasHeaders);
    addLog(`ניתוח הסתיים, נמצאו ${parsedData.length} שורות.`, 'success');

    if (parsedData.length === 0) throw new Error('הקובץ ריק או לא הכיל נתונים חוקיים.');

    const sortedFieldMapping = fieldMapping
      .filter(field => field.checked)
      .sort((a, b) => (a.column || Infinity) - (b.column || Infinity));

    const clientNameField = sortedFieldMapping.find(f => f.key === 'client_name');
    if (!clientNameField) throw new Error('לא נמצאה עמודת שם לקוח במיפוי');
    const clientNameFileColumnIndex = clientNameField.column ? (clientNameField.column - 1) : 0;

    // PREVIEW MODE
    if (!selectedChanges || selectedChanges.length === 0) {
      const changes = parsedData.slice(0, 50).map(rowValues => {
        const formattedRow = {};
        sortedFieldMapping.forEach((field) => {
          const colIdx = (field.column || 1) - 1;
          let value = rowValues[colIdx];
          if (value === null || value === undefined || value === '') value = null;
          else if (typeof value === 'string') { value = value.trim(); if (value === '') value = null; }
          formattedRow[field.key] = value;
        });
        if (!formattedRow.client_name) return null;
        return { sku: formattedRow.client_name, name: formattedRow.client_name || 'לא מוגדר', type: 'update', shouldUpdate: true, changes: ['תצוגה מקדימה'] };
      }).filter(Boolean);

      return Response.json({ success: true, preview: true, changes, stats: { created: 0, updated: 0, errors: 0, total: changes.length }, failed_skus: [], logs });
    }

    // ACTUAL IMPORT MODE
    addLog('מצב ייבוא מלא - טוען נתוני מערכת...', 'info');

    const [allCategories, allWarehouses, allUnits, partCoreData, partPricingData, partSupplierData, partStockData] = await Promise.all([
      apiCallWithRetry(() => base44.asServiceRole.entities.Category.list()).catch(() => []),
      apiCallWithRetry(() => base44.asServiceRole.entities.Warehouse.list()).catch(() => []),
      apiCallWithRetry(() => base44.asServiceRole.entities.Unit.list()).catch(() => []),
      apiCallWithRetry(() => base44.asServiceRole.entities.PartCore.list(undefined, 10000)).catch(() => []),
      apiCallWithRetry(() => base44.asServiceRole.entities.PartPricing.list(undefined, 10000)).catch(() => []),
      apiCallWithRetry(() => base44.asServiceRole.entities.PartSupplier.list(undefined, 10000)).catch(() => []),
      apiCallWithRetry(() => base44.asServiceRole.entities.PartStock.list(undefined, 50000)).catch(() => [])
    ]);

    const pricingMap = new Map(partPricingData.map(p => [p.part_sku, p]));
    const supplierMap = new Map(partSupplierData.map(p => [p.part_sku, p]));

    // ─── Deduplicate PartStock records ────────────────────────────────────────
    // Group by "part_sku/warehouse_id" - keep the record with highest quantity, delete the rest
    const stockGroups = new Map();
    for (const s of partStockData) {
      const key = `${s.part_sku}/${s.warehouse_id}`;
      if (!stockGroups.has(key)) {
        stockGroups.set(key, []);
      }
      stockGroups.get(key).push(s);
    }

    let dedupCount = 0;
    for (const [, records] of stockGroups) {
      if (records.length > 1) {
        // Keep the record with the highest quantity
        records.sort((a, b) => (b.quantity || 0) - (a.quantity || 0));
        const toDelete = records.slice(1);
        for (const dup of toDelete) {
          await apiCallWithRetry(() => base44.asServiceRole.entities.PartStock.delete(dup.id)).catch(() => {});
          dedupCount++;
        }
        // Update the data array - keep only the winner
        const winner = records[0];
        const idx = partStockData.indexOf(toDelete[0]);
        // remove duplicates from partStockData in-memory
        for (const dup of toDelete) {
          const i = partStockData.indexOf(dup);
          if (i !== -1) partStockData.splice(i, 1);
        }
      }
    }
    if (dedupCount > 0) {
      addLog(`נמחקו ${dedupCount} רישומי מלאי כפולים`, 'warn');
    }

    // O(1) stock lookup: "sku/warehouse_id" -> record
    const stockLookup = new Map();
    partStockData.forEach(s => stockLookup.set(`${s.part_sku}/${s.warehouse_id}`, s));

    const stockByPart = new Map();
    partStockData.forEach(stock => {
      if (!stockByPart.has(stock.part_sku)) stockByPart.set(stock.part_sku, {});
      stockByPart.get(stock.part_sku)[stock.warehouse_id] = stock.quantity;
    });

    // Safe stock upsert: update if exists, create if not
    async function upsertStock(sku, warehouseId, quantity) {
      const key = `${sku}/${warehouseId}`;
      const existing = stockLookup.get(key);
      if (existing) {
        if (existing.quantity !== quantity) {
          await apiCallWithRetry(() => base44.asServiceRole.entities.PartStock.update(existing.id, { quantity }));
        }
      } else {
        const created = await apiCallWithRetry(() => base44.asServiceRole.entities.PartStock.create({ part_sku: sku, warehouse_id: warehouseId, quantity }));
        stockLookup.set(key, created);
      }
    }

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

    async function resolveCategoryCode(code) {
      if (!code) return allCategories.length > 0 ? allCategories[0].code : 'other';
      if (categoryMap.has(code)) return code;
      const byName = categoryNameMap.get(code);
      if (byName) return byName.code;
      try {
        const created = await apiCallWithRetry(() => base44.asServiceRole.entities.Category.create({ code, name: code, color: 'bg-gray-100 text-gray-800' }));
        categoryMap.set(code, created);
        return code;
      } catch { return allCategories.length > 0 ? allCategories[0].code : 'other'; }
    }

    async function resolveUnitCode(code) {
      if (!code) return allUnits.length > 0 ? allUnits[0].code : 'pieces';
      if (unitMap.has(code)) return code;
      const byName = unitNameMap.get(code);
      if (byName) return byName.code;
      try {
        const created = await apiCallWithRetry(() => base44.asServiceRole.entities.Unit.create({ code, name: code, type: 'quantity', is_active: true }));
        unitMap.set(code, created);
        return code;
      } catch { return allUnits.length > 0 ? allUnits[0].code : 'pieces'; }
    }

    // Build SKU -> row index map
    const skuToRowIndex = new Map();
    parsedData.forEach((row, index) => {
      const sku = row[skuFileColumnIndex];
      if (sku) skuToRowIndex.set(String(sku).trim(), index);
    });

    addLog(`נמצאו ${skuToRowIndex.size} מק"טים בקובץ`, 'info');

    const coreFields = ['name', 'category', 'unit', 'minimum_stock', 'notes', 'current_location', 'replaced_sku', 'requires_serial_number', 'last_count_date'];
    const pricingFields = ['cost_price', 'cost_currency', 'sale_currency', 'import_percentage', 'markup_percentage', 'manual_sale_price', 'is_manual'];
    const numericCoreFields = ['minimum_stock'];
    const numericPricingFields = ['cost_price', 'import_percentage', 'markup_percentage', 'manual_sale_price'];
    const supplierFields = ['supplier_number', 'supplier_part_number'];

    // Parse numeric value: empty/null → 0, round to 2 decimal places
    const parseNum = (val) => Math.round((parseFloat(val) || 0) * 100) / 100;
    const mappedFieldKeys = new Set(sortedFieldMapping.map(f => f.key));

    addLog(`מנתח ${selectedChanges.length} שינויים נבחרים...`, 'info');

    const changesToProcess = [];
    for (const selectedSku of selectedChanges) {
      const skuStr = String(selectedSku).trim();
      const rowIndex = skuToRowIndex.get(skuStr);
      if (rowIndex === undefined) {
        addLog(`לא נמצאה שורה עבור מק"ט ${selectedSku}`, 'warn');
        continue;
      }

      const rowValues = parsedData[rowIndex];
      const formattedRow = {};
      sortedFieldMapping.forEach((field) => {
        const colIndex = (field.column || 1) - 1;
        let value = rowValues[colIndex];
        if (value === null || value === undefined || value === '') value = null;
        else if (typeof value === 'string') { value = value.trim(); if (value === '') value = null; }
        formattedRow[field.key] = value;
      });

      if (!formattedRow.sku) continue;

      if (formattedRow.category) {
        const catSettings = categoryMap.get(formattedRow.category) || allCategories.find(c => c.name === formattedRow.category);
        if (catSettings) {
          if (!formattedRow.supplier_number && catSettings.supplier_number) formattedRow.supplier_number = catSettings.supplier_number;
          if (!formattedRow.cost_currency && catSettings.cost_currency) formattedRow.cost_currency = catSettings.cost_currency;
          if (!formattedRow.sale_currency && catSettings.sale_currency) formattedRow.sale_currency = catSettings.sale_currency;
          if (formattedRow.import_percentage == null) formattedRow.import_percentage = catSettings.import_percentage;
          if (formattedRow.markup_percentage == null) formattedRow.markup_percentage = catSettings.margin_percentage;
        }
      }

      const existingPart = partMap.get(String(formattedRow.sku).trim());
      changesToProcess.push({ type: existingPart ? 'update' : 'new', newData: formattedRow, existingPart });
    }

    addLog(`נמצאו ${changesToProcess.length} שינויים לעיבוד`, 'success');

    let createdCount = 0;
    let updatedCount = 0;
    let errorCount = 0;
    const failedSkus = [];

    // ─── Process CREATE ────────────────────────────────────────────────────────
    const newItems = changesToProcess.filter(c => c.type === 'new');
    if (newItems.length > 0) {
      addLog(`יוצר ${newItems.length} פריטים חדשים (${CONCURRENCY} במקביל)...`, 'info');
      await processWithConcurrency(newItems, CONCURRENCY, async (change) => {
        const f = change.newData;
        const sku = String(f.sku).trim();
        if (!sku || !f.name) throw new Error('חסרים שדות חובה (מק"ט / שם)');

        const [categoryCode, unitCode] = await Promise.all([
          resolveCategoryCode(f.category),
          resolveUnitCode(f.unit)
        ]);

        // Phase 1: Create core
        await apiCallWithRetry(() => base44.asServiceRole.entities.PartCore.create({
          sku, name: String(f.name).trim(), category: categoryCode, unit: unitCode,
          minimum_stock: parseFloat(f.minimum_stock) || 0, notes: f.notes || '',
          current_location: f.current_location || '', replaced_sku: f.replaced_sku || '',
          requires_serial_number: f.requires_serial_number || false,
        }));

        // Phase 2: Create pricing, supplier, stock - all in parallel
        await Promise.all([
          apiCallWithRetry(() => base44.asServiceRole.entities.PartPricing.create({
            part_sku: sku,
            cost_price: parseNum(f.cost_price),
            cost_currency: f.cost_currency || 'ILS',
            sale_currency: f.sale_currency || 'ILS',
            import_percentage: parseNum(f.import_percentage),
            markup_percentage: parseNum(f.markup_percentage),
            manual_sale_price: parseNum(f.manual_sale_price),
            is_manual: !!(f.manual_sale_price),
          })),
          apiCallWithRetry(() => base44.asServiceRole.entities.PartSupplier.create({
            part_sku: sku, supplier_number: f.supplier_number || '', supplier_part_number: f.supplier_part_number || '',
          })),
          ...allWarehouses.map(wh => upsertStock(sku, wh.warehouse_id, parseNum(f[wh.warehouse_id])))
        ]);
      }, (done, total, result) => {
        if (!result.success) {
          errorCount++;
          const failedSku = result.item?.newData?.sku;
          if (failedSku) failedSkus.push(failedSku);
          addLog(`שגיאה ביצירת מק"ט ${failedSku}: ${result.error}`, 'error');
        } else {
          createdCount++;
        }
        if (done % UPDATE_BATCH_SIZE === 0) addLog(`יצירה: ${done}/${total}`, 'info');
      });
    }

    // ─── Process UPDATE ────────────────────────────────────────────────────────
    const itemsToUpdate = changesToProcess.filter(c => c.type === 'update');
    if (itemsToUpdate.length > 0) {
      addLog(`מעדכן ${itemsToUpdate.length} פריטים קיימים (${CONCURRENCY} במקביל)...`, 'info');
      await processWithConcurrency(itemsToUpdate, CONCURRENCY, async (change) => {
        const f = change.newData;
        const existingPart = change.existingPart;
        const sku = existingPart.sku;

        const coreUpdate = {};
        for (const field of coreFields) {
          if (!mappedFieldKeys.has(field)) continue; // only process mapped fields
          const isMapped = f[field] != null && f[field] !== '';
          if (numericCoreFields.includes(field)) {
            const newValue = parseNum(isMapped ? f[field] : 0);
            const existingValue = parseNum(existingPart[field]);
            if (existingValue !== newValue) coreUpdate[field] = newValue;
          } else if (isMapped) {
            const existingValue = existingPart[field] || '';
            if (String(existingValue) !== String(f[field])) coreUpdate[field] = f[field];
          }
        }

        const pricingUpdate = {};
        for (const field of pricingFields) {
          if (!mappedFieldKeys.has(field)) continue; // only process mapped fields
          const isMapped = f[field] != null && f[field] !== '';
          if (numericPricingFields.includes(field)) {
            const newValue = parseNum(isMapped ? f[field] : 0);
            const existingValue = parseNum(existingPart[field]);
            if (existingValue !== newValue) pricingUpdate[field] = newValue;
          } else if (isMapped) {
            const existingValue = existingPart[field] || '';
            if (String(existingValue) !== String(f[field])) pricingUpdate[field] = f[field];
          }
        }
        if (f.manual_sale_price != null && f.manual_sale_price !== '') pricingUpdate.is_manual = true;

        const supplierUpdate = {};
        for (const field of supplierFields) {
          if (f[field] != null && f[field] !== '') {
            if (String(existingPart[field] || '') !== String(f[field])) supplierUpdate[field] = f[field];
          }
        }

        // Build stock updates list using safe upsert (prevents duplicates)
        const stockOps = allWarehouses.map(wh => {
          if (!mappedFieldKeys.has(wh.warehouse_id)) return null; // skip unmapped warehouses
          const newQty = parseNum(f[wh.warehouse_id]); // empty → 0
          return upsertStock(sku, wh.warehouse_id, newQty);
        }).filter(Boolean);

        // All updates in parallel
        const pricingRecord = pricingMap.get(sku);
        const supplierRecord = supplierMap.get(sku);

        await Promise.all([
          Object.keys(coreUpdate).length > 0
            ? apiCallWithRetry(() => base44.asServiceRole.entities.PartCore.update(existingPart.id, coreUpdate))
            : null,
          Object.keys(pricingUpdate).length > 0
            ? (pricingRecord
              ? apiCallWithRetry(() => base44.asServiceRole.entities.PartPricing.update(pricingRecord.id, pricingUpdate))
              : apiCallWithRetry(() => base44.asServiceRole.entities.PartPricing.create({ part_sku: sku, ...pricingUpdate })))
            : null,
          Object.keys(supplierUpdate).length > 0
            ? (supplierRecord
              ? apiCallWithRetry(() => base44.asServiceRole.entities.PartSupplier.update(supplierRecord.id, supplierUpdate))
              : apiCallWithRetry(() => base44.asServiceRole.entities.PartSupplier.create({ part_sku: sku, ...supplierUpdate })))
            : null,
          ...stockOps
        ].filter(Boolean));

      }, (done, total, result) => {
        if (!result.success) {
          errorCount++;
          const failedSku = result.item?.newData?.sku || result.item?.existingPart?.sku;
          if (failedSku) failedSkus.push(failedSku);
          addLog(`שגיאה בעדכון מק"ט ${failedSku}: ${result.error}`, 'error');
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

    return Response.json({
      success: true,
      stats: { created: createdCount, updated: updatedCount, errors: errorCount, total: changesToProcess.length },
      failed_skus: failedSkus,
      logs
    });

  } catch (error) {
    console.error('Import failed:', error);
    return Response.json({
      success: false,
      error: error.message,
      failed_skus: [],
      logs: [{ message: `הייבוא נכשל: ${error.message}`, type: 'error', timestamp: new Date().toISOString() }]
    }, { status: 500 });
  }
});