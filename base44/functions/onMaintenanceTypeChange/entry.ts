import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * onMaintenanceTypeChange
 *
 * מופעל כאשר MaintenanceType מתעדכן.
 * מעדכן display-cache (maintenance_type_name) ב-ServiceUnit.visit_sequence
 * רק היכן שה-step לא מסומן כ-manual_override.
 *
 * גם מעדכן maintenance_type_name ב-PredictedMaintenanceEvent הקיימים (planned).
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { event, data, changed_fields } = body;

    if (!data || event?.type === 'delete') return Response.json({ ok: true, skipped: 'delete or no data' });
    if (!changed_fields?.includes('name')) return Response.json({ ok: true, skipped: 'name not changed' });

    const typeId = event.entity_id;
    const newName = data.name;

    // --- עדכן ServiceUnit.visit_sequence (display-cache) ---
    const units = await base44.asServiceRole.entities.ServiceUnit.filter({});
    let unitUpdates = 0;

    for (const unit of units) {
      if (!unit.visit_sequence?.length) continue;

      let changed = false;
      const newSeq = unit.visit_sequence.map(step => {
        if (step.maintenance_type_id !== typeId) return step;
        if (step.manual_override_name) return step; // דגל ידני — לא נדרוס
        changed = true;
        return { ...step, maintenance_type_name: newName };
      });

      if (changed) {
        await base44.asServiceRole.entities.ServiceUnit.update(unit.id, { visit_sequence: newSeq });
        unitUpdates++;
      }
    }

    // --- עדכן PredictedMaintenanceEvent (display-cache) ---
    const events = await base44.asServiceRole.entities.PredictedMaintenanceEvent.filter({
      maintenance_type_id: typeId,
      status: 'planned',
    });

    for (const e of events) {
      await base44.asServiceRole.entities.PredictedMaintenanceEvent.update(e.id, {
        maintenance_type_name: newName,
      });
    }

    return Response.json({
      ok: true,
      unit_updates: unitUpdates,
      event_updates: events.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});