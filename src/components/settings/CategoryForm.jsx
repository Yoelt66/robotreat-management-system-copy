import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"; // Added Card imports
import { Currency, Supplier } from "@/entities/all";

export default function CategoryForm({ category, onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    code: category?.code || '',
    name: category?.name || '',
    supplier_number: category?.supplier_number || '', // Changed default to '' instead of null for consistency with Select
    cost_currency: category?.cost_currency || 'ILS',
    sale_currency: category?.sale_currency || 'ILS',
    import_percentage: category?.import_percentage !== undefined ? category.import_percentage : 10,
    margin_percentage: category?.margin_percentage !== undefined ? category.margin_percentage : 45,
  });

  const [currencies, setCurrencies] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null); // Added error state

  useEffect(() => {
    const loadData = async () => {
      try {
        const [currenciesData, suppliersData] = await Promise.all([
          Currency.list(),
          Supplier.list()
        ]);
        
        if (currenciesData && currenciesData.length > 0) {
          setCurrencies(currenciesData);
        } else {
          // Default currencies if none exist
          setCurrencies([
            { code: 'ILS', name: 'שקל ישראלי', symbol: '₪' },
            { code: 'USD', name: 'דולר אמריקאי', symbol: '$' },
            { code: 'EUR', name: 'אירו', symbol: '€' },
            { code: 'GBP', name: 'לירה שטרלינג', symbol: '£' }
          ]);
        }

        if (suppliersData) {
          setSuppliers(suppliersData.filter(s => s.is_active));
        }
      } catch (error) {
        console.error("Error loading data:", error);
        setError("שגיאה בטעינת נתונים: " + error.message);
      }
    };
    
    loadData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null); // Clear any previous errors
    
    try {
      await onSubmit(formData);
    } catch (err) {
      console.error("Error saving category:", err);
      setError(err.message || "שגיאה בשמירת הקטגוריה."); // Set user-friendly error message
    } finally {
      setLoading(false);
    }
  };

  // Removed `handleChange` function as changes are now handled directly in JSX using `setFormData`

  return (
    <Card>
      <CardHeader>
        <CardTitle>{category ? 'עריכת קטגוריה' : 'קטגוריה חדשה'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4"> {/* Changed gap to space-y-4 */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="code">קוד קטגוריה</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
                required
                disabled={!!category} // Disabled for existing categories
                placeholder="electronics, tools, etc." // Updated placeholder
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="name">שם קטגוריה</Label> {/* Updated Label text */}
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                required
                placeholder="אלקטרוניקה, כלי עבודה, וכו'" // Updated placeholder
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="supplier_number">ספק ברירת מחדל</Label>
            <Select
              value={formData.supplier_number || ''} // Handle null value from category object by defaulting to ''
              onValueChange={(value) => setFormData(prev => ({ ...prev, supplier_number: value || '' }))} // Ensure value is '' for null/undefined
            >
              <SelectTrigger>
                <SelectValue placeholder="בחר ספק (אופציונלי)" /> {/* Updated placeholder */}
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>ללא ספק ברירת מחדל</SelectItem> {/* Changed value to "" and text */}
                {suppliers.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.supplier_number}>
                    {supplier.supplier_number} - {supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cost_currency">מטבע עלות ברירת מחדל</Label>
              <Select
                value={formData.cost_currency}
                onValueChange={(value) => setFormData(prev => ({ ...prev, cost_currency: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="בחר מטבע" />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map((currency) => (
                    <SelectItem key={currency.code} value={currency.code}>
                      {currency.symbol} - {currency.name} {/* Display symbol and name */}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sale_currency">מטבע מכירה ברירת מחדל</Label>
              <Select
                value={formData.sale_currency}
                onValueChange={(value) => setFormData(prev => ({ ...prev, sale_currency: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="בחר מטבע" />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map((currency) => (
                    <SelectItem key={currency.code} value={currency.code}>
                      {currency.symbol} - {currency.name} {/* Display symbol and name */}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="import_percentage">אחוז ייבוא ברירת מחדל (%)</Label>
              <Input
                id="import_percentage"
                type="number"
                min="0"
                step="0.1"
                value={formData.import_percentage !== undefined ? formData.import_percentage : ''}
                onChange={(e) => setFormData(prev => ({ ...prev, import_percentage: e.target.value === '' ? 0 : parseFloat(e.target.value) }))}
                placeholder="15" // Added placeholder
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="margin_percentage">אחוז רווח ברירת מחדל (%)</Label>
              <Input
                id="margin_percentage"
                type="number"
                min="0"
                step="0.1"
                value={formData.margin_percentage !== undefined ? formData.margin_percentage : ''}
                onChange={(e) => setFormData(prev => ({ ...prev, margin_percentage: e.target.value === '' ? 0 : parseFloat(e.target.value) }))}
                placeholder="30" // Added placeholder
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4"> {/* Added pt-4 */}
            <Button type="button" variant="outline" onClick={onCancel}>
              ביטול
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'שומר...' : (category ? 'שמור שינויים' : 'הוסף קטגוריה')} {/* Updated button text */}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}