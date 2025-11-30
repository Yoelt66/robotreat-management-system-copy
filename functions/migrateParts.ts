import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Unauthorized - Admin only' }, { status: 401 });
        }

        // Fetch all old Part records
        const oldParts = await base44.asServiceRole.entities.Part.list();
        console.log(`Found ${oldParts.length} parts to migrate`);

        // Get warehouses for stock migration
        const warehouses = await base44.asServiceRole.entities.Warehouse.list();
        const warehouseIds = warehouses.map(w => w.warehouse_id);
        console.log(`Found ${warehouses.length} warehouses:`, warehouseIds);

        let migrated = 0;
        let skipped = 0;
        let errors = [];

        for (const part of oldParts) {
            try {
                const sku = part.sku;
                if (!sku) {
                    skipped++;
                    continue;
                }

                // Check if already migrated (PartCore exists with this SKU)
                let existingCores = [];
                try {
                    existingCores = await base44.asServiceRole.entities.PartCore.filter({ sku: sku });
                } catch (filterErr) {
                    // Filter might fail if no records exist yet, that's ok
                    existingCores = [];
                }
                if (existingCores && existingCores.length > 0) {
                    console.log(`Skipping ${sku} - already exists`);
                    skipped++;
                    continue;
                }

                // Create PartCore
                await base44.asServiceRole.entities.PartCore.create({
                    sku: sku,
                    name: part.name || '',
                    category: part.category || '',
                    unit: part.unit || 'pieces',
                    minimum_stock: part.minimum_stock || 0,
                    notes: part.notes || '',
                    replaced_sku: part.replaced_sku || '',
                    current_location: part.current_location || '',
                    requires_serial_number: part.requires_serial_number || false,
                    last_count_date: part.last_count_date || null
                });

                // Create PartPricing
                await base44.asServiceRole.entities.PartPricing.create({
                    part_sku: sku,
                    cost_price: part.cost_price || 0,
                    cost_currency: part.cost_currency || 'ILS',
                    sale_currency: part.sale_currency || 'ILS',
                    import_percentage: part.import_percentage || 15,
                    markup_percentage: part.markup_percentage || 30,
                    manual_sale_price: part.manual_sale_price || 0,
                    is_manual: part.is_manual || false
                });

                // Create PartSupplier
                await base44.asServiceRole.entities.PartSupplier.create({
                    part_sku: sku,
                    supplier_number: part.supplier_number || '',
                    supplier_part_number: part.supplier_part_number || ''
                });

                // Create PartStock for each warehouse with stock
                for (const whId of warehouseIds) {
                    const qty = part[whId] || 0;
                    if (qty !== 0) {
                        await base44.asServiceRole.entities.PartStock.create({
                            part_sku: sku,
                            warehouse_id: whId,
                            quantity: qty
                        });
                    }
                }

                migrated++;
                console.log(`Migrated ${sku} (${migrated}/${oldParts.length})`);

            } catch (partError) {
                console.error(`Error migrating part ${part.sku}:`, partError);
                errors.push({ sku: part.sku, error: partError.message });
            }
        }

        return Response.json({ 
            success: true, 
            message: `Migration complete`,
            stats: {
                total: oldParts.length,
                migrated: migrated,
                skipped: skipped,
                errors: errors.length
            },
            errors: errors.slice(0, 10) // Only show first 10 errors
        });

    } catch (error) {
        console.error('Migration error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});