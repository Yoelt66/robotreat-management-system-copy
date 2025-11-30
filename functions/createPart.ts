import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

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
                current_location: partData.current_location || '',
                requires_serial_number: partData.requires_serial_number || false,
                last_count_date: partData.last_count_date || null
            };
            
            createdEntities.core = await base44.asServiceRole.entities.PartCore.create(coreData);

            // Step 2: Create PartPricing
            const pricingData = {
                part_sku: sku,
                cost_price: partData.cost_price || 0,
                cost_currency: partData.cost_currency || 'ILS',
                sale_currency: partData.sale_currency || 'ILS',
                import_percentage: partData.import_percentage || 15,
                markup_percentage: partData.markup_percentage || 30,
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

            // Step 4: Create PartStock for each warehouse (if warehouses provided)
            if (partData.warehouses && Array.isArray(partData.warehouses)) {
                for (const wh of partData.warehouses) {
                    const stockData = {
                        part_sku: sku,
                        warehouse_id: wh.warehouse_id,
                        quantity: wh.quantity || 0
                    };
                    const stock = await base44.asServiceRole.entities.PartStock.create(stockData);
                    createdEntities.stocks.push(stock);
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