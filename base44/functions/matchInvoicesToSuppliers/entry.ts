import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Normalizes a supplier name string for matching:
 * - Lowercase, trim, remove common business suffixes, collapse spaces
 */
function normalizeName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .trim()
    .replace(/בע"מ|בעמ|בע מ|ltd\.?|inc\.?|gmbh|co\.|s\.a\.|llc\.?/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Retroactively matches invoices to supplier_number using the alias dictionary.
 * Only updates invoices that are missing supplier_number or have a stale/incorrect one.
 * Returns a summary of how many were updated and how many remain unmatched.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    // Fetch all suppliers and all invoices (paginate in batches of 500 to avoid memory issues)
    const [suppliers, invoices] = await Promise.all([
      base44.entities.Supplier.list(),
      base44.entities.Invoice.list('-invoice_date', 5000),
    ]);

    // Build alias → supplier record map (normalized alias key)
    const aliasMap = {}; // normalized string → Supplier record
    for (const supplier of suppliers) {
      if (!supplier.supplier_number) continue;

      const ownNorm = normalizeName(supplier.name);
      if (ownNorm) aliasMap[ownNorm] = supplier;

      for (const alias of (supplier.aliases || [])) {
        const norm = normalizeName(alias);
        if (norm) aliasMap[norm] = supplier;
      }
    }

    // Build supplier_number → Supplier record map for validating existing assignments
    const supplierByNumber = {};
    for (const s of suppliers) {
      if (s.supplier_number) supplierByNumber[s.supplier_number] = s;
    }

    const updates = [];
    const unmatched = [];

    for (const inv of invoices) {
      const rawName = inv.supplier_name || '';
      const norm = normalizeName(rawName);

      // Check if already correctly assigned
      if (inv.supplier_number && supplierByNumber[inv.supplier_number]) {
        // Existing assignment is valid — skip (don't overwrite manual corrections)
        continue;
      }

      // Try to resolve via alias map
      const matchedSupplier = aliasMap[norm];

      if (matchedSupplier) {
        // Only update if something changed
        if (inv.supplier_number !== matchedSupplier.supplier_number) {
          updates.push({
            id: inv.id,
            supplier_number: matchedSupplier.supplier_number,
            // Keep supplier_name as-is on the invoice (display as it appeared on the original document)
          });
        }
      } else {
        unmatched.push(rawName);
      }
    }

    // Apply updates in batches of 50 to avoid rate-limiting
    let updated = 0;
    for (let i = 0; i < updates.length; i += 50) {
      const batch = updates.slice(i, i + 50);
      await Promise.all(
        batch.map((u) =>
          base44.entities.Invoice.update(u.id, { supplier_number: u.supplier_number })
        )
      );
      updated += batch.length;
    }

    const uniqueUnmatched = [...new Set(unmatched)];

    return Response.json({
      success: true,
      updated_count: updated,
      skipped_count: invoices.length - updates.length - uniqueUnmatched.length,
      unmatched_names: uniqueUnmatched,
      unmatched_count: uniqueUnmatched.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});