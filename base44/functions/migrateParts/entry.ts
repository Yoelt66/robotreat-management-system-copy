import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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

        // Get existing PartCore records to check for duplicates
        let existingCores = [];
        try {
            existingCores = await base44.asServiceRole.entities.PartCore.list();
        } catch (e) {
            existingCores = [];
        }
        const existingSkus = new Set(existingCores.map(c => c.sku));

        let migrated = 0;
        let skipped = 0;
        let errors = [];

        // Process in smaller batches with delays
        const BATCH_SIZE = 5;
        const DELAY_BETWEEN_PARTS = 200;
        const DELAY_BETWEEN_BATCHES = 1000;

        for (let i = 0; i < oldParts.length; i++) {
            const part = oldParts[i];
            
            try {
                const sku = part.sku;
                if (!sku) {
                    skipped++;
                    continue;
                }

                // Check if already migrated
                if (existingSkus.has(sku)) {
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
                await sleep(100);

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
                await sleep(100);

                // Create PartSupplier
                await base44.asServiceRole.entities.PartSupplier.create({
                    part_sku: sku,
                    supplier_number: part.supplier_number || '',
                    supplier_part_number: part.supplier_part_number || ''
                });
                await sleep(100);

                // Create PartStock for each warehouse with stock
                for (const whId of warehouseIds) {
                    const qty = part[whId] || 0;
                    if (qty !== 0) {
                        await base44.asServiceRole.entities.PartStock.create({
                            part_sku: sku,
                            warehouse_id: whId,
                            quantity: qty
                        });
                        await sleep(50);
                    }
                }

                migrated++;
                existingSkus.add(sku); // Mark as migrated
                console.log(`Migrated ${sku} (${migrated}/${oldParts.length})`);

                // Delay between parts
                await sleep(DELAY_BETWEEN_PARTS);

                // Extra delay between batches
                if ((i + 1) % BATCH_SIZE === 0) {
                    console.log(`Batch ${Math.floor(i / BATCH_SIZE) + 1} complete, pausing...`);
                    await sleep(DELAY_BETWEEN_BATCHES);
                }

            } catch (partError) {
                console.error(`Error migrating part ${part.sku}:`, partError);
                errors.push({ sku: part.sku, error: partError.message });
                await sleep(500); // Extra delay after error
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
            errors: errors.slice(0, 10)
        });

    } catch (error) {
        console.error('Migration error:', error);
        return Response.json({ 
            success: false, 
            error: error.message,
            stack: error.stack 
        }, { status: 200 });
    }
});