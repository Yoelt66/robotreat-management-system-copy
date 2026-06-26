import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }
        
        if (user.role !== 'admin') {
            return Response.json({ error: 'Admin access required' }, { status: 403 });
        }

        const partData = await req.json();
        const { sku } = partData;

        if (!sku) {
            return Response.json({ error: 'SKU is required' }, { status: 400 });
        }

        // Check if part with this SKU already exists
        const existingParts = await base44.asServiceRole.entities.PartCore.filter({ sku });
        if (existingParts && existingParts.length > 0) {
            return Response.json({ error: 'פריט עם מק״ט זה כבר קיים' }, { status: 400 });
        }

        const createdEntities = {
            core: null,
            pricing: null,
            supplier: null,
            stocks: []
        };

        try {
            // Step 1: Create PartCore
            const coreData = {
                sku: partData.sku,
                name: partData.name,
                category: partData.category,
                unit: partData.unit,
                minimum_stock: partData.minimum_stock || 0,
                notes: partData.notes || '',
                replaced_sku: partData.replaced_sku || '',
                requires_serial_number: partData.requires_serial_number || false,
                last_count_date: partData.last_count_date || null
            };
            
            createdEntities.core = await base44.asServiceRole.entities.PartCore.create(coreData);

            // Step 2: Create PartPricing
            const pricingData = {
                part_sku: sku,
                cost_price: partData.cost_price !== undefined ? partData.cost_price : 0,
                cost_currency: partData.cost_currency || 'ILS',
                sale_currency: partData.sale_currency || 'ILS',
                import_percentage: partData.import_percentage !== undefined ? partData.import_percentage : 0,
                markup_percentage: partData.markup_percentage !== undefined ? partData.markup_percentage : 0,
                manual_sale_price: partData.manual_sale_price || 0,
                is_manual: partData.is_manual || false
            };
            
            createdEntities.pricing = await base44.asServiceRole.entities.PartPricing.create(pricingData);

            // Step 3: Create PartSupplier
            const supplierData = {
                part_sku: sku,
                supplier_number: partData.supplier_number || '',
                supplier_part_number: partData.supplier_part_number || ''
            };
            
            createdEntities.supplier = await base44.asServiceRole.entities.PartSupplier.create(supplierData);

            // Step 4: Create PartStock for each warehouse + log initial transactions
            if (partData.warehouses && Array.isArray(partData.warehouses)) {
                const stocksToCreate = partData.warehouses
                    .filter(wh => wh.warehouse_id)
                    .map(wh => base44.asServiceRole.entities.PartStock.create({
                        part_sku: sku,
                        warehouse_id: wh.warehouse_id,
                        quantity: wh.quantity || 0
                    }));
                createdEntities.stocks = await Promise.all(stocksToCreate);

                // Log initial stock transactions
                const transactionsToLog = createdEntities.stocks
                    .filter(s => s.quantity > 0)
                    .map(s => base44.asServiceRole.entities.StockTransaction.create({
                        part_sku: sku,
                        warehouse_id: s.warehouse_id,
                        transaction_type: 'initial',
                        quantity_delta: s.quantity,
                        quantity_before: 0,
                        quantity_after: s.quantity,
                        reference_type: 'manual',
                        performed_by: user.id,
                        performed_by_name: user.full_name || ''
                    }));
                await Promise.all(transactionsToLog);
            }

            // Step 5: Log initial price if cost_price was provided
            if (partData.cost_price && parseFloat(partData.cost_price) > 0) {
                try {
                    await base44.asServiceRole.entities.PartPriceLog.create({
                        part_sku: sku,
                        changed_by: user.id,
                        changed_by_name: user.full_name || '',
                        old_cost_price: 0,
                        new_cost_price: parseFloat(partData.cost_price),
                        old_cost_currency: '',
                        new_cost_currency: partData.cost_currency || 'ILS',
                        old_manual_sale_price: 0,
                        new_manual_sale_price: partData.manual_sale_price || 0,
                        old_markup_percentage: 0,
                        new_markup_percentage: partData.markup_percentage || 0,
                        old_import_percentage: 0,
                        new_import_percentage: partData.import_percentage || 0,
                        change_reason: 'יצירת פריט חדש'
                    });
                } catch (logErr) {
                    console.error('Failed to write initial price log:', logErr);
                }
            }

            return Response.json({ 
                success: true, 
                message: 'פריט נוצר בהצלחה',
                data: createdEntities 
            });

        } catch (createError) {
            // Rollback: Delete any entities that were created
            console.error('Error during creation, rolling back:', createError);
            
            if (createdEntities.stocks.length > 0) {
                for (const stock of createdEntities.stocks) {
                    try {
                        await base44.asServiceRole.entities.PartStock.delete(stock.id);
                    } catch (e) { console.error('Rollback error (stock):', e); }
                }
            }
            
            if (createdEntities.supplier) {
                try {
                    await base44.asServiceRole.entities.PartSupplier.delete(createdEntities.supplier.id);
                } catch (e) { console.error('Rollback error (supplier):', e); }
            }
            
            if (createdEntities.pricing) {
                try {
                    await base44.asServiceRole.entities.PartPricing.delete(createdEntities.pricing.id);
                } catch (e) { console.error('Rollback error (pricing):', e); }
            }
            
            if (createdEntities.core) {
                try {
                    await base44.asServiceRole.entities.PartCore.delete(createdEntities.core.id);
                } catch (e) { console.error('Rollback error (core):', e); }
            }
            
            throw createError;
        }

    } catch (error) {
        console.error('Create part error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});