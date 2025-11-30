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

        // Find existing PartCore
        const existingCores = await base44.asServiceRole.entities.PartCore.filter({ sku });
        if (!existingCores || existingCores.length === 0) {
            return Response.json({ error: 'פריט לא נמצא' }, { status: 404 });
        }

        const coreId = existingCores[0].id;

        // Update PartCore
        const coreData = {
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
        
        await base44.asServiceRole.entities.PartCore.update(coreId, coreData);

        // Update PartPricing
        const existingPricings = await base44.asServiceRole.entities.PartPricing.filter({ part_sku: sku });
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
        
        if (existingPricings && existingPricings.length > 0) {
            await base44.asServiceRole.entities.PartPricing.update(existingPricings[0].id, pricingData);
        } else {
            await base44.asServiceRole.entities.PartPricing.create(pricingData);
        }

        // Update PartSupplier
        const existingSuppliers = await base44.asServiceRole.entities.PartSupplier.filter({ part_sku: sku });
        const supplierData = {
            part_sku: sku,
            supplier_number: partData.supplier_number || '',
            supplier_part_number: partData.supplier_part_number || ''
        };
        
        if (existingSuppliers && existingSuppliers.length > 0) {
            await base44.asServiceRole.entities.PartSupplier.update(existingSuppliers[0].id, supplierData);
        } else {
            await base44.asServiceRole.entities.PartSupplier.create(supplierData);
        }

        return Response.json({ 
            success: true, 
            message: 'פריט עודכן בהצלחה'
        });

    } catch (error) {
        console.error('Update part error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});