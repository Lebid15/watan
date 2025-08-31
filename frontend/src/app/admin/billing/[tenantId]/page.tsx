"use client";
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { adminListInvoices, adminMarkInvoicePaid, getTenantBillingOverview } from '@/utils/billingApi';
import { formatMoney3 } from '@/utils/format';
import { useToast } from '@/context/ToastContext';

interface Invoice {
  id: string;
  periodStart?: string;
  periodEnd?: string;
  amountUsd?: number | string;
  status?: string;
  dueAt?: string;
}

interface BillingOverview {
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  nextDueAt?: string;
}

export default function AdminBillingTenantInvoices() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const [items, setItems] = useState<Invoice[]>([]);
  const [overview, setOverview] = useState<BillingOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<any>(null);
  const [action, setAction] = useState<string>('');
  const toast = useToast();
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const load = () => {
    if (!token) return;
    setLoading(true);
    Promise.all([
      adminListInvoices(token, tenantId),
      getTenantBillingOverview(token).catch(() => null),
    ])
      .then(([inv, ov]: any) => {
        const rawInv = inv?.data;
        const list: Invoice[] = Array.isArray(rawInv)
          ? rawInv
          : Array.isArray(rawInv?.items)
            ? rawInv.items
            : [];
        setItems(list);
        setOverview(ov?.data || null);
      })
      .catch((e: any) => setErr(e))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [tenantId]);

  const mark = async (id: string) => {
    if (!token) return;
    setAction(id);
    try {
      await adminMarkInvoicePaid(token, id);
      toast.show('تم الاعتماد وتفعيل الاشتراك');
      load();
    } finally {
      setAction('');
    }
  };

  return (
    <div className="p-4 text-xs space-y-4">
      <h1 className="font-bold">Tenant {tenantId?.slice(0, 8)}</h1>
      {loading && <div>Loading...</div>}
      {err && <div className="text-red-500">ERR</div>}
      {overview && (
        <div className="bg-bg-surface-alt p-3 rounded border border-border text-xs">
          Period: {overview.currentPeriodStart?.slice(0, 10)} → {overview.currentPeriodEnd?.slice(0, 10)} | Next Due:{' '}
          {overview.nextDueAt?.slice(0, 10) || '-'}
        </div>
      )}
      {!loading && !err && (
        <table className="w-full border border-border">
          <thead className="bg-bg-surface-alt">
            <tr>
              <Th>Period</Th>
              <Th>Amount</Th>
              <Th>Status</Th>
              <Th>Due</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {items.map((inv) => (
              <tr key={inv.id} className="border-t border-border">
                <Td>
                  {inv.periodStart?.slice(0, 10)}→{inv.periodEnd?.slice(0, 10)}
                </Td>
                <Td dir="ltr">{formatMoney3(inv.amountUsd || 0)}</Td>
                <Td>{inv.status}</Td>
                <Td>{inv.dueAt?.slice(0, 10)}</Td>
                <Td>
                  {inv.status === 'open' && (
                    <button
                      disabled={action === inv.id}
                      onClick={() => mark(inv.id)}
                      className="px-2 py-1 bg-primary text-white rounded disabled:opacity-40"
                    >
                      Mark paid
                    </button>
                  )}
                </Td>
              </tr>
            ))}
            {!items.length && (
              <tr>
                <Td colSpan={5} className="text-center py-4 opacity-60">
                  —
                </Td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}

const Th = (p: any) => <th className="text-right p-2 font-medium border-l border-border" {...p} />;
const Td = (p: any) => <td className="p-2 align-top" {...p} />;