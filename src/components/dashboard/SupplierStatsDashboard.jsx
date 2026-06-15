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

  const formatAmount = (amount) => {
    if (!amount) return '₪0';
    return `₪${amount.toLocaleString('he-IL', { maximumFractionDigits: 0 })}`;
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
                  {item.open_count > 0 && (
                    <div className="text-left">
                      <div className="text-sm font-bold text-red-600">{formatAmount(item.total_open)}</div>
                      <div className="text-xs text-slate-400">{item.open_count} פתוחות</div>
                    </div>
                  )}
                  {item.paid_count > 0 && (
                    <div className="text-left">
                      <div className="text-sm text-slate-500">{formatAmount(item.total_paid)}</div>
                      <div className="text-xs text-slate-400">{item.paid_count} שולמו</div>
                    </div>
                  )}
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