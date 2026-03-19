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

        const { sku } = await req.json();

        if (!sku) {
            return Response.json({ error: 'SKU is required' }, { status: 400 });
        }

        const deletedEntities = {
            stocks: 0,
            supplier: 0,
            pricing: 0,
            core: 0
        };

        // Step 1: Delete all PartStock records for this SKU
        const stocks = await base44.asServiceRole.entities.PartStock.filter({ part_sku: sku });
        for (const stock of stocks) {
            await base44.asServiceRole.entities.PartStock.delete(stock.id);
            deletedEntities.stocks++;
        }

        // Step 2: Delete PartSupplier
        const suppliers = await base44.asServiceRole.entities.PartSupplier.filter({ part_sku: sku });
        for (const supplier of suppliers) {
            await base44.asServiceRole.entities.PartSupplier.delete(supplier.id);
            deletedEntities.supplier++;
        }

        // Step 3: Delete PartPricing
        const pricings = await base44.asServiceRole.entities.PartPricing.filter({ part_sku: sku });
        for (const pricing of pricings) {
            await base44.asServiceRole.entities.PartPricing.delete(pricing.id);
            deletedEntities.pricing++;
        }

        // Step 4: Delete PartCore (last, as it's the main entity)
        const cores = await base44.asServiceRole.entities.PartCore.filter({ sku });
        for (const core of cores) {
            await base44.asServiceRole.entities.PartCore.delete(core.id);
            deletedEntities.core++;
        }

        return Response.json({ 
            success: true, 
            message: 'פריט נמחק בהצלחה',
            deleted: deletedEntities 
        });

    } catch (error) {
        console.error('Delete part error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});