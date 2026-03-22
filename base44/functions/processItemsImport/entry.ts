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

    const [clientsData, devicesData] = await Promise.all([
      apiCallWithRetry(() => base44.asServiceRole.entities.Client.list()).catch(() => []),
      apiCallWithRetry(() => base44.asServiceRole.entities.Device.list()).catch(() => [])
    ]);

    // Build client name -> row index map
    const clientNameToRowIndex = new Map();
    parsedData.forEach((row, index) => {
      const clientName = row[clientNameFileColumnIndex];
      if (clientName) clientNameToRowIndex.set(String(clientName).trim().toLowerCase(), index);
    });

    addLog(`נמצאו ${clientNameToRowIndex.size} לקוחות בקובץ`, 'info');

    const clientMap = new Map(clientsData.map(c => [c.name.toLowerCase(), c]));
    addLog(`נטענו ${clientsData.length} לקוחות קיימים`, 'info');

    const deviceFields = ['name', 'type', 'serial_number', 'location'];
    const mappedFieldKeys = new Set(sortedFieldMapping.map(f => f.key));

    addLog(`מנתח ${selectedChanges.length} שינויים נבחרים...`, 'info');

    const changesToProcess = [];
    for (let i = 0; i < selectedChanges.length; i++) {
      const selectedClientName = selectedChanges[i];
      const clientNameStr = String(selectedClientName).trim().toLowerCase();
      const rowIndex = clientNameToRowIndex.get(clientNameStr);
      if (rowIndex === undefined) {
        addLog(`שורה ${rowIndex + 2}: לא נמצאה שורה עבור לקוח ${selectedClientName}`, 'warn');
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

      if (!formattedRow.client_name) continue;

      const existingClient = clientMap.get(formattedRow.client_name.toLowerCase());
      changesToProcess.push({ type: existingClient ? 'update' : 'new', newData: formattedRow, existingClient });
    }

    addLog(`נמצאו ${changesToProcess.length} שינויים לעיבוד`, 'success');

    let createdCount = 0;
    let updatedCount = 0;
    let errorCount = 0;
    const failedSkus = [];

    // ─── Process CREATE ────────────────────────────────────────────────────────
    const newItems = changesToProcess.filter(c => c.type === 'new');
    if (newItems.length > 0) {
      addLog(`יוצר ${newItems.length} לקוחות חדשים (${CONCURRENCY} במקביל)...`, 'info');
      await processWithConcurrency(newItems, CONCURRENCY, async (change) => {
        const f = change.newData;
        const clientName = String(f.client_name).trim();
        if (!clientName) throw new Error('חסרים שדות חובה (שם לקוח)');

        // Create client
        const newClient = await apiCallWithRetry(() => base44.asServiceRole.entities.Client.create({
          name: clientName,
          phone: '',
          email: '',
          address: '',
          company: '',
          notes: ''
        }));

        // Create device if device fields are provided
        if (f.name) {
          await apiCallWithRetry(() => base44.asServiceRole.entities.Device.create({
            client_id: newClient.id,
            name: f.name,
            type: f.type || 'other',
            serial_number: f.serial_number || '',
            location: f.location || ''
          }));
        }
      }, (done, total, result) => {
        if (!result.success) {
          errorCount++;
          const failedName = result.item?.newData?.client_name;
          if (failedName) failedSkus.push(failedName);
          addLog(`שגיאה ביצירת לקוח ${failedName}: ${result.error}`, 'error');
        } else {
          createdCount++;
        }
        if (done % UPDATE_BATCH_SIZE === 0) addLog(`יצירה: ${done}/${total}`, 'info');
      });
    }

    // ─── Process UPDATE ────────────────────────────────────────────────────────
    const itemsToUpdate = changesToProcess.filter(c => c.type === 'update');
    if (itemsToUpdate.length > 0) {
      addLog(`מעדכן ${itemsToUpdate.length} לקוחות קיימים (${CONCURRENCY} במקביל)...`, 'info');
      await processWithConcurrency(itemsToUpdate, CONCURRENCY, async (change) => {
        const f = change.newData;
        const existingClient = change.existingClient;

        // Create device if device fields are provided
        if (f.name) {
          await apiCallWithRetry(() => base44.asServiceRole.entities.Device.create({
            client_id: existingClient.id,
            name: f.name,
            type: f.type || 'other',
            serial_number: f.serial_number || '',
            location: f.location || ''
          }));
        }
      }, (done, total, result) => {
        if (!result.success) {
          errorCount++;
          const failedName = result.item?.newData?.client_name;
          if (failedName) failedSkus.push(failedName);
          addLog(`שגיאה בעדכון לקוח ${failedName}: ${result.error}`, 'error');
        } else {
          updatedCount++;
        }
        if (done % UPDATE_BATCH_SIZE === 0) addLog(`עדכון: ${done}/${total}`, 'info');
      });
    }

    addLog('=== סיכום ייבוא ===', 'success');
    addLog(`לקוחות חדשים שנוצרו: ${createdCount}`, 'success');
    addLog(`מכשירים שנוצרו עבור לקוחות קיימים: ${updatedCount}`, 'success');
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