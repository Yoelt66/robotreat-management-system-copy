import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { part_sku } = await req.json();

        if (!part_sku) {
            return Response.json({ error: 'part_sku is required' }, { status: 400 });
        }

        // קבלת נתוני תמחור הפריט
        const pricingRecords = await base44.entities.PartPricing.filter({ part_sku });
        
        if (!pricingRecords || pricingRecords.length === 0) {
            return Response.json({ 
                error: 'לא נמצאו נתוני תמחור לפריט זה',
                sale_price: 0,
                currency: 'ILS'
            }, { status: 404 });
        }

        const pricing = pricingRecords[0];

        // בדיקה אם קיים מחיר ידני
        if (pricing.is_manual && pricing.manual_sale_price) {
            return Response.json({
                sale_price: pricing.manual_sale_price,
                currency: pricing.sale_currency || 'ILS',
                is_manual: true
            });
        }

        // קבלת נתוני הפריט כדי לאתר את הקטגוריה
        const partRecords = await base44.entities.PartCore.filter({ sku: part_sku });
        
        if (!partRecords || partRecords.length === 0) {
            return Response.json({ error: 'פריט לא נמצא' }, { status: 404 });
        }

        const part = partRecords[0];

        // קבלת ערכי ברירת מחדל מהקטגוריה
        let effectiveImportPercentage = pricing.import_percentage;
        let effectiveMarkupPercentage = pricing.markup_percentage;
        let effectiveCostCurrency = pricing.cost_currency || 'ILS';
        let effectiveSaleCurrency = pricing.sale_currency || 'ILS';

        if (part.category) {
            const categoryRecords = await base44.entities.Category.filter({ code: part.category });
            
            if (categoryRecords && categoryRecords.length > 0) {
                const category = categoryRecords[0];
                
                // שימוש בערכי קטגוריה רק אם לא הוגדרו ערכים ספציפיים לפריט
                if (effectiveImportPercentage === undefined || effectiveImportPercentage === null) {
                    effectiveImportPercentage = category.import_percentage || 15;
                }
                if (effectiveMarkupPercentage === undefined || effectiveMarkupPercentage === null) {
                    effectiveMarkupPercentage = category.margin_percentage || 30;
                }
                if (!pricing.cost_currency && category.cost_currency) {
                    effectiveCostCurrency = category.cost_currency;
                }
                if (!pricing.sale_currency && category.sale_currency) {
                    effectiveSaleCurrency = category.sale_currency;
                }
            }
        }

        // בדיקת תקינות ערכים
        const costPrice = parseFloat(pricing.cost_price) || 0;
        if (costPrice === 0) {
            return Response.json({
                sale_price: 0,
                currency: effectiveSaleCurrency,
                is_manual: false,
                message: 'מחיר עלות לא הוגדר'
            });
        }

        effectiveImportPercentage = parseFloat(effectiveImportPercentage) || 15;
        effectiveMarkupPercentage = parseFloat(effectiveMarkupPercentage) || 30;

        // המרת מטבע אם נדרש
        let costInTargetCurrency = costPrice;
        
        if (effectiveCostCurrency !== effectiveSaleCurrency) {
            // קבלת שערי המרה
            const [costCurrencyData, saleCurrencyData] = await Promise.all([
                base44.entities.Currency.filter({ code: effectiveCostCurrency }),
                base44.entities.Currency.filter({ code: effectiveSaleCurrency })
            ]);

            if (costCurrencyData && costCurrencyData.length > 0 && 
                saleCurrencyData && saleCurrencyData.length > 0) {
                const costRate = costCurrencyData[0].rate_to_ils || 1;
                const saleRate = saleCurrencyData[0].rate_to_ils || 1;
                
                // המרה: מטבע עלות -> ILS -> מטבע מכירה
                const costInILS = costPrice * costRate;
                costInTargetCurrency = costInILS / saleRate;
            }
        }

        // חישוב מחיר מכירה
        const priceAfterImport = costInTargetCurrency * (1 + effectiveImportPercentage / 100);
        const finalSalePrice = priceAfterImport * (1 + effectiveMarkupPercentage / 100);

        return Response.json({
            sale_price: Math.round(finalSalePrice * 100) / 100,
            currency: effectiveSaleCurrency,
            is_manual: false,
            calculation_details: {
                cost_price: costPrice,
                cost_currency: effectiveCostCurrency,
                import_percentage: effectiveImportPercentage,
                markup_percentage: effectiveMarkupPercentage,
                sale_currency: effectiveSaleCurrency
            }
        });

    } catch (error) {
        console.error('Error calculating sale price:', error);
        return Response.json({ 
            error: error.message || 'שגיאה בחישוב מחיר מכירה' 
        }, { status: 500 });
    }
});