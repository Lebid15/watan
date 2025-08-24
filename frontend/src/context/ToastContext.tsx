'use client';
import { createContext, useCallback, useContext, useState, ReactNode, useEffect } from 'react';

type ToastMsg = { id: number; text: string };
type ToastCtx = { show: (text: string) => void };

const Ctx = createContext<ToastCtx>({ show: () => {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastMsg[]>([]);

  const show = useCallback((text: string) => {
    const id = Date.now();
    setItems((prev) => [...prev, { id, text }]);
    setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, 3000); // ⏱ 3 ثواني
  }, []);

  return (
    <Ctx.Provider value={{ show }}>
      {/* الـ Container أعلى الصفحة */}
      <div className="fixed top-0 left-0 w-full z-[9999]">
        {items.map((t) => (
          <div
            key={t.id}
            className="bg-green-500 text-white text-center py-3 font-semibold shadow"
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
