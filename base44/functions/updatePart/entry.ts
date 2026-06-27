import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

// Helper to check if value actually changed
const hasChanged = (oldVal, newVal) => {
    if (newVal === undefined) return false; // Field not provided, don't update
    // Handle boolean comparisons
    if (typeof newVal === 'boolean' || typeof oldVal === 'boolean') {
        return Boolean(oldVal) !== Boolean(newVal);
    }
    // Handle numeric comparisons
    if (typeof newVal === 'number' || typeof oldVal === 'number') {
        const oldNum = parseFloat(oldVal) || 0;
        const newNum = parseFloat(newVal) || 0;
        return oldNum !== newNum;
    }
    const oldStr = String(oldVal ?? '');
    const newStr = String(newVal ?? '');
    return oldStr !== newStr;
};

Deno.serve(async (req) => {
    let partData = null;
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }
        
        if (user.role !== 'admin') {
            return Response.json({ error: 'Admin access required' }, { status: 403 });
        }

        partData = await req.json();
        const { sku } = partData;

        if (!sku) {
            return Response.json({ error: 'SKU is required' }, { status: 400 });
        }

        // Find existing PartCore
        const existingCores = await base44.asServiceRole.entities.PartCore.filter({ sku });
        if (!existingCores || existingCores.length === 0) {
            return Response.json({ error: 'פריט לא נמצא' }, { status: 404 });
        }

        const existingCore = existingCores[0];
        const coreId = existingCore.id;
        let updatedFields = [];

        // Build PartCore update - only changed fields (current_location removed - managed per-warehouse in PartStock.location)
        const coreFields = ['name', 'category', 'unit', 'minimum_stock', 'notes', 'replaced_sku', 'requires_serial_number', 'last_count_date'];
        const coreUpdate = {};
        
        for (const field of coreFields) {
            if (partData[field] !== undefined && hasChanged(existingCore[field], partData[field])) {
                if (field === 'minimum_stock') {
                    coreUpdate[field] = parseFloat(partData[field]) || 0;
                } else if (field === 'requires_serial_number') {
                    coreUpdate[field] = Boolean(partData[field]);
                } else {
                    coreUpdate[field] = partData[field] ?? '';
                }
                updatedFields.push(field);
            }
        }
        
        if (Object.keys(coreUpdate).length > 0) {
            await base44.asServiceRole.entities.PartCore.update(coreId, coreUpdate);
        }

        // Update PartPricing - only if changed
        const existingPricings = await base44.asServiceRole.entities.PartPricing.filter({ part_sku: sku });
        const existingPricing = existingPricings?.[0] || {};
        
        const pricingFields = ['cost_price', 'cost_currency', 'sale_currency', 'import_percentage', 'markup_percentage', 'manual_sale_price', 'is_manual'];
        const numericPricingFields = ['cost_price', 'import_percentage', 'markup_percentage', 'manual_sale_price'];
        const pricingUpdate = {};
        
        for (const field of pricingFields) {
            if (partData[field] !== undefined && hasChanged(existingPricing[field], partData[field])) {
                if (numericPricingFields.includes(field)) {
                    const numValue = parseFloat(partData[field]);
                    pricingUpdate[field] = isNaN(numValue) ? 0 : numValue;
                } else if (field === 'is_manual') {
                    pricingUpdate[field] = Boolean(partData[field]);
                } else {
                    // For currency fields, only update if value is valid (not empty string)
                    if (partData[field] && partData[field] !== '') {
                        pricingUpdate[field] = partData[field];
                    }
                }
                updatedFields.push(field);
            }
        }
        
        if (Object.keys(pricingUpdate).length > 0) {
            const priceLogFields = ['cost_price', 'cost_currency', 'manual_sale_price', 'markup_percentage', 'import_percentage'];
            const hasPriceChange = priceLogFields.some(f => pricingUpdate[f] !== undefined);

            if (existingPricings && existingPricings.length > 0) {
                await base44.asServiceRole.entities.PartPricing.update(existingPricings[0].id, pricingUpdate);
            } else {
                pricingUpdate.part_sku = sku;
                await base44.asServiceRole.entities.PartPricing.create(pricingUpdate);
            }

            if (hasPriceChange) {
                try {
                    await base44.asServiceRole.entities.PartPriceLog.create({
                        part_sku: sku,
                        changed_by: user.id,
                        changed_by_name: user.full_name || '',
                        old_cost_price: existingPricing.cost_price ?? 0,
                        new_cost_price: pricingUpdate.cost_price ?? existingPricing.cost_price ?? 0,
                        old_cost_currency: existingPricing.cost_currency ?? 'ILS',
                        new_cost_currency: pricingUpdate.cost_currency ?? existingPricing.cost_currency ?? 'ILS',
                        old_manual_sale_price: existingPricing.manual_sale_price ?? 0,
                        new_manual_sale_price: pricingUpdate.manual_sale_price ?? existingPricing.manual_sale_price ?? 0,
                        old_markup_percentage: existingPricing.markup_percentage ?? 0,
                        new_markup_percentage: pricingUpdate.markup_percentage ?? existingPricing.markup_percentage ?? 0,
                        old_import_percentage: existingPricing.import_percentage ?? 0,
                        new_import_percentage: pricingUpdate.import_percentage ?? existingPricing.import_percentage ?? 0,
                        change_reason: 'עדכון ידני'
                    });
                } catch (logErr) {
                    console.error('Failed to write price log:', logErr);
                }
            }
        }

        // Update PartSupplier - only if changed
        const existingSuppliers = await base44.asServiceRole.entities.PartSupplier.filter({ part_sku: sku });
        const existingSupplier = existingSuppliers?.[0] || {};
        
        const supplierFields = ['supplier_number', 'supplier_part_number'];
        const supplierUpdate = {};
        
        for (const field of supplierFields) {
            if (partData[field] !== undefined && hasChanged(existingSupplier[field], partData[field])) {
                supplierUpdate[field] = partData[field] || '';
                updatedFields.push(field);
            }
        }
        
        if (Object.keys(supplierUpdate).length > 0) {
            if (existingSuppliers && existingSuppliers.length > 0) {
                await base44.asServiceRole.entities.PartSupplier.update(existingSuppliers[0].id, supplierUpdate);
            } else {
                supplierUpdate.part_sku = sku;
                await base44.asServiceRole.entities.PartSupplier.create(supplierUpdate);
            }
        }

        // Update PartStock - if warehouses array provided
        if (partData.warehouses && Array.isArray(partData.warehouses) && partData.warehouses.length > 0) {
            const existingStocks = await base44.asServiceRole.entities.PartStock.filter({ part_sku: sku });
            const stockMap = new Map(existingStocks.map(s => [s.warehouse_id, s]));

            for (const { warehouse_id, quantity } of partData.warehouses) {
                if (warehouse_id === undefined || quantity === undefined) continue;
                const newQty = parseFloat(quantity) || 0;
                const existingStock = stockMap.get(warehouse_id);

                if (existingStock) {
                    if (existingStock.quantity !== newQty) {
                        await base44.asServiceRole.entities.PartStock.update(existingStock.id, { quantity: newQty });
                        updatedFields.push(`stock_${warehouse_id}`);
                    }
                } else {
                    await base44.asServiceRole.entities.PartStock.create({ part_sku: sku, warehouse_id, quantity: newQty });
                    updatedFields.push(`stock_${warehouse_id}`);
                }
            }
        }

        return Response.json({ 
            success: true, 
            message: updatedFields.length > 0 ? 'פריט עודכן בהצלחה' : 'לא נמצאו שינויים',
            updatedFields: updatedFields
        });

    } catch (error) {
        console.error('Update part error:', error);
        console.error('Error stack:', error.stack);
        return Response.json({ 
            error: error.message,
            details: error.stack,
            sku: partData?.sku 
        }, { status: 500 });
    }
});