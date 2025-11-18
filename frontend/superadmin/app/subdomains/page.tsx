'use client';

import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from 'react';
import {
  FiEdit2,
  FiGlobe,
  FiMail,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiX,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useDebounce } from '@/utils/format';
import {
  extractErrorMessage,
  superadminApi,
  type TenantDTO,
  type TenantPayload,
  type TenantStatus,
} from '@/lib/superadminApi';

const STATUS_LABELS: Record<TenantStatus, string> = {
  active: 'نشط',
  pending: 'بانتظار التفعيل',
  suspended: 'معلق',
};

const STATUS_STYLES: Record<TenantStatus, string> = {
  active: 'bg-green-500/10 text-green-500 border-green-500/20',
  pending: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  suspended: 'bg-red-500/10 text-red-500 border-red-500/20',
};

const EMPTY_FORM: TenantPayload = {
  name: '',
  display_name: '',
  subdomain: '',
  contact_email: '',
  logo_url: '',
  status: 'active',
};

type StatusFilter = 'all' | TenantStatus;

export default function TenantsPage() {
  const [tenants, setTenants] = useState<TenantDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 350);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<TenantPayload>(EMPTY_FORM);
  const [editingTenant, setEditingTenant] = useState<TenantDTO | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function fetchTenants() {
      setLoading(true);
      try {
        const items = await superadminApi.tenants.list({
          q: debouncedSearch || undefined,
          status: statusFilter === 'all' ? undefined : statusFilter,
        });
        if (!cancelled) {
          setTenants(items);
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(extractErrorMessage(error, 'تعذر تحميل قائمة المستأجرين'));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    fetchTenants();
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, statusFilter]);

  const stats = useMemo(() => {
    const total = tenants.length;
    const active = tenants.filter((tenant) => tenant.status === 'active').length;
    const pending = tenants.filter((tenant) => tenant.status === 'pending').length;
    return { total, active, pending };
  }, [tenants]);

  const filteredTenants = useMemo(() => {
    if (statusFilter === 'all') return tenants;
    return tenants.filter((tenant) => tenant.status === statusFilter);
  }, [tenants, statusFilter]);

  const resetFilters = () => {
    setStatusFilter('all');
    setSearch('');
  };

  const openModal = (tenant?: TenantDTO) => {
    if (tenant) {
      setEditingTenant(tenant);
      setForm({
        name: tenant.name,
        display_name: tenant.display_name,
        subdomain: tenant.subdomain,
        contact_email: tenant.contact_email,
        logo_url: tenant.logo_url || '',
        status: tenant.status,
      });
    } else {
      setEditingTenant(null);
      setForm(EMPTY_FORM);
    }
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingTenant(null);
    setForm(EMPTY_FORM);
  };

  const handleFormChange = (field: keyof TenantPayload, event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = event.target.value;
    setForm((prev) => ({
      ...prev,
      [field]: field === 'subdomain' ? value.replace(/\s+/g, '-').toLowerCase() : value,
    }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    const payload: TenantPayload = {
      name: form.name.trim(),
      display_name: form.display_name?.trim(),
      subdomain: form.subdomain.trim(),
      contact_email: form.contact_email.trim(),
      logo_url: form.logo_url?.trim() || undefined,
      status: form.status || 'active',
    };

    try {
      if (editingTenant) {
        const updated = await superadminApi.tenants.update(editingTenant.id, payload);
        setTenants((prev) => prev.map((tenant) => (tenant.id === updated.id ? updated : tenant)));
        toast.success('تم تحديث بيانات المستأجر');
      } else {
        const created = await superadminApi.tenants.create(payload);
        setTenants((prev) => [created, ...prev]);
        toast.success('تم إنشاء المستأجر بنجاح');
      }
      closeModal();
    } catch (error) {
      toast.error(extractErrorMessage(error, 'تعذر حفظ بيانات المستأجر'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">إدارة المستأجرين</h1>
          <p className="text-sm text-text-secondary">إدارة المتاجر، النطاقات، وحالات التفعيل من مكان واحد</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => openModal()}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-white transition hover:bg-primary/90"
          >
            <FiPlus size={16} /> مستأجر جديد
          </button>
          <button
            type="button"
            onClick={resetFilters}
            className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm text-text-secondary transition hover:bg-bg-surface-hover"
          >
            <FiRefreshCw size={16} /> إعادة التصفية
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard title="إجمالي المستأجرين" value={stats.total} icon={<FiGlobe />} />
        <StatCard title="النشطون" value={stats.active} icon={<FiGlobe />} accent="text-green-500" />
        <StatCard title="بانتظار التفعيل" value={stats.pending} icon={<FiGlobe />} accent="text-yellow-500" />
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-border bg-bg-surface p-4 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <FiSearch className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary" size={18} />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="ابحث باسم المتجر أو النطاق"
            className="w-full rounded-lg border border-border bg-bg-base py-2 pl-4 pr-10 text-sm focus:border-primary focus:outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
          className="rounded-lg border border-border bg-bg-base px-4 py-2 text-sm focus:border-primary focus:outline-none"
        >
          <option value="all">كل الحالات</option>
          <option value="active">نشط</option>
          <option value="pending">بانتظار التفعيل</option>
          <option value="suspended">معلق</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-bg-surface-alt text-text-secondary">
              <tr>
                <th className="px-4 py-3 text-right font-semibold">المتجر</th>
                <th className="px-4 py-3 text-right font-semibold">النطاق</th>
                <th className="px-4 py-3 text-right font-semibold">التواصل</th>
                <th className="px-4 py-3 text-right font-semibold">الحالة</th>
                <th className="px-4 py-3 text-right font-semibold">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredTenants.map((tenant) => (
                <tr key={tenant.id} className="transition hover:bg-bg-surface-hover">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-text-primary">{tenant.display_name || tenant.name}</p>
                    <p className="text-xs text-text-secondary">{tenant.name}</p>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-text-primary">{tenant.subdomain}</td>
                  <td className="px-4 py-3 text-text-secondary">
                    <span className="inline-flex items-center gap-2">
                      <FiMail size={14} />
                      {tenant.contact_email}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${STATUS_STYLES[tenant.status]}`}>
                      {STATUS_LABELS[tenant.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => openModal(tenant)}
                      className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs text-text-secondary transition hover:border-primary hover:text-primary"
                    >
                      <FiEdit2 size={14} /> تعديل
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && filteredTenants.length === 0 && (
          <div className="p-6 text-center text-sm text-text-secondary">لا توجد نتائج مطابقة</div>
        )}
        {loading && <div className="p-6 text-center text-sm text-text-secondary">جارٍ تحميل المستأجرين...</div>}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="flex w-full max-w-2xl max-h-[90vh] flex-col rounded-2xl border border-border bg-bg-surface shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">
                  {editingTenant ? 'تعديل بيانات المستأجر' : 'إنشاء مستأجر جديد'}
                </h2>
                <p className="text-sm text-text-secondary">
                  {editingTenant ? editingTenant.display_name : 'أدخل بيانات المتجر والنطاق'}
                </p>
              </div>
              <button type="button" onClick={closeModal} className="rounded-lg p-2 text-text-secondary hover:bg-bg-surface-hover">
                <FiX size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField
                  label="الاسم الداخلي"
                  value={form.name}
                  required
                  onChange={(event) => handleFormChange('name', event)}
                />
                <FormField
                  label="الاسم الظاهر"
                  value={form.display_name || ''}
                  required
                  onChange={(event) => handleFormChange('display_name', event)}
                />
                <FormField
                  label="النطاق الفرعي"
                  value={form.subdomain}
                  placeholder="example"
                  helpText="سيظهر كـ example.domain.com"
                  required
                  onChange={(event) => handleFormChange('subdomain', event)}
                />
                <FormField
                  label="البريد الإلكتروني"
                  type="email"
                  value={form.contact_email}
                  required
                  onChange={(event) => handleFormChange('contact_email', event)}
                />
                <FormField
                  label="رابط الشعار"
                  value={form.logo_url || ''}
                  placeholder="https://..."
                  onChange={(event) => handleFormChange('logo_url', event)}
                />
                <div>
                  <label className="mb-1 block text-sm font-medium text-text-primary">الحالة</label>
                  <select
                    value={form.status}
                    onChange={(event) => handleFormChange('status', event)}
                    className="w-full rounded-lg border border-border bg-bg-base px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  >
                    <option value="active">نشط</option>
                    <option value="pending">بانتظار التفعيل</option>
                    <option value="suspended">معلق</option>
                  </select>
                </div>
              </div>
              <div className="mt-6 flex items-center justify-end gap-3 border-t border-border pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg px-4 py-2 text-sm text-text-secondary hover:bg-bg-surface-hover"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-primary px-4 py-2 text-sm text-white transition hover:bg-primary/90 disabled:opacity-60"
                >
                  {saving ? 'جارٍ الحفظ...' : editingTenant ? 'تحديث' : 'إنشاء'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

type StatCardProps = {
  title: string;
  value: number;
  icon: ReactNode;
  accent?: string;
};

function StatCard({ title, value, icon, accent }: StatCardProps) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-bg-surface p-4">
      <div>
        <p className="text-sm text-text-secondary">{title}</p>
        <p className={`text-3xl font-bold text-text-primary ${accent ?? ''}`}>{value}</p>
      </div>
      <div className="rounded-full bg-primary/10 p-3 text-primary">{icon}</div>
    </div>
  );
}

type FormFieldProps = {
  label: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  type?: string;
  placeholder?: string;
  helpText?: string;
};

function FormField({ label, value, onChange, required, type = 'text', placeholder, helpText }: FormFieldProps) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-text-primary">
        {label}
        {required && <span className="mr-1 text-red-500">*</span>}
      </label>
      <input
        type={type}
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={onChange}
        className="w-full rounded-lg border border-border bg-bg-base px-3 py-2 text-sm focus:border-primary focus:outline-none"
      />
      {helpText && <p className="mt-1 text-xs text-text-secondary">{helpText}</p>}
    </div>
  );
}
