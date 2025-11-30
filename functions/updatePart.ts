import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

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

        // Find existing PartCore
        const existingCores = await base44.asServiceRole.entities.PartCore.filter({ sku });
        if (!existingCores || existingCores.length === 0) {
            return Response.json({ error: 'פריט לא נמצא' }, { status: 404 });
        }

        const existingCore = existingCores[0];
        const coreId = existingCore.id;
        let updatedFields = [];

        // Build PartCore update - only changed fields
        const coreFields = ['name', 'category', 'unit', 'minimum_stock', 'notes', 'replaced_sku', 'current_location', 'requires_serial_number', 'last_count_date'];
        const coreUpdate = {};
        
        for (const field of coreFields) {
            if (hasChanged(existingCore[field], partData[field])) {
                coreUpdate[field] = partData[field] ?? (field === 'minimum_stock' ? 0 : '');
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
        const pricingUpdate = {};
        
        for (const field of pricingFields) {
            if (hasChanged(existingPricing[field], partData[field])) {
                pricingUpdate[field] = partData[field] ?? (typeof existingPricing[field] === 'number' ? 0 : '');
                updatedFields.push(field);
            }
        }
        
        if (Object.keys(pricingUpdate).length > 0) {
            if (existingPricings && existingPricings.length > 0) {
                await base44.asServiceRole.entities.PartPricing.update(existingPricings[0].id, pricingUpdate);
            } else {
                pricingUpdate.part_sku = sku;
                await base44.asServiceRole.entities.PartPricing.create(pricingUpdate);
            }
        }

        // Update PartSupplier - only if changed
        const existingSuppliers = await base44.asServiceRole.entities.PartSupplier.filter({ part_sku: sku });
        const existingSupplier = existingSuppliers?.[0] || {};
        
        const supplierFields = ['supplier_number', 'supplier_part_number'];
        const supplierUpdate = {};
        
        for (const field of supplierFields) {
            if (hasChanged(existingSupplier[field], partData[field])) {
                supplierUpdate[field] = partData[field] ?? '';
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

        return Response.json({ 
            success: true, 
            message: updatedFields.length > 0 ? 'פריט עודכן בהצלחה' : 'לא נמצאו שינויים',
            updatedFields: updatedFields
        });

    } catch (error) {
        console.error('Update part error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});