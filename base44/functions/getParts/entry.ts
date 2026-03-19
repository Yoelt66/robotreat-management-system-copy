import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Fetch all data from split entities in parallel
        const [cores, pricings, suppliers, stocks] = await Promise.all([
            base44.asServiceRole.entities.PartCore.list(),
            base44.asServiceRole.entities.PartPricing.list(),
            base44.asServiceRole.entities.PartSupplier.list(),
            base44.asServiceRole.entities.PartStock.list()
        ]);

        // Create lookup maps for efficient joining
        const pricingMap = new Map();
        for (const p of pricings) {
            pricingMap.set(p.part_sku, p);
        }

        const supplierMap = new Map();
        for (const s of suppliers) {
            supplierMap.set(s.part_sku, s);
        }

        const stockMap = new Map();
        for (const st of stocks) {
            if (!stockMap.has(st.part_sku)) {
                stockMap.set(st.part_sku, {});
            }
            stockMap.get(st.part_sku)[st.warehouse_id] = st.quantity;
        }

        // Combine into unified Part objects
        const parts = cores.map(core => {
            const pricing = pricingMap.get(core.sku) || {};
            const supplier = supplierMap.get(core.sku) || {};
            const warehouseStocks = stockMap.get(core.sku) || {};

            return {
                id: core.id,
                sku: core.sku,
                name: core.name,
                category: core.category,
                unit: core.unit,
                minimum_stock: core.minimum_stock || 0,
                notes: core.notes || '',
                replaced_sku: core.replaced_sku || '',
                current_location: core.current_location || '',
                requires_serial_number: core.requires_serial_number || false,
                last_count_date: core.last_count_date || null,
                created_date: core.created_date,
                updated_date: core.updated_date,
                // Pricing fields
                cost_price: pricing.cost_price !== undefined ? pricing.cost_price : 0,
                cost_currency: pricing.cost_currency || 'ILS',
                sale_currency: pricing.sale_currency || 'ILS',
                import_percentage: pricing.import_percentage !== undefined ? pricing.import_percentage : 0,
                markup_percentage: pricing.markup_percentage !== undefined ? pricing.markup_percentage : 0,
                manual_sale_price: pricing.manual_sale_price || 0,
                is_manual: pricing.is_manual || false,
                // Supplier fields
                supplier_number: supplier.supplier_number || '',
                supplier_part_number: supplier.supplier_part_number || '',
                // Warehouse stock fields (dynamic)
                ...warehouseStocks
            };
        });

        return Response.json({ 
            success: true, 
            data: parts 
        });

    } catch (error) {
        console.error('Get parts error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});