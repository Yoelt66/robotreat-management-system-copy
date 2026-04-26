import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * calculateFutureSchedule
 *
 * מחשב אירועי תחזוקה עתידיים ל-12 חודשים קדימה.
 *
 * payload:
 *   - service_unit_id (string, optional) — אם מסופק, מחשב רק ליחידה זו.
 *                                           אם לא, מחשב לכל היחידות הפעילות.
 *
 * לוגיקת ה-diff:
 *   - משווה אירועים חזויים קיימים (planned) מול מה שצריך להיות.
 *   - יוצר/מעדכן/מבטל בלבד מה שצריך — לא מוחק ומכתב מחדש את הכל.
 *   - מכבד is_manual_override=true — לא דורס תאריכים שהוגדרו ידנית.
 *   - מדלג על יחידות עם active=false.
 *   - מטפל ביחידות עם last_visit_date ריק (מחשב מ-installation_date).
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { service_unit_id } = await req.json().catch(() => ({}));

    // --- 1. טען יחידות שירות ---
    let units;
    if (service_unit_id) {
      const unit = await base44.asServiceRole.entities.ServiceUnit.get(service_unit_id);
      if (!unit) return Response.json({ error: 'ServiceUnit not found' }, { status: 404 });
      units = [unit];
    } else {
      units = await base44.asServiceRole.entities.ServiceUnit.filter({ active: true });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const horizonDate = new Date(today);
    horizonDate.setMonth(horizonDate.getMonth() + 12);

    const stats = { created: 0, updated: 0, cancelled: 0, skipped: 0 };

    for (const unit of units) {
      if (!unit.active) { stats.skipped++; continue; }

      const sequence = unit.visit_sequence || [];
      if (sequence.length === 0) { stats.skipped++; continue; }

      // בסיס לחישוב: last_visit_date אחרת installation_date אחרת היום
      const baseDate = unit.last_visit_date
        ? new Date(unit.last_visit_date)
        : unit.installation_date
          ? new Date(unit.installation_date)
          : new Date(today);

      const currentStep = unit.current_visit_step || 1;
      const totalSteps = sequence.length;

      // --- 2. חשב את כל האירועים הצפויים בטווח ---
      const expectedEvents = []; // { maintenance_type_id, maintenance_type_name, visit_step_number, predicted_date, parts_snapshot }

      let stepIndex = currentStep - 1; // index ב-sequence
      let nextDate = new Date(baseDate);

      // מצא את האינטרוול לשלב הנוכחי
      const getInterval = (idx) => {
        const step = sequence[idx % totalSteps];
        return step?.interval_months || unit.visit_interval_months || 3;
      };

      // קדם את nextDate לשלב הבא הראשון
      nextDate.setMonth(nextDate.getMonth() + getInterval(stepIndex));

      let safety = 0;
      while (nextDate <= horizonDate && safety < 100) {
        safety++;
        const seqStep = sequence[stepIndex % totalSteps];
        if (seqStep && seqStep.maintenance_type_id) {
          // חשב parts_snapshot מה-step_configs של היחידה
          const stepConfigs = seqStep.step_configs || [];
          const parts = [];
          for (const sc of stepConfigs) {
            if (sc.enabled === false) continue;
            const partsToUse = (sc.use_custom_parts && sc.custom_parts?.length > 0)
              ? sc.custom_parts
              : sc.custom_parts || [];
            for (const p of partsToUse) {
              const existing = parts.find(x => x.part_sku === p.part_sku);
              if (existing) existing.quantity += p.quantity || 1;
              else parts.push({ part_sku: p.part_sku, part_name: p.part_name || '', quantity: p.quantity || 1 });
            }
          }

          expectedEvents.push({
            maintenance_type_id: seqStep.maintenance_type_id,
            maintenance_type_name: seqStep.maintenance_type_name || '',
            visit_step_number: (stepIndex % totalSteps) + 1,
            predicted_date: nextDate.toISOString().split('T')[0],
            parts_snapshot: parts,
          });
        }

        stepIndex++;
        nextDate = new Date(nextDate);
        nextDate.setMonth(nextDate.getMonth() + getInterval(stepIndex));
      }

      // --- 3. טען אירועים קיימים ל-12 חודשים קדימה ליחידה זו ---
      const existingEvents = await base44.asServiceRole.entities.PredictedMaintenanceEvent.filter({
        service_unit_id: unit.id,
        status: 'planned',
      });

      // סנן לטווח
      const existingInRange = existingEvents.filter(e => {
        const d = new Date(e.predicted_date);
        return d >= today && d <= horizonDate;
      });

      // --- 4. Diff — מה ליצור, לעדכן, לבטל ---
      const matched = new Set();

      for (const expected of expectedEvents) {
        // חפש אירוע קיים עם אותו maintenance_type_id + visit_step_number
        const existing = existingInRange.find(e =>
          e.maintenance_type_id === expected.maintenance_type_id &&
          e.visit_step_number === expected.visit_step_number &&
          !matched.has(e.id)
        );

        if (existing) {
          matched.add(existing.id);
          // אם manual_override — לא נדרוס את התאריך
          const updatePayload = {
            parts_snapshot: expected.parts_snapshot,
            maintenance_type_name: expected.maintenance_type_name,
            service_unit_status: 'active',
          };
          if (!existing.is_manual_override) {
            updatePayload.predicted_date = expected.predicted_date;
          }
          await base44.asServiceRole.entities.PredictedMaintenanceEvent.update(existing.id, updatePayload);
          stats.updated++;
        } else {
          // צור חדש
          await base44.asServiceRole.entities.PredictedMaintenanceEvent.create({
            service_unit_id: unit.id,
            customer_id: unit.customer_id || '',
            maintenance_type_id: expected.maintenance_type_id,
            maintenance_type_name: expected.maintenance_type_name,
            visit_step_number: expected.visit_step_number,
            predicted_date: expected.predicted_date,
            status: 'planned',
            is_manual_override: false,
            parts_snapshot: expected.parts_snapshot,
            service_unit_status: 'active',
          });
          stats.created++;
        }
      }

      // בטל אירועים קיימים שאינם בטווח הצפוי (ולא manual_override)
      for (const existing of existingInRange) {
        if (!matched.has(existing.id) && !existing.is_manual_override) {
          await base44.asServiceRole.entities.PredictedMaintenanceEvent.update(existing.id, {
            status: 'cancelled',
          });
          stats.cancelled++;
        }
      }
    }

    return Response.json({ success: true, stats, units_processed: units.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});