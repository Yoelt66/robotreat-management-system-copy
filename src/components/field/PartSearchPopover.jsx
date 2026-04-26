import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";

/**
 * פופאובר חיפוש חלקים — מינימום 4 תווים, מחפש ב-PartCore
 * onSelect(part: { part_sku, part_name, quantity }) => void
 */
export default function PartSearchPopover({ onSelect, onClose }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef(null);

  // סגור בלחיצה מחוץ
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  // חיפוש עם debounce
  useEffect(() => {
    if (query.length < 4) { setResults([]); return; }
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const all = await base44.entities.PartCore.list();
        const q = query.toLowerCase();
        const filtered = all.filter(p =>
          p.sku?.toLowerCase().includes(q) || p.name?.toLowerCase().includes(q)
        ).slice(0, 20);
        setResults(filtered);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div
      ref={containerRef}
      className="absolute z-50 bg-white border border-slate-200 rounded-lg shadow-lg w-72 mt-1"
      style={{ right: 0 }}
    >
      <div className="p-2 border-b border-slate-100">
        <div className="relative">
          <Search className="absolute right-2 top-2 h-3.5 w-3.5 text-slate-400" />
          <Input
            autoFocus
            placeholder="חפש לפי מק״ט או שם (מינימום 4 תווים)..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="h-7 text-xs pr-7"
          />
        </div>
      </div>

      <div className="max-h-48 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-4 text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin ml-1" />
            <span className="text-xs">מחפש...</span>
          </div>
        )}
        {!loading && query.length >= 4 && results.length === 0 && (
          <div className="text-xs text-slate-400 text-center py-4">לא נמצאו חלקים</div>
        )}
        {!loading && query.length < 4 && (
          <div className="text-xs text-slate-400 text-center py-4">הכנס לפחות 4 תווים לחיפוש</div>
        )}
        {results.map(part => (
          <button
            key={part.id}
            type="button"
            className="w-full text-right px-3 py-2 text-xs hover:bg-slate-50 border-b border-slate-50 last:border-0 transition-colors"
            onClick={() => { onSelect({ part_sku: part.sku, part_name: part.name, quantity: 1 }); onClose(); }}
          >
            <div className="font-medium text-slate-700">{part.name}</div>
            <div className="text-slate-400 text-[10px]">{part.sku}</div>
          </button>
        ))}
      </div>
    </div>
  );
}