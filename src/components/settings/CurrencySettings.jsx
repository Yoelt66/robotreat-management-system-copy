import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Currency } from "@/entities/Currency";
import CurrencyList from "./CurrencyList";
import CurrencyForm from "./CurrencyForm";
import { useToast } from "@/components/ui/use-toast";

export default function CurrencySettings() {
  const [currencies, setCurrencies] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingCurrency, setEditingCurrency] = useState(null);
  const [loading, setLoading] = useState(true);

  const { toast } = useToast();

  useEffect(() => {
    loadCurrencies();
  }, []);

  const loadCurrencies = async () => {
    try {
      const data = await Currency.list();
      if (data && data.length > 0) {
        setCurrencies(data);
      } else {
        // Insert default currencies if none exist
        const defaultCurrencies = [
          { code: 'ILS', name: 'שקל ישראלי', symbol: '₪', rate_to_ils: 1 },
          { code: 'USD', name: 'דולר אמריקאי', symbol: '$', rate_to_ils: 3.6 },
          { code: 'EUR', name: 'אירו', symbol: '€', rate_to_ils: 3.9 },
          { code: 'GBP', name: 'לירה שטרלינג', symbol: '£', rate_to_ils: 4.6 }
        ];

        for (const currency of defaultCurrencies) {
          await Currency.create(currency);
        }
        const newCurrencies = await Currency.list();
        setCurrencies(newCurrencies);
      }
    } catch (error) {
      console.error("Error loading currencies:", error);
      toast({
        variant: "destructive",
        title: "שגיאה בטעינת מטבעות",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (currencyData) => {
    try {
      if (editingCurrency) {
        await Currency.update(editingCurrency.id, currencyData);
        toast({ 
          title: "מטבע עודכן בהצלחה",
          description: "מחירי הפריטים יעודכנו אוטומטית בצפייה הבאה"
        });
      } else {
        await Currency.create(currencyData);
        toast({ title: "מטבע נוצר בהצלחה" });
      }

      setShowForm(false);
      setEditingCurrency(null);
      loadCurrencies();
    } catch (error) {
      console.error("Error saving currency:", error);
      toast({
        variant: "destructive",
        title: "שגיאה בשמירת המטבע",
        description: error.message
      });
    }
  };

  if (loading) {
    return <div>טוען...</div>;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>מטבעות</CardTitle>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 ml-2" />
          מטבע חדש
        </Button>
      </CardHeader>
      <CardContent>
        {showForm ? (
          <CurrencyForm
            currency={editingCurrency}
            onSubmit={handleSubmit}
            onCancel={() => {
              setShowForm(false);
              setEditingCurrency(null);
            }}
          />
        ) : (
          <CurrencyList
            currencies={currencies}
            onEdit={(currency) => {
              setEditingCurrency(currency);
              setShowForm(true);
            }}
          />
        )}
      </CardContent>
    </Card>
  );
}