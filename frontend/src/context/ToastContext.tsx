'use client';
import { createContext, useCallback, useContext, useState, ReactNode } from 'react';

interface ToastMsg { id: number; text: string; kind: 'success' | 'error' | 'info'; }
interface ToastCtx { show: (text: string, kind?: ToastMsg['kind']) => void; success: (t: string) => void; error: (t: string) => void; info: (t: string) => void; }

const Ctx = createContext<ToastCtx>({ show: () => {}, success: () => {}, error: () => {}, info: () => {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastMsg[]>([]);

  const push = useCallback((text: string, kind: ToastMsg['kind'] = 'info') => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev, { id, text, kind }]);
    setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const api = {
    show: push,
    success: (t: string) => push(t, 'success'),
    error: (t: string) => push(t, 'error'),
    info: (t: string) => push(t, 'info'),
  };

  const color = (k: ToastMsg['kind']) =>
    k === 'success'
      ? 'bg-green-600'
      : k === 'error'
      ? 'bg-red-600'
      : 'bg-blue-600';

  return (
    <Ctx.Provider value={api}>
      <div className="fixed top-0 left-0 w-full z-[9999] flex flex-col gap-2 p-2 items-center">
        {items.map((t) => (
          <div
            key={t.id}
            className={`${color(t.kind)} text-white text-center px-4 py-2 rounded shadow text-sm font-medium min-w-[220px]`}
            role="status"
          >
            {t.text}
          </div>
        ))}
      </div>
      {children}
    </Ctx.Provider>
  );
}

export function useToast() {
  return useContext(Ctx);
}
