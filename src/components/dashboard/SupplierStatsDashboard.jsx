import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, AlertCircle, CheckCircle2, Building2 } from "lucide-react";

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);

export default function SupplierStatsDashboard() {
  const [selectedYear, setSelectedYear] = useState(String(CURRENT_YEAR));
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadStats(selectedYear);
  }, [selectedYear]);

  const loadStats = async (year) => {
    setLoading(true);
    setError(null);
    try {
      const result = await base44.functions.invoke('getSupplierStats', { year: parseInt(year) });
      setStats(result.data?.stats || []);
    } catch (err) {
      console.error("Error loading supplier stats:", err);
      setError("שגיאה בטעינת נתוני ספקים");
    } finally {
      setLoading(false);
    }
  };

  const CURRENCY_SYMBOLS = { ILS: '₪', USD: '$', EUR: '€', GBP: '£' };

  const formatAmount = (amount, currency = 'ILS') => {
    if (!amount) return `${CURRENCY_SYMBOLS[currency] || currency}0`;
    const symbol = CURRENCY_SYMBOLS[currency] || currency + ' ';
    return `${symbol}${amount.toLocaleString('he-IL', { maximumFractionDigits: 0 })}`;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-slate-500" />
            סיכום ספקים
          </CardTitle>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {YEARS.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        )}

        {!loading && error && (
          <div className="text-center py-6 text-red-500 text-sm">{error}</div>
        )}

        {!loading && !error && stats.length === 0 && (
          <div className="text-center py-6 text-slate-400 text-sm">
            אין חשבוניות לשנת {selectedYear}
          </div>
        )}

        {!loading && !error && stats.length > 0 && (
          <div className="space-y-2">
            {stats.map((item, idx) => (
              <div
                key={idx}
                className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                  item.open_count > 0
                    ? 'bg-red-50 border-red-200'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {item.open_count > 0 ? (
                    <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="font-medium text-slate-800 truncate">{item.supplier_name}</div>
                    {!item.is_matched && (
                      <div className="text-xs text-amber-600">לא משויך לספק רשמי</div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0 mr-2">
                  <div className="flex flex-col gap-1 items-end">
                    {Object.entries(item.balances || {}).map(([currency, bal]) => (
                      <div key={currency} className="flex items-center gap-3">
                        {bal.open_count > 0 && (
                          <div className="text-left">
                            <div className="text-sm font-bold text-red-600">{formatAmount(bal.open, currency)}</div>
                            <div className="text-xs text-slate-400">{bal.open_count} פתוחות</div>
                          </div>
                        )}
                        {bal.paid_count > 0 && (
                          <div className="text-left">
                            <div className="text-sm text-slate-500">{formatAmount(bal.paid, currency)}</div>
                            <div className="text-xs text-slate-400">{bal.paid_count} שולמו</div>
                          </div>
                        )}
                        {Object.keys(item.balances).length > 1 && (
                          <span className="text-xs text-slate-400 font-mono">{currency}</span>
                        )}
                      </div>
                    ))}
                  </div>
                  {item.open_count > 0 ? (
                    <Badge variant="destructive" className="text-xs">פתוח</Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-300">סגור</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}