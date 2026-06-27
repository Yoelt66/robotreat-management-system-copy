import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const logTransaction = async (base44, { part_sku, warehouse_id, transaction_type, quantity_delta, quantity_before, quantity_after, reference_type, reference_id, notes, performed_by, performed_by_name }) => {
    try {
        await base44.asServiceRole.entities.StockTransaction.create({
            part_sku,
            warehouse_id,
            transaction_type,
            quantity_delta,
            quantity_before,
            quantity_after,
            reference_type: reference_type || 'manual',
            reference_id: reference_id || '',
            performed_by: performed_by || '',
            performed_by_name: performed_by_name || '',
            notes: notes || ''
        });
    } catch (e) {
        console.error('Failed to log stock transaction:', e);
    }
};

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { sku, warehouse_id, quantity, delta, location, reference_type, reference_id, notes } = await req.json();

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
            
            const stockUpdate = { quantity: newQuantity };
            if (location !== undefined) stockUpdate.location = location;
            await base44.asServiceRole.entities.PartStock.update(stockRecord.id, stockUpdate);

            const delta_applied = newQuantity - (stockRecord.quantity || 0);
            await logTransaction(base44, {
                part_sku: sku,
                warehouse_id,
                transaction_type: delta_applied >= 0 ? 'receipt' : 'consumption',
                quantity_delta: delta_applied,
                quantity_before: stockRecord.quantity || 0,
                quantity_after: newQuantity,
                reference_type,
                reference_id,
                notes,
                performed_by: user.id,
                performed_by_name: user.full_name
            });
            
            return Response.json({ 
                success: true, 
                message: 'מלאי עודכן בהצלחה',
                new_quantity: newQuantity
            });
        } else {
            // Create new stock record
            const newQuantity = typeof delta === 'number' ? Math.max(0, delta) : (quantity || 0);
            
            const newStockRecord = { part_sku: sku, warehouse_id, quantity: newQuantity };
            if (location !== undefined) newStockRecord.location = location;
            await base44.asServiceRole.entities.PartStock.create(newStockRecord);

            await logTransaction(base44, {
                part_sku: sku,
                warehouse_id,
                transaction_type: 'initial',
                quantity_delta: newQuantity,
                quantity_before: 0,
                quantity_after: newQuantity,
                reference_type,
                reference_id,
                notes,
                performed_by: user.id,
                performed_by_name: user.full_name
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