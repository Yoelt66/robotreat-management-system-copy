import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * onServiceUnitChange
 *
 * מופעל כאשר ServiceUnit נוצרת, מתעדכנת או נמחקת.
 *
 * - עדכון: אם שדות רלוונטיים השתנו → מפעיל calculateFutureSchedule ליחידה זו.
 * - מחיקה: מעדכן PredictedMaintenanceEvent קשורים ל-service_unit_status='deleted' + status='cancelled'.
 * - שינוי active=false: מבטל אירועים עתידיים ומסמן אותם כ-archived.
 */

const TRIGGER_FIELDS = [
  'visit_sequence', 'visit_interval_months', 'last_visit_date',
  'current_visit_step', 'installation_date', 'brand_id', 'type', 'active'
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { event, data, old_data, changed_fields } = body;

    if (!event || !data) return Response.json({ ok: true, skipped: 'no event/data' });

    const unitId = event.entity_id;

    // --- מחיקה ---
    if (event.type === 'delete') {
      const existingEvents = await base44.asServiceRole.entities.PredictedMaintenanceEvent.filter({
        service_unit_id: unitId,
        status: 'planned',
      });
      for (const e of existingEvents) {
        await base44.asServiceRole.entities.PredictedMaintenanceEvent.update(e.id, {
          status: 'cancelled',
          service_unit_status: 'deleted',
        });
      }
      return Response.json({ ok: true, action: 'deleted', cancelled: existingEvents.length });
    }

    // --- השבתה (active → false) ---
    if (changed_fields?.includes('active') && data.active === false) {
      const existingEvents = await base44.asServiceRole.entities.PredictedMaintenanceEvent.filter({
        service_unit_id: unitId,
        status: 'planned',
      });
      for (const e of existingEvents) {
        await base44.asServiceRole.entities.PredictedMaintenanceEvent.update(e.id, {
          status: 'cancelled',
          service_unit_status: 'archived',
        });
      }
      return Response.json({ ok: true, action: 'archived', cancelled: existingEvents.length });
    }

    // --- עדכון שדות רלוונטיים בלבד ---
    const hasRelevantChange = changed_fields?.some(f => TRIGGER_FIELDS.includes(f));
    if (!hasRelevantChange) {
      return Response.json({ ok: true, skipped: 'no relevant field changed' });
    }

    // הפעל חישוב מחדש ליחידה זו
    const res = await base44.asServiceRole.functions.invoke('calculateFutureSchedule', {
      service_unit_id: unitId,
    });

    return Response.json({ ok: true, action: 'recalculated', result: res.data });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});