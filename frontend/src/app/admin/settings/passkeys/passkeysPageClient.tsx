"use client";

import { useEffect, useState, useRef } from "react";
import api, { API_ROUTES } from "@/utils/api";
import { usePasskeys } from "@/hooks/usePasskeys";
import { useToast } from "@/context/ToastContext";
import { useUser } from "@/context/UserContext";
import { useRouter } from "next/navigation";

interface PasskeyItem {
  id: string;
  name: string;
  createdAt: string | null;
  lastUsedAt?: string | null;
}

function normalizePasskeys(data: any): PasskeyItem[] {
  const arr = Array.isArray(data) ? data : data?.items ?? [];
  return arr.map((x: any) => ({
    id: x.id ?? x.credentialId ?? x.credential_id,
    name: x.name ?? x.deviceType ?? x.device_type ?? "Passkey",
    createdAt: x.createdAt ?? x.created_at ?? null,
    lastUsedAt: x.lastUsedAt ?? x.last_used_at ?? null,
  }));
}

export default function PasskeysPageClient() {
  const { user } = useUser();
  const router = useRouter();
  const { registerPasskey, loading: opLoading, error: opError } = usePasskeys();
  const { show } = useToast();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<PasskeyItem[]>([]);
  const [label, setLabel] = useState("");

  const inputRef = useRef<HTMLInputElement | null>(null);
  const [errorShown, setErrorShown] = useState(false);
  const mounted = useRef(false);
  const inFlight = useRef(false);

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }
    if (mounted.current || inFlight.current) return;

    mounted.current = true;
    inFlight.current = true;

    const ctrl = new AbortController();
    const started = Date.now();

    api
      .get<any>(API_ROUTES.auth.passkeys.list, {
        validateStatus: () => true,
        signal: ctrl.signal as any,
      })
      .then((res) => {
        if (res.status === 200) {
          const norm = normalizePasskeys(res.data);
          setItems(norm);
          if (!norm.length) console.log("[passkeys raw]", res.status, res.data);
        } else if (res.status === 401) {
          if (!errorShown) {
            setErrorShown(true);
            show("يرجى تسجيل الدخول");
          }
          router.push("/login");
        }
      })
      .catch((err) => {
        if (!ctrl.signal.aborted && !errorShown) {
          setErrorShown(true);
          console.warn("[Passkeys] load failed", err?.message || err);
        }
      })
      .finally(() => {
        const elapsed = Date.now() - started;
        const remaining = elapsed < 300 ? 300 - elapsed : 0;
        setTimeout(() => {
          setLoading(false);
          inFlight.current = false;
        }, remaining);
      });

    return () => ctrl.abort();
  }, [user, show, router, errorShown]);

  return (
    <div className="admin-container py-4 max-w-3xl">
      <h1 className="text-xl font-bold mb-4">مفاتيح المرور (الأمان)</h1>
      <p className="text-sm text-text-secondary mb-6">
        أدر مفاتيح المرور المرتبطة بحساب المالك. استخدم مفاتيح متعددة لأجهزة
        مختلفة.
      </p>

      <div className="mb-6 flex gap-2 items-end">
        <div className="flex-1">
          <label className="block text-sm font-medium mb-1">تسمية الجهاز</label>
          <input
            ref={inputRef}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="مثال: لابتوب المكتب"
            className="w-full border border-border rounded px-3 py-2 text-sm bg-bg-surface"
          />
        </div>

        <button
          disabled={opLoading || !label.trim()}
          onClick={async () => {
            try {
              await registerPasskey(label || "My device");
              setLabel("");
              show("تم الإنشاء");

              // إعادة التحميل بعد الإنشاء
              mounted.current = false;
              inFlight.current = false;
              setLoading(true);

              const ctrl = new AbortController();
              api
                .get<any>(API_ROUTES.auth.passkeys.list, {
                  validateStatus: () => true,
                  signal: ctrl.signal as any,
                })
                .then((res) => {
                  if (res.status === 200) {
                    const norm = normalizePasskeys(res.data);
                    setItems(norm);
                    if (!norm.length)
                      console.log("[passkeys raw]", res.status, res.data);
                  }
                })
                .finally(() => setLoading(false));
            } catch (e: any) {
              show(e?.message || "فشل");
            }
          }}
          className="bg-primary text-white text-sm px-4 py-2 rounded hover:brightness-110 disabled:opacity-60"
        >
          {opLoading ? "..." : "إنشاء مفتاح"}
        </button>
      </div>

      {opError && (
        <div className="text-red-500 text-xs mt-[-12px] mb-4">{opError}</div>
      )}

      {loading && (
        <div className="animate-pulse space-y-2" aria-busy="true">
          <div className="h-4 bg-bg-surface-alt rounded w-1/3" />
          <div className="h-32 bg-bg-surface-alt rounded" />
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="text-sm text-text-secondary transition-opacity duration-300 opacity-100">
          لا توجد مفاتيح.
        </div>
      )}

      <table className="w-full text-sm border border-border rounded overflow-hidden">
        <thead className="bg-bg-surface-alt">
          <tr>
            <th className="p-2 text-right">الاسم</th>
            <th className="p-2 text-right">تاريخ الإنشاء</th>
            <th className="p-2 text-right">آخر استخدام</th>
            <th className="p-2 text-right">إجراءات</th>
          </tr>
        </thead>
        <tbody
          className={
            loading
              ? "opacity-0"
              : "opacity-100 transition-opacity duration-300"
          }
        >
          {items.map((pk) => (
            <tr key={pk.id} className="border-t border-border">
              <td className="p-2">
                {pk.name || "Passkey"}{" "}
                <span className="text-xs text-text-secondary">
                  #{pk.id?.slice?.(0, 8)}
                </span>
              </td>
              <td className="p-2">
                {pk.createdAt ? new Date(pk.createdAt).toLocaleString() : "—"}
              </td>
              <td className="p-2">
                {pk.lastUsedAt ? new Date(pk.lastUsedAt).toLocaleString() : "—"}
              </td>
              <td className="p-2">
                <button
                  disabled={items.length === 1}
                  onClick={async () => {
                    if (items.length === 1) {
                      show("لا يمكن حذف آخر مفتاح");
                      return;
                    }
                    if (!confirm("حذف هذا المفتاح؟")) return;
                    try {
                      await api.delete(API_ROUTES.auth.passkeys.delete(pk.id));
                      show("تم الحذف");
                      setItems((prev) => prev.filter((r) => r.id !== pk.id));
                    } catch (e: any) {
                      show(e?.message || "فشل");
                    }
                  }}
                  className="text-red-600 hover:underline disabled:opacity-40"
                >
                  حذف
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
