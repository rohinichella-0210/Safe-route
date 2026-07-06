import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from 'lucide-react';

type ToastKind = 'success' | 'error' | 'info' | 'warning';
interface Toast { id: number; kind: ToastKind; msg: string; }

const ToastCtx = createContext<{ push: (k: ToastKind, m: string) => void }>({ push: () => {} });

let toasts: Toast[] = [];
let listeners: Array<(t: Toast[]) => void> = [];
let counter = 0;

export function toast(kind: ToastKind, msg: string) {
  const id = ++counter;
  toasts = [...toasts, { id, kind, msg }];
  listeners.forEach(l => l(toasts));
  setTimeout(() => {
    toasts = toasts.filter(t => t.id !== id);
    listeners.forEach(l => l(toasts));
  }, 4500);
}

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);
  React.useEffect(() => {
    const l = (t: Toast[]) => setItems(t);
    listeners.push(l);
    return () => { listeners = listeners.filter(x => x !== l); };
  }, []);
  const iconFor = (k: ToastKind) => {
    if (k === 'success') return <CheckCircle2 className="w-5 h-5 text-teal-600" />;
    if (k === 'error') return <XCircle className="w-5 h-5 text-red-600" />;
    if (k === 'warning') return <AlertTriangle className="w-5 h-5 text-amber-600" />;
    return <Info className="w-5 h-5 text-slate-600" />;
  };
  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm" data-testid="toaster">
      {items.map(t => (
        <div key={t.id}
          className="flex items-start gap-3 bg-white/95 backdrop-blur-xl border border-slate-200 rounded-2xl px-4 py-3 shadow-lg animate-in fade-in slide-in-from-top-2"
          data-testid={`toast-${t.kind}`}>
          {iconFor(t.kind)}
          <div className="flex-1 text-sm text-slate-800 font-medium">{t.msg}</div>
        </div>
      ))}
    </div>
  );
}
