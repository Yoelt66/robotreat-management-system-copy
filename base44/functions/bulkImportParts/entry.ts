import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Unauthorized - Admin access required' }, { status: 403 });
        }

        const { parts } = await req.json();

        if (!Array.isArray(parts) || parts.length === 0) {
            return Response.json({ error: 'parts array is required' }, { status: 400 });
        }

        const results = {
            created: 0,
            updated: 0,
            errors: []
        };

        // קבלת כל הפריטים הקיימים
        const existingPartsResponse = await base44.asServiceRole.entities.PartCore.list();
        const existingParts = new Map(existingPartsResponse.map(p => [p.sku, p]));

        // קבלת כל המחסנים
        const warehouses = await base44.asServiceRole.entities.Warehouse.list();

        for (const partData of parts) {
            try {
                const { sku, stock, pricing, supplier, ...coreData } = partData;

                if (!sku || !coreData.name) {
                    results.errors.push({ sku, error: 'SKU and name are required' });
                    continue;
                }

                const existingPart = existingParts.get(sku);

                // יצירה או עדכון PartCore
                if (!existingPart) {
                    await base44.asServiceRole.entities.PartCore.create({
                        sku,
                        ...coreData
                    });
                    results.created++;
                } else {
                    await base44.asServiceRole.entities.PartCore.update(existingPart.id, coreData);
                    results.updated++;
                }

                // עדכון/יצירת PartStock למחסנים
                if (stock && typeof stock === 'object') {
                    for (const warehouse of warehouses) {
                        const warehouseId = warehouse.warehouse_id;
                        const quantity = stock[warehouseId];

                        if (quantity !== undefined && quantity !== null) {
                            // חיפוש רשומת מלאי קיימת
                            const existingStock = await base44.asServiceRole.entities.PartStock.filter({
                                part_sku: sku,
                                warehouse_id: warehouseId
                            });

                            if (existingStock && existingStock.length > 0) {
                                await base44.asServiceRole.entities.PartStock.update(existingStock[0].id, {
                                    quantity: parseFloat(quantity) || 0
                                });
                            } else {
                                await base44.asServiceRole.entities.PartStock.create({
                                    part_sku: sku,
                                    warehouse_id: warehouseId,
                                    quantity: parseFloat(quantity) || 0
                                });
                            }
                        }
                    }
                }

                // עדכון/יצירת PartPricing
                if (pricing && typeof pricing === 'object') {
                    const existingPricing = await base44.asServiceRole.entities.PartPricing.filter({
                        part_sku: sku
                    });

                    if (existingPricing && existingPricing.length > 0) {
                        await base44.asServiceRole.entities.PartPricing.update(existingPricing[0].id, pricing);
                    } else {
                        await base44.asServiceRole.entities.PartPricing.create({
                            part_sku: sku,
                            ...pricing
                        });
                    }
                }

                // עדכון/יצירת PartSupplier
                if (supplier && typeof supplier === 'object') {
                    const existingSupplier = await base44.asServiceRole.entities.PartSupplier.filter({
                        part_sku: sku
                    });

                    if (existingSupplier && existingSupplier.length > 0) {
                        await base44.asServiceRole.entities.PartSupplier.update(existingSupplier[0].id, supplier);
                    } else {
                        await base44.asServiceRole.entities.PartSupplier.create({
                            part_sku: sku,
                            ...supplier
                        });
                    }
                }

            } catch (error) {
                results.errors.push({ 
                    sku: partData.sku || 'unknown', 
                    error: error.message 
                });
            }
        }

        return Response.json({
            success: true,
            results
        });

    } catch (error) {
        console.error('Error in bulk import:', error);
        return Response.json({ 
            error: error.message || 'שגיאה בייבוא המונ��' 
        }, { status: 500 });
    }
});