import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { sku, warehouse_id, quantity, delta } = await req.json();

        if (!sku || !warehouse_id) {
            return Response.json({ error: 'SKU and warehouse_id are required' }, { status: 400 });
        }

        // Find existing stock record
        const existingStocks = await base44.asServiceRole.entities.PartStock.filter({ 
            part_sku: sku, 
            warehouse_id: warehouse_id 
        });

        if (existingStocks && existingStocks.length > 0) {
            const stockRecord = existingStocks[0];
            let newQuantity;
            
            if (typeof delta === 'number') {
                // Delta mode: add or subtract from current quantity
                newQuantity = (stockRecord.quantity || 0) + delta;
            } else if (typeof quantity === 'number') {
                // Absolute mode: set to specific quantity
                newQuantity = quantity;
            } else {
                return Response.json({ error: 'Either quantity or delta is required' }, { status: 400 });
            }
            
            // Prevent negative stock
            if (newQuantity < 0) {
                newQuantity = 0;
            }
            
            await base44.asServiceRole.entities.PartStock.update(stockRecord.id, { quantity: newQuantity });
            
            return Response.json({ 
                success: true, 
                message: 'מלאי עודכן בהצלחה',
                new_quantity: newQuantity
            });
        } else {
            // Create new stock record
            const newQuantity = typeof delta === 'number' ? Math.max(0, delta) : (quantity || 0);
            
            await base44.asServiceRole.entities.PartStock.create({
                part_sku: sku,
                warehouse_id: warehouse_id,
                quantity: newQuantity
            });
            
            return Response.json({ 
                success: true, 
                message: 'רשומת מלאי חדשה נוצרה',
                new_quantity: newQuantity
            });
        }

    } catch (error) {
        console.error('Update part stock error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});