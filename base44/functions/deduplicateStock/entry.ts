import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Paginate to get ALL PartStock records (1000 per page with delays)
    const allStock = [];
    const pageSize = 2000;
    let skip = 0;
    while (true) {
      const page = await base44.asServiceRole.entities.PartStock.list(undefined, pageSize, skip);
      if (!page || page.length === 0) break;
      allStock.push(...page);
      if (page.length < pageSize) break;
      skip += pageSize;
      await sleep(300);
    }

    // Group by "part_sku/warehouse_id"
    const groups = new Map();
    for (const s of allStock) {
      const key = `${s.part_sku}/${s.warehouse_id}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(s);
    }

    // Collect all duplicates to delete
    const toDeleteAll = [];
    const details = [];

    for (const [key, records] of groups) {
      if (records.length > 1) {
        records.sort((a, b) => (b.quantity || 0) - (a.quantity || 0));
        const winner = records[0];
        const toDelete = records.slice(1);
        toDeleteAll.push(...toDelete);
        details.push({ key, kept_quantity: winner.quantity, deleted_count: toDelete.length });
      }
    }

    // Delete one-by-one with 300ms delay to avoid rate limit
    let deletedCount = 0;
    for (const dup of toDeleteAll) {
      await base44.asServiceRole.entities.PartStock.delete(dup.id);
      deletedCount++;
      await sleep(300);
    }

    return Response.json({
      success: true,
      total_records: allStock.length,
      duplicates_found: details.length,
      records_deleted: deletedCount,
      details
    });

  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});