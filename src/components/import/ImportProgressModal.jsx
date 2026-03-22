import React, { useEffect, useRef, useState } from "react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, AlertTriangle, Clock, Zap, RefreshCw, X } from "lucide-react";

function formatDuration(seconds) {
  if (!isFinite(seconds) || seconds <= 0) return "מחשב...";
  if (seconds < 60) return `${Math.ceil(seconds)} שנ'`;
  const m = Math.floor(seconds / 60);
  const s = Math.ceil(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")} דק'`;
}

export default function ImportProgressModal({
  isOpen,
  progress,            // 0-100
  logs,
  totalItems,
  processedItems,
  createdItems,
  updatedItems,
  errorItems,
  retryAttempt,       // current retry attempt (0 = first run)
  maxRetries,
  startTime,          // Date object
  isFinished,
  onClose,
}) {
  const logsEndRef = useRef(null);
  const [eta, setEta] = useState(null);
  const [elapsed, setElapsed] = useState(0);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Compute ETA every second
  useEffect(() => {
    if (!startTime || isFinished) return;
    const tick = () => {
      const elapsedSec = (Date.now() - startTime.getTime()) / 1000;
      setElapsed(elapsedSec);
      if (progress > 2) {
        const totalEst = (elapsedSec / progress) * 100;
        setEta(totalEst - elapsedSec);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startTime, progress, isFinished]);

  if (!isOpen) return null;

  const pct = Math.round(Math.min(progress, 100));
  const isRetrying = retryAttempt > 0;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" dir="rtl">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden">

        {/* Header */}
        <div className={`p-5 text-white ${isFinished && errorItems === 0 ? 'bg-gradient-to-l from-emerald-600 to-emerald-500' : isFinished && errorItems > 0 ? 'bg-gradient-to-l from-amber-600 to-amber-500' : 'bg-gradient-to-l from-slate-800 to-slate-700'}`}>
          <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isFinished ? (
              errorItems === 0
                ? <CheckCircle className="h-6 w-6" />
                : <AlertTriangle className="h-6 w-6" />
            ) : (
              isRetrying
                ? <RefreshCw className="h-6 w-6 animate-spin" />
                : <Loader2 className="h-6 w-6 animate-spin" />
            )}
            <div>
              <h2 className="text-lg font-bold">
                {isFinished
                  ? (errorItems === 0 ? "הייבוא הושלם בהצלחה ✓" : `הייבוא הושלם עם ${errorItems} שגיאות`)
                  : isRetrying
                    ? `ניסיון חוזר ${retryAttempt}/${maxRetries}...`
                    : "מבצע ייבוא..."}
              </h2>
              {!isFinished && (
                <p className="text-sm opacity-80 mt-0.5">
                  {isRetrying ? "מנסה לתקן פריטים שנכשלו" : "אנא המתן, אל תסגור את הדף"}
                </p>
              )}
            </div>
          </div>
          {onClose && (
            <button
              onClick={() => {
                if (!isFinished) {
                  if (!window.confirm("הייבוא עדיין בתהליך. האם אתה בטוח שברצונך לסגור?")) return;
                }
                onClose();
              }}
              className="text-white/70 hover:text-white transition-colors p-1 rounded"
            >
              <X className="h-5 w-5" />
            </button>
          )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="px-6 pt-5">
          <div className="flex justify-between text-sm font-medium text-slate-600 mb-2">
            <span>{pct}%</span>
            <span>
              {processedItems.toLocaleString()} / {totalItems.toLocaleString()} פריטים
            </span>
          </div>
          <Progress value={pct} className="h-3" />
        </div>

        {/* Time info */}
        {!isFinished && startTime && (
          <div className="px-6 pt-3 flex gap-4 text-sm text-slate-500">
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              זמן שחלף: {formatDuration(elapsed)}
            </span>
            {eta !== null && (
              <span className="flex items-center gap-1.5">
                <Zap className="h-4 w-4" />
                זמן משוער לסיום: {formatDuration(eta)}
              </span>
            )}
          </div>
        )}

        {/* Finished time */}
        {isFinished && startTime && (
          <div className="px-6 pt-3 text-sm text-slate-500 flex items-center gap-1.5">
            <Clock className="h-4 w-4" />
            סה"כ זמן: {formatDuration(elapsed)}
          </div>
        )}

        {/* Stats */}
        <div className="px-6 pt-4 grid grid-cols-3 gap-3">
          <div className="bg-emerald-50 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-emerald-700">{createdItems.toLocaleString()}</div>
            <div className="text-xs text-emerald-600 mt-0.5">פריטים חדשים</div>
          </div>
          <div className="bg-blue-50 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-blue-700">{updatedItems.toLocaleString()}</div>
            <div className="text-xs text-blue-600 mt-0.5">עודכנו</div>
          </div>
          <div className={`rounded-xl p-3 text-center ${errorItems > 0 ? 'bg-red-50' : 'bg-slate-50'}`}>
            <div className={`text-2xl font-bold ${errorItems > 0 ? 'text-red-700' : 'text-slate-400'}`}>{errorItems.toLocaleString()}</div>
            <div className={`text-xs mt-0.5 ${errorItems > 0 ? 'text-red-600' : 'text-slate-400'}`}>שגיאות</div>
          </div>
        </div>

        {/* Retry badge */}
        {isRetrying && (
          <div className="px-6 pt-3">
            <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50">
              <RefreshCw className="h-3 w-3 ml-1" />
              ניסיון {retryAttempt} מתוך {maxRetries} — מנסה שוב פריטים שנכשלו
            </Badge>
          </div>
        )}

        {/* Logs */}
        <div className="p-6 pt-4">
          <div className="bg-slate-900 rounded-xl h-44 overflow-y-auto p-3 font-mono text-xs space-y-0.5">
            {logs.map((log, i) => (
              <div
                key={i}
                className={
                  log.type === 'error' ? 'text-red-400' :
                  log.type === 'success' ? 'text-emerald-400' :
                  log.type === 'warn' ? 'text-amber-400' :
                  'text-slate-400'
                }
              >
                <span className="text-slate-600 ml-2">{new Date(log.timestamp || Date.now()).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                {log.message}
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
}