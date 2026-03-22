import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const allStock = await base44.asServiceRole.entities.PartStock.list(undefined, 100000);

    // Group by "part_sku/warehouse_id"
    const groups = new Map();
    for (const s of allStock) {
      const key = `${s.part_sku}/${s.warehouse_id}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(s);
    }

    let deletedCount = 0;
    const details = [];

    for (const [key, records] of groups) {
      if (records.length > 1) {
        // Keep the record with the highest quantity, delete the rest
        records.sort((a, b) => (b.quantity || 0) - (a.quantity || 0));
        const winner = records[0];
        const toDelete = records.slice(1);

        for (const dup of toDelete) {
          await base44.asServiceRole.entities.PartStock.delete(dup.id);
          deletedCount++;
        }

        details.push({
          key,
          kept_id: winner.id,
          kept_quantity: winner.quantity,
          deleted: toDelete.map(d => ({ id: d.id, quantity: d.quantity }))
        });
      }
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