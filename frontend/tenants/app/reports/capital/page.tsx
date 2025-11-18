'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import api, { API_ROUTES } from '@/utils/api';
import { formatMoney } from '@/utils/format';
import { FiDownload, FiPlus, FiRefreshCcw, FiTrash2 } from 'react-icons/fi';

type AmountRow = {
  currency: string;
  amount: number;
  amountUsd: number;
};

type ProviderItem = {
  id: string;
  name: string;
  provider?: string | null;
  balance: number;
  debt?: number;
  netBalance?: number;
  currency: string;
  balanceUsd: number;
  balanceUpdatedAt?: string | null;
  debtUpdatedAt?: string | null;
};

type AdjustmentItem = {
  id: string;
  label: string;
  currency: string;
  amount: number;
  amountUsd: number;
  note?: string;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type CapitalSummary = {
  rates: Record<string, number>;
  missingRates: string[];
  users: {
    count: number;
    totals: AmountRow[];
    totalUsd: number;
  };
  providers: {
    items: ProviderItem[];
    totals: AmountRow[];
    totalUsd: number;
  };
  adjustments: {
    items: AdjustmentItem[];
    totals: AmountRow[];
    totalUsd: number;
    error?: string | null;
  };
  grandTotalUsd: number;
};

type CurrencyOption = {
  id: string;
  code: string;
  name?: string;
  rate?: number;
  isPrimary?: boolean;
  isActive?: boolean;
};

type PaymentMethod = {
  id: string;
  name: string;
  isActive?: boolean;
  type?: string;
};

type GroupedAdjustments = Record<string, Record<string, AdjustmentItem>>;

const MAX_NOTE_CHARS = 70;

type ApiErrorShape = {
  response?: {
    data?: {
      message?: string;
    } | null;
  };
  message?: string;
};

type SectionCardProps = {
  title: string;
  accentClass?: string;
  bgClass?: string;
  children: ReactNode;
  footer?: ReactNode;
};

function SectionCard({ title, accentClass = '', bgClass = '', children, footer }: SectionCardProps) {
  return (
    <div className={`border border-border/70 rounded-2xl overflow-hidden shadow-sm ${bgClass || 'bg-bg-surface'}`}>
      <div
        className={`px-4 py-2 text-sm font-semibold tracking-wide ${accentClass || 'bg-bg-surface-alt text-text-secondary'}`}
      >
        {title}
      </div>
      <div className="overflow-x-auto">{children}</div>
      {footer ? (
        <div className={`border-t border-border/60 px-4 py-3 text-xs text-text-secondary ${bgClass || 'bg-bg-surface-alt'}`}>
          {footer}
        </div>
      ) : null}
    </div>
  );
}

function normalizeCurrency(code?: string | null) {
  if (!code) return 'USD';
  const value = String(code).trim().toUpperCase();
  return value || 'USD';
}

function normalizeLabel(label?: string | null) {
  if (!label) return '—';
  const value = String(label).trim();
  return value || '—';
}

function extractErrorMessage(error: unknown, fallback: string) {
  if (typeof error === 'string' && error.trim()) return error;
  if (typeof error === 'object' && error !== null) {
    const typed = error as ApiErrorShape;
    const fromResponse = typed.response?.data?.message;
    if (fromResponse) return fromResponse;
    if (typeof typed.message === 'string' && typed.message.trim()) {
      return typed.message;
    }
  }
  return fallback;
}

export default function CapitalReport() {
  const { t } = useTranslation();

  const [summary, setSummary] = useState<CapitalSummary | null>(null);
  const [currencies, setCurrencies] = useState<CurrencyOption[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tableError, setTableError] = useState('');
  const [pendingLabels, setPendingLabels] = useState<string[]>([]);
  const [addingRow, setAddingRow] = useState(false);
  const [newRowLabel, setNewRowLabel] = useState('');
  const [exporting, setExporting] = useState(false);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [savingNoteLabel, setSavingNoteLabel] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<{ label: string; currency: string } | null>(null);
  const [cellDraft, setCellDraft] = useState('');
  const [savingCell, setSavingCell] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const loadSummary = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get(API_ROUTES.admin.reports.capital) as any;
      setSummary((data as any) || null);
    } catch (error: unknown) {
      setError(extractErrorMessage(error, 'فشل تحميل التقرير'));
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  const loadCurrencies = async () => {
    try {
      const { data } = await api.get(API_ROUTES.currencies.base) as any;
      const list: CurrencyOption[] = Array.isArray(data) ? data : [];
      setCurrencies(list);
    } catch {
      setCurrencies([]);
    }
  };

  const loadPaymentMethods = async () => {
    try {
      const { data } = await api.get(API_ROUTES.admin.paymentMethods.base) as any;
      const rows: PaymentMethod[] = Array.isArray(data) ? data : [];
      setPaymentMethods(rows.filter((m) => m?.isActive !== false));
    } catch {
      setPaymentMethods([]);
    }
  };

  useEffect(() => {
    loadCurrencies();
    loadSummary();
    loadPaymentMethods();
  }, []);

  const currencyUniverse = useMemo(() => {
    const codes = new Set<string>();
    codes.add('USD');
    currencies.forEach((c) => {
      if (c?.code) codes.add(normalizeCurrency(c.code));
    });
    if (summary) {
      const userTotals = (summary as any).users?.totals || [];
      const providerItems = (summary as any).providers?.items || [];
      const adjustmentItems = (summary as any).adjustments?.items || [];
      
      userTotals.forEach((row: any) => codes.add(normalizeCurrency(row.currency)));
      providerItems.forEach((item: any) => codes.add(normalizeCurrency(item.currency)));
      adjustmentItems.forEach((item: any) => codes.add(normalizeCurrency(item.currency)));
    }
    return Array.from(codes).sort((a, b) => a.localeCompare(b));
  }, [currencies, summary]);

  const tenantPrimaryCurrency = useMemo(() => {
    const primary = currencies.find((c) => c.isPrimary && c.code);
    if (primary?.code) return normalizeCurrency(primary.code);
    const fallback = currencyUniverse[0];
    return fallback || 'USD';
  }, [currencies, currencyUniverse]);

  const sortedCurrencies = useMemo(() => {
    const list = [...currencyUniverse];
    list.sort((a, b) => {
      if (a === tenantPrimaryCurrency) return -1;
      if (b === tenantPrimaryCurrency) return 1;
      if (a === 'USD') return -1;
      if (b === 'USD') return 1;
      return a.localeCompare(b);
    });
    return list;
  }, [currencyUniverse, tenantPrimaryCurrency]);

  const groupedAdjustments: GroupedAdjustments = useMemo(() => {
    const map: GroupedAdjustments = {};
    const rows = (summary as any)?.adjustments?.items || [];
    rows.forEach((item: any) => {
      const label = normalizeLabel(item.label);
      const currency = normalizeCurrency(item.currency);
      if (!map[label]) map[label] = {};
      map[label][currency] = item;
    });
    return map;
  }, [summary]);

  const paymentMethodNames = useMemo(() => {
    const set = new Set<string>();
    paymentMethods.forEach((m) => {
      const label = normalizeLabel(m?.name);
      if (label !== '—') set.add(label);
    });
    return set;
  }, [paymentMethods]);

  useEffect(() => {
    if (!summary) return;
    setNoteDrafts((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((key) => {
        if (!groupedAdjustments[key] && !pendingLabels.includes(key)) {
          delete next[key];
        }
      });
      Object.entries(groupedAdjustments).forEach(([label, entries]) => {
        const first = Object.values(entries)[0];
        const value = (first?.note || '').slice(0, MAX_NOTE_CHARS);
        next[label] = value;
      });
      return next;
    });
  }, [summary, groupedAdjustments, pendingLabels]);

  useEffect(() => {
    if (!editingCell) return;
    inputRef.current?.focus();
  }, [editingCell]);

  const manualRowLabels = useMemo(() => {
    const labels = new Set<string>();
    Object.keys(groupedAdjustments).forEach((label) => {
      if (!paymentMethodNames.has(label)) labels.add(label);
    });
    pendingLabels.forEach((label) => labels.add(label));
    return Array.from(labels).sort((a, b) => a.localeCompare(b));
  }, [groupedAdjustments, paymentMethodNames, pendingLabels]);

  const paymentMethodRows = useMemo(() => {
    return paymentMethods
      .filter((m) => m?.isActive !== false)
      .map((m) => normalizeLabel(m.name))
      .filter((label, idx, arr) => arr.indexOf(label) === idx)
      .sort((a, b) => a.localeCompare(b));
  }, [paymentMethods]);

  const formatUsd = (value: number) =>
    formatMoney(value, 'USD', { symbolBefore: true, fractionDigits: 2 });

  const displayAmount = (amount: number, currency: string) =>
    formatMoney(amount, currency, {
      withSymbol: true,
      fractionDigits: 2,
      symbolBefore: ['USD', 'EUR'].includes(currency.toUpperCase()),
    });

  const overallPerCurrency = useMemo(() => {
    const map = new Map<string, number>();
    const add = (currency: string, amount: number) => {
      const cur = normalizeCurrency(currency);
      map.set(cur, (map.get(cur) || 0) + (amount || 0));
    };
    ((summary as any)?.users?.totals || []).forEach((row: any) => add(row.currency, row.amount));
    ((summary as any)?.providers?.totals || []).forEach((row: any) => add(row.currency, row.amount));
    ((summary as any)?.adjustments?.totals || []).forEach((row: any) => add(row.currency, row.amount));
    return map;
  }, [summary]);

  const handleStartEdit = (label: string, currency: string, current: number | null) => {
    if (savingCell) return;
    setEditingCell({ label, currency });
    setCellDraft(current !== null && current !== undefined ? String(current) : '');
    setTableError('');
  };

  const handleCancelEdit = () => {
    if (savingCell) return;
    setEditingCell(null);
    setCellDraft('');
  };

  const resolveNote = (label: string) => (noteDrafts[label] || '').slice(0, MAX_NOTE_CHARS);

  const mutateAdjustment = async (opts: {
    label: string;
    currency: string;
    amount: number | null;
  }) => {
    const label = normalizeLabel(opts.label);
    const currency = normalizeCurrency(opts.currency);
    const amount = opts.amount ?? 0;
    const note = resolveNote(label);
    const existing = groupedAdjustments[label]?.[currency];

    if ((amount === 0 || Number.isNaN(amount)) && !existing) {
      return;
    }

    if ((amount === 0 || Number.isNaN(amount)) && existing) {
      await api.delete(API_ROUTES.admin.reports.capitalAdjustments.byId(existing.id));
      return;
    }

    if (existing) {
      await api.put(API_ROUTES.admin.reports.capitalAdjustments.byId(existing.id), {
        label,
        amount,
        currency,
        note: note || undefined,
      });
      return;
    }

    await api.post(API_ROUTES.admin.reports.capitalAdjustments.base, {
      label,
      amount,
      currency,
      note: note || undefined,
    });
  };

  const handleSaveCell = async () => {
    if (!editingCell) return;
    if (savingCell) return;
    const raw = cellDraft.trim();
    const value = raw === '' ? null : Number(raw);
    if (raw !== '' && !Number.isFinite(value as number)) {
      setTableError('القيمة غير صالحة. استخدم أرقاماً فقط.');
      return;
    }
    setSavingCell(true);
    setTableError('');
    try {
      await mutateAdjustment({
        label: editingCell.label,
        currency: editingCell.currency,
        amount: value,
      });
      await loadSummary();
      if (paymentMethodNames.has(editingCell.label)) {
        await loadPaymentMethods();
      }
    } catch (error: unknown) {
      setTableError(extractErrorMessage(error, 'تعذر حفظ القيمة'));
    } finally {
      setSavingCell(false);
      handleCancelEdit();
    }
  };

  const handleCellKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      handleCancelEdit();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      handleSaveCell();
    }
  };

  const submitNewRow = (event: React.FormEvent) => {
    event.preventDefault();
    const label = normalizeLabel(newRowLabel);
    if (label === '—') return;
    if (paymentMethodNames.has(label)) {
      setTableError('اسم الوسيلة موجود بالفعل ضمن وسائل الدفع. اختر تسمية مختلفة.');
      return;
    }
    if (groupedAdjustments[label]) {
      setTableError('هناك صف بنفس الاسم. استخدم اسماً مختلفاً.');
      return;
    }
    setPendingLabels((prev) => (prev.includes(label) ? prev : [...prev, label]));
    setNoteDrafts((prev) => ({ ...prev, [label]: '' }));
    setNewRowLabel('');
    setAddingRow(false);
  };

  const handleRemoveRow = async (label: string) => {
    const confirmed = confirm('سيتم حذف السجل بالكامل. هل أنت متأكد؟');
    if (!confirmed) return;
    const entries = groupedAdjustments[label];
    if (entries) {
      const list = Object.values(entries);
      for (const item of list) {
        try {
          await api.delete(API_ROUTES.admin.reports.capitalAdjustments.byId(item.id));
        } catch {}
      }
    }
    setPendingLabels((prev) => prev.filter((name) => name !== label));
    setNoteDrafts((prev) => {
      const next = { ...prev };
      delete next[label];
      return next;
    });
    await loadSummary();
  };

  const syncRowNote = async (label: string) => {
    const entries = groupedAdjustments[label];
    if (!entries) return;
    const note = resolveNote(label);
    setSavingNoteLabel(label);
    try {
      await Promise.all(
        Object.values(entries).map((item) =>
          api.put(API_ROUTES.admin.reports.capitalAdjustments.byId(item.id), {
            label: normalizeLabel(item.label),
            amount: item.amount,
            currency: normalizeCurrency(item.currency),
            note: note || undefined,
          })
        )
      );
      await loadSummary();
    } catch (error: unknown) {
      setTableError(extractErrorMessage(error, 'تعذر تحديث الملاحظة'));
    } finally {
      setSavingNoteLabel(null);
    }
  };

  const resolveRowAmount = (label: string, currency: string): number | null => {
    const entries = groupedAdjustments[label];
    if (!entries) return null;
    const item = entries[currency];
    if (!item) return null;
    return item.amount;
  };

  const renderTableHead = ({
    noteLabel = `ملاحظة (حتى ${MAX_NOTE_CHARS})`,
    showActions = true,
    actionsLabel = 'العمليات',
    headerClass = 'bg-bg-surface-alt text-text-secondary',
  }: {
    noteLabel?: string;
    showActions?: boolean;
    actionsLabel?: string;
    headerClass?: string;
  } = {}) => (
    <thead className={`text-xs uppercase tracking-wide ${headerClass}`}>
      <tr>
        <th className="px-3 py-2 text-right font-semibold">الجهة</th>
        {sortedCurrencies.map((code) => (
          <th key={`head-${code}`} className="px-3 py-2 text-right font-semibold" dir="ltr">
            {code}
          </th>
        ))}
        <th className="px-3 py-2 text-right font-semibold">{noteLabel}</th>
        {showActions ? (
          <th className="px-3 py-2 text-center font-semibold" style={{ width: '120px' }}>
            {actionsLabel}
          </th>
        ) : null}
      </tr>
    </thead>
  );

  const renderEditableCell = (label: string, currency: string) => {
    const value = resolveRowAmount(label, currency);
    const isEditing = editingCell && editingCell.label === label && editingCell.currency === currency;
    return (
      <td key={`${label}-${currency}`} className="px-3 py-2 border-t border-border/40 text-right" dir="ltr">
        {isEditing ? (
          <input
            ref={inputRef}
            type="number"
            step="0.0001"
            value={cellDraft}
            onChange={(event) => setCellDraft(event.target.value)}
            onBlur={handleSaveCell}
            onKeyDown={handleCellKeyDown}
            className="w-full rounded border border-primary/50 bg-bg-input px-2 py-1 text-sm focus:border-primary focus:outline-none text-right"
            disabled={savingCell}
          />
        ) : (
          <button
            type="button"
            className="w-full text-right hover:text-primary transition-colors"
            onClick={() => handleStartEdit(label, currency, value)}
          >
            {value === null ? <span className="text-text-secondary/60">—</span> : displayAmount(value, currency)}
          </button>
        )}
      </td>
    );
  };

  const renderNoteInput = (label: string) => (
    <td className="px-3 py-2 border-t border-border/40 text-right" key={`${label}-note`}>
      <input
        value={resolveNote(label)}
        onChange={(event) =>
          setNoteDrafts((prev) => ({
            ...prev,
            [label]: event.target.value.slice(0, MAX_NOTE_CHARS),
          }))
        }
        onBlur={() => syncRowNote(label)}
        maxLength={MAX_NOTE_CHARS}
        className="w-full rounded border border-border bg-bg-input px-2 py-1 text-sm focus:border-primary focus:outline-none text-right"
        placeholder="ملاحظة قصيرة"
        disabled={savingNoteLabel === label}
      />
    </td>
  );

  const grandUsd = summary?.grandTotalUsd ?? 0;

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    setError('');
    try {
      const response = await api.get(API_ROUTES.admin.reports.capitalExport, {
        responseType: 'blob',
      }) as any;

      const headers = response.headers as Record<string, string>;
      const contentType = headers?.['content-type'] || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      const blob = new Blob([(response.data as any)], { type: contentType });
      const url = window.URL.createObjectURL(blob);

      const disposition = headers?.['content-disposition'] || '';
      const match = disposition.match(/filename="?([^";]+)"?/i);
      const fallbackName = `capital-report-${new Date().toISOString().slice(0, 10)}.xlsx`;
      const filename = match && match[1] ? match[1] : fallbackName;

      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.URL.revokeObjectURL(url);
    } catch (error: unknown) {
      setError(extractErrorMessage(error, 'تعذر تصدير الجرد إلى إكسل'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="p-4 md:p-6 text-text-primary space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary-hover flex items-center justify-center shadow-lg">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold">جرد رأس المال</h1>
        </div>
        <div className="flex items-center flex-wrap gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 border-border bg-bg-surface hover:bg-bg-surface-hover disabled:opacity-60 font-medium shadow-sm transition-all"
            disabled={loading || exporting}
          >
            <FiDownload className={exporting ? 'animate-pulse' : ''} size={18} />
            {exporting ? 'جاري التصدير...' : 'تصدير Excel'}
          </button>
          <button
            onClick={loadSummary}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 border-border bg-bg-surface hover:bg-bg-surface-hover disabled:opacity-50 font-medium shadow-sm transition-all"
            disabled={loading}
          >
            <FiRefreshCcw className={loading ? 'animate-spin' : ''} size={18} />
            تحديث
          </button>
          {!addingRow && (
            <button
              onClick={() => {
                setAddingRow(true);
                setTableError('');
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-contrast hover:bg-primary-hover font-medium shadow-md transition-all"
            >
              <FiPlus size={18} />
              إضافة صف
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="border border-danger/40 bg-danger/10 text-danger rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {summary && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 rounded-2xl p-5 shadow-lg hover:shadow-xl transition-all">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div className="text-sm font-medium text-text-secondary">إجمالي رأس المال</div>
            </div>
            <div className="text-3xl font-bold text-primary">{formatUsd(grandUsd)}</div>
          </div>

          <div className="border-2 border-success/20 bg-gradient-to-br from-success/5 to-success/10 rounded-2xl p-5 shadow-lg hover:shadow-xl transition-all">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-10 h-10 rounded-lg bg-success/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <div className="text-sm font-medium text-text-secondary">أرصدة المستخدمين</div>
            </div>
            <div className="text-2xl font-bold text-success">{formatUsd((summary as any).users?.totalUsd || 0)}</div>
            <div className="text-xs text-text-secondary mt-2 flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              {(summary as any).users?.count || 0} مستخدم
            </div>
          </div>

          <div className="border-2 border-warning/20 bg-gradient-to-br from-warning/5 to-warning/10 rounded-2xl p-5 shadow-lg hover:shadow-xl transition-all">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-10 h-10 rounded-lg bg-warning/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div className="text-sm font-medium text-text-secondary">أرصدة المزودين</div>
            </div>
            <div className="text-2xl font-bold text-warning">{formatUsd((summary as any).providers?.totalUsd || 0)}</div>
          </div>
        </div>
      )}

      {summary?.missingRates?.length ? (
        <div className="border border-warning/40 bg-warning/10 text-warning-foreground rounded-md px-3 py-2 text-sm">
          {t('capitalReport.missingRates', {
            defaultValue: 'يرجى ضبط أسعار الصرف للعملات التالية قبل اعتماد القيم بالدولار: {{codes}}',
            codes: ((summary as any).missingRates || []).join(', '),
          })}
        </div>
      ) : null}

      {tableError && (
        <div className="border border-danger/40 bg-danger/5 text-danger rounded-md px-3 py-2 text-sm">
          {tableError}
        </div>
      )}

      {loading && (
        <div className="text-center text-text-secondary py-10">
          {t('capitalReport.loading', { defaultValue: 'جاري التحميل...' })}
        </div>
      )}

      {!loading && summary && (
        <div className="space-y-5">
          <SectionCard
            title="المزودون (عرض فقط)"
            accentClass="bg-orange-100/70 text-orange-900 dark:bg-orange-900/40 dark:text-orange-50"
            bgClass="bg-orange-50/30 dark:bg-orange-950/20"
          >
            <table className="min-w-full text-sm">
              {renderTableHead({ 
                noteLabel: 'آخر تحديث', 
                showActions: false,
                headerClass: 'bg-orange-100/70 text-orange-900 dark:bg-orange-900/40 dark:text-orange-50'
              })}
              <tbody>
                {((summary as any).providers?.items || []).map((item: any) => (
                  <tr key={`provider-${item.id}`} className="odd:bg-orange-50/20 even:bg-orange-100/20 dark:odd:bg-orange-950/10 dark:even:bg-orange-900/10">
                    <td className="px-3 py-2 border-t border-border/40 text-right">
                      <div className="font-medium text-text-primary">{item.name}</div>
                      <div className="text-[11px] uppercase text-text-secondary/80">
                        {item.provider || '-'}
                      </div>
                    </td>
                    {sortedCurrencies.map((code) => {
                      const isZnet = item.provider?.toLowerCase() === 'znet';
                      const currencyMatches = code === normalizeCurrency(item.currency);
                      
                      if (!currencyMatches) {
                        return (
                          <td key={`provider-${item.id}-${code}`} className="px-3 py-2 border-t border-border/40 text-right" dir="ltr">
                            <span className="text-text-secondary/60">—</span>
                          </td>
                        );
                      }
                      
                      // عرض خاص لـ ZNET: الرصيد / الدين = المحصلة
                      if (isZnet && (item.debt !== undefined && item.debt !== null && item.debt !== 0)) {
                        return (
                          <td key={`provider-${item.id}-${code}`} className="px-3 py-2 border-t border-border/40 text-right" dir="ltr">
                            <div className="flex flex-col gap-0.5 items-end">
                              <div className="flex items-center gap-1 text-xs">
                                <span className="font-medium">{displayAmount(item.balance, code)}</span>
                                <span className="text-text-secondary/60">/</span>
                                <span className="text-text-secondary/70">{displayAmount(item.debt, code)}</span>
                              </div>
                              <div className="text-xs text-text-secondary/80 border-t border-border/30 pt-0.5">
                                <span className="font-semibold">{displayAmount(item.netBalance || (item.balance - item.debt), code)}</span> :المحصلة
                              </div>
                            </div>
                          </td>
                        );
                      }
                      
                      // عرض عادي للمزودين الآخرين
                      return (
                        <td key={`provider-${item.id}-${code}`} className="px-3 py-2 border-t border-border/40 text-right" dir="ltr">
                          {displayAmount(item.balance, code)}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 border-t border-border/40 text-right text-[11px] text-text-secondary" dir="ltr">
                      {item.balanceUpdatedAt
                        ? item.balanceUpdatedAt.replace('T', ' ').slice(0, 19)
                        : '—'}
                    </td>
                  </tr>
                ))}
                {((summary as any).providers?.items || []).length === 0 && (
                  <tr>
                    <td colSpan={sortedCurrencies.length + 2} className="px-4 py-6 text-center text-text-secondary">
                      {t('capitalReport.emptyProviders', { defaultValue: 'لا توجد بيانات للمزودين' })}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </SectionCard>

          <SectionCard
            title="مجموع أرصدة المستخدمين"
            accentClass="bg-emerald-100/70 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-50"
            bgClass="bg-emerald-50/30 dark:bg-emerald-950/20"
            footer={
              <div className="text-xs">
                {t('capitalReport.cards.usersCount', { defaultValue: 'عدد المستخدمين:' })}{' '}
                <span className="font-medium text-text-primary">{(summary as any).users?.count || 0}</span>
              </div>
            }
          >
            <table className="min-w-full text-sm">
              {renderTableHead({ 
                showActions: false,
                headerClass: 'bg-emerald-100/70 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-50'
              })}
              <tbody>
                <tr className="odd:bg-emerald-50/20 dark:odd:bg-emerald-950/10">
                  <td className="px-3 py-3 border-t border-border/40 font-semibold text-text-primary text-right">
                    {t('capitalReport.cards.usersTitle', { defaultValue: 'أرصدة المستخدمين' })}
                  </td>
                  {sortedCurrencies.map((code) => {
                    const match = ((summary as any).users?.totals || []).find((row: any) => normalizeCurrency(row.currency) === code);
                    return (
                      <td key={`users-${code}`} className="px-3 py-3 border-t border-border/40 font-semibold text-right" dir="ltr">
                        {match ? displayAmount(match.amount, code) : <span className="text-text-secondary/60">—</span>}
                      </td>
                    );
                  })}
                  <td className="px-3 py-3 border-t border-border/40 text-text-secondary text-right" dir="ltr">
                    {formatUsd((summary as any).users?.totalUsd || 0)}
                  </td>
                </tr>
              </tbody>
            </table>
          </SectionCard>

          <SectionCard
            title="وسائل الدفع (قابلة للتعبئة)"
            accentClass="bg-sky-100/70 text-sky-900 dark:bg-sky-900/40 dark:text-sky-50"
            bgClass="bg-sky-50/30 dark:bg-sky-950/20"
          >
            {paymentMethodRows.length === 0 ? (
              <div className="px-4 py-6 text-sm text-text-secondary text-center">
                لا توجد وسائل دفع مفعلّة حالياً.
              </div>
            ) : (
              <table className="min-w-full text-sm">
                {renderTableHead({ 
                  showActions: false,
                  headerClass: 'bg-sky-100/70 text-sky-900 dark:bg-sky-900/40 dark:text-sky-50'
                })}
                <tbody>
                  {paymentMethodRows.map((label) => (
                    <tr key={`payment-${label}`} className="odd:bg-sky-50/20 even:bg-sky-100/20 dark:odd:bg-sky-950/10 dark:even:bg-sky-900/10">
                      <td className="px-3 py-2 border-t border-border/40 font-medium text-text-primary text-right">
                        {label}
                      </td>
                      {sortedCurrencies.map((code) => renderEditableCell(label, code))}
                      {renderNoteInput(label)}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </SectionCard>

          <SectionCard
            title="صفوف يدوية"
            accentClass="bg-violet-100/70 text-violet-900 dark:bg-violet-900/40 dark:text-violet-50"
            bgClass="bg-violet-50/30 dark:bg-violet-950/20"
            footer={
              <div className="space-y-3">
                <p className="text-xs text-text-secondary">
                  استخدم زر "إضافة صف يدوي" أعلاه لإنشاء صف جديد، ثم اكتب القيم مباشرة ضمن الأعمدة.
                </p>
                {addingRow ? (
                  <form className="flex flex-wrap items-center gap-2" onSubmit={submitNewRow}>
                    <input
                      value={newRowLabel}
                      onChange={(event) => setNewRowLabel(event.target.value)}
                      className="flex-1 min-w-[200px] rounded border border-border bg-bg-input px-3 py-2 text-sm"
                      placeholder="اسم الجهة الجديدة"
                      autoFocus
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 rounded bg-primary text-primary-contrast hover:bg-primary-hover"
                    >
                      حفظ الصف
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAddingRow(false);
                        setNewRowLabel('');
                        setTableError('');
                      }}
                      className="px-4 py-2 rounded border border-border bg-bg-surface-alt hover:opacity-90"
                    >
                      إلغاء
                    </button>
                  </form>
                ) : (
                  <p className="text-xs text-text-secondary/80">
                    يمكنك حذف أي صف يدوي عبر زر "حذف" الموجود في العمود الأخير.
                  </p>
                )}
              </div>
            }
          >
            {manualRowLabels.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-text-secondary">
                لا توجد صفوف يدوية بعد.
              </div>
            ) : (
              <table className="min-w-full text-sm">
                {renderTableHead({
                  headerClass: 'bg-violet-100/70 text-violet-900 dark:bg-violet-900/40 dark:text-violet-50'
                })}
                <tbody>
                  {manualRowLabels.map((label) => (
                    <tr key={`manual-${label}`} className="odd:bg-violet-50/20 even:bg-violet-100/20 dark:odd:bg-violet-950/10 dark:even:bg-violet-900/10">
                      <td className="px-3 py-2 border-t border-border/40 font-medium text-text-primary text-right">
                        {label}
                      </td>
                      {sortedCurrencies.map((code) => renderEditableCell(label, code))}
                      {renderNoteInput(label)}
                      <td className="px-3 py-2 border-t border-border/40 text-center">
                        <button
                          onClick={() => handleRemoveRow(label)}
                          className="inline-flex items-center gap-1 rounded border border-danger/40 bg-danger/10 px-3 py-1 text-danger hover:opacity-90"
                        >
                          <FiTrash2 /> حذف
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </SectionCard>

          <SectionCard
            title="الإجمالي حسب العملة"
            accentClass="bg-slate-100/70 text-slate-900 dark:bg-slate-900/40 dark:text-slate-100"
            bgClass="bg-slate-50/30 dark:bg-slate-950/20"
          >
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100/70 text-slate-900 dark:bg-slate-900/40 dark:text-slate-100 text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-3 py-2 text-right font-semibold">العملة</th>
                  <th className="px-3 py-2 text-right font-semibold" dir="ltr">
                    الرصيد
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedCurrencies.map((code) => (
                  <tr key={`overall-${code}`} className="odd:bg-slate-50/20 even:bg-slate-100/20 dark:odd:bg-slate-950/10 dark:even:bg-slate-900/10">
                    <td className="px-3 py-2 border-t border-border/40 font-medium text-right">{code}</td>
                    <td className="px-3 py-2 border-t border-border/40 text-right" dir="ltr">
                      {overallPerCurrency.has(code)
                        ? displayAmount(overallPerCurrency.get(code) || 0, code)
                        : <span className="text-text-secondary/60">—</span>}
                    </td>
                  </tr>
                ))}
                <tr className="bg-slate-100/40 dark:bg-slate-900/30 font-semibold">
                  <td className="px-3 py-2 border-t border-border text-text-primary text-right">USD</td>
                  <td className="px-3 py-2 border-t border-border text-right" dir="ltr">
                    {formatUsd(grandUsd)}
                  </td>
                </tr>
              </tbody>
            </table>
          </SectionCard>
        </div>
      )}
    </div>
  );
}
