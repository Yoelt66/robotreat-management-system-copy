import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const maxDeletes = body.max_deletes || 200; // process up to 200 deletions per call

    // Fetch all PartStock records with pagination
    const allStock = [];
    const pageSize = 2000;
    let skip = 0;
    while (true) {
      const page = await base44.asServiceRole.entities.PartStock.list(undefined, pageSize, skip);
      if (!page || page.length === 0) break;
      allStock.push(...page);
      if (page.length < pageSize) break;
      skip += pageSize;
      await sleep(200);
    }

    // Group by "part_sku/warehouse_id"
    const groups = new Map();
    for (const s of allStock) {
      const key = `${s.part_sku}/${s.warehouse_id}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(s);
    }

    // Collect duplicates
    const toDeleteAll = [];
    let duplicateGroups = 0;

    for (const [key, records] of groups) {
      if (records.length > 1) {
        duplicateGroups++;
        records.sort((a, b) => (b.quantity || 0) - (a.quantity || 0));
        toDeleteAll.push(...records.slice(1));
      }
    }

    // Delete up to maxDeletes records, sequential with small delay
    const batch = toDeleteAll.slice(0, maxDeletes);
    let deletedCount = 0;
    let errors = 0;

    for (const dup of batch) {
      try {
        await base44.asServiceRole.entities.PartStock.delete(dup.id);
        deletedCount++;
        await sleep(150);
      } catch {
        errors++;
        await sleep(500); // longer delay on error
      }
    }

    const remaining = toDeleteAll.length - deletedCount;

    return Response.json({
      success: true,
      total_records: allStock.length,
      duplicate_groups: duplicateGroups,
      total_to_delete: toDeleteAll.length,
      deleted_this_run: deletedCount,
      errors,
      remaining_to_delete: remaining,
      done: remaining <= 0
    });

  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});