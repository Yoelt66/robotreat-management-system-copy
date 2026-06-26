import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Normalizes a supplier name string for matching:
 * - Lowercase
 * - Trim whitespace
 * - Remove common business suffixes (בע"מ, Ltd, Inc, בעמ, etc.)
 * - Collapse multiple spaces
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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { year } = body;

    // Fetch suppliers and invoices in parallel
    const [suppliers, allInvoices] = await Promise.all([
      base44.entities.Supplier.list(),
      base44.entities.Invoice.list('-invoice_date', 5000),
    ]);

    // Filter invoices by year if provided
    const invoices = year
      ? allInvoices.filter((inv) => {
          if (!inv.invoice_date) return false;
          return new Date(inv.invoice_date).getFullYear() === parseInt(year);
        })
      : allInvoices;

    // Build alias → supplier_number dictionary
    // Key: normalized alias, Value: supplier_number
    const aliasMap = {};
    for (const supplier of suppliers) {
      // The supplier's own name is also an alias
      const ownNorm = normalizeName(supplier.name);
      if (ownNorm) aliasMap[ownNorm] = supplier.supplier_number;

      for (const alias of (supplier.aliases || [])) {
        const norm = normalizeName(alias);
        if (norm) aliasMap[norm] = supplier.supplier_number;
      }
    }

    // Build a map from supplier_number → supplier record
    const supplierByNumber = {};
    for (const s of suppliers) {
      supplierByNumber[s.supplier_number] = s;
    }

    // Aggregate invoices per resolved supplier
    // invoiceNameToNumber: invoice supplier_name → resolved supplier_number (or null if unknown)
    const stats = {}; // keyed by resolvedKey (supplier_number or raw name)

    for (const inv of invoices) {
      const rawName = inv.supplier_name || '';
      const norm = normalizeName(rawName);

      // Try to resolve via supplier_number on invoice first, then alias map
      let resolvedNumber = inv.supplier_number || aliasMap[norm] || null;
      let resolvedName = rawName;
      let isMatched = false;

      if (resolvedNumber && supplierByNumber[resolvedNumber]) {
        resolvedName = supplierByNumber[resolvedNumber].name;
        isMatched = true;
      } else {
        // Try alias map on raw name
        const mappedNumber = aliasMap[norm];
        if (mappedNumber && supplierByNumber[mappedNumber]) {
          resolvedNumber = mappedNumber;
          resolvedName = supplierByNumber[mappedNumber].name;
          isMatched = true;
        }
      }

      const key = resolvedNumber || rawName;

      if (!stats[key]) {
        stats[key] = {
          supplier_number: resolvedNumber,
          supplier_name: resolvedName,
          invoice_display_name: rawName,
          is_matched: isMatched,
          // balances: { ILS: { open: 0, paid: 0, open_count: 0, paid_count: 0 }, USD: {...}, ... }
          balances: {},
          open_count: 0,
          paid_count: 0,
          latest_invoice_date: null,
        };
      }

      const amount = inv.amount || 0;
      const currency = inv.currency || 'ILS';

      if (!stats[key].balances[currency]) {
        stats[key].balances[currency] = { open: 0, paid: 0, open_count: 0, paid_count: 0 };
      }

      if (inv.status === 'open') {
        stats[key].balances[currency].open += amount;
        stats[key].balances[currency].open_count += 1;
        stats[key].open_count += 1;
      } else {
        stats[key].balances[currency].paid += amount;
        stats[key].balances[currency].paid_count += 1;
        stats[key].paid_count += 1;
      }

      if (!stats[key].latest_invoice_date || inv.invoice_date > stats[key].latest_invoice_date) {
        stats[key].latest_invoice_date = inv.invoice_date;
      }
    }

    // Convert to array and sort:
    // 1. Suppliers with open invoices first (sorted by open amount desc)
    // 2. Then suppliers with only paid invoices (sorted by latest_invoice_date desc)
    const result = Object.values(stats).sort((a, b) => {
      if (a.open_count > 0 && b.open_count === 0) return -1;
      if (a.open_count === 0 && b.open_count > 0) return 1;
      if (a.open_count > 0 && b.open_count > 0) {
        // Sort by total open across all currencies (ILS as primary comparison)
        const aOpen = Object.values(a.balances).reduce((s, bal) => s + bal.open, 0);
        const bOpen = Object.values(b.balances).reduce((s, bal) => s + bal.open, 0);
        return bOpen - aOpen;
      }
      // Both have no open invoices - sort by latest date
      if (a.latest_invoice_date && b.latest_invoice_date) {
        return b.latest_invoice_date.localeCompare(a.latest_invoice_date);
      }
      return 0;
    });

    // Also return list of unique invoice names not matched to any supplier (for alias management UI)
    const unmatchedNames = [
      ...new Set(
        invoices
          .filter((inv) => {
            const norm = normalizeName(inv.supplier_name || '');
            const resolvedByNumber = inv.supplier_number && supplierByNumber[inv.supplier_number];
            const resolvedByAlias = aliasMap[norm] && supplierByNumber[aliasMap[norm]];
            return !resolvedByNumber && !resolvedByAlias;
          })
          .map((inv) => inv.supplier_name)
          .filter(Boolean)
      ),
    ];

    return Response.json({ stats: result, unmatched_names: unmatchedNames });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});