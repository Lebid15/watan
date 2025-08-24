// src/app/admin/subdomains/page.tsx
'use client';

import { useEffect, useState } from 'react';
import api, { API_BASE_URL } from '@/utils/api';

type Tenant = {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  createdAt: string;
  ownerUserId?: string | null;
};
type Domain = {
  id: string;
  domain: string;
  type: 'subdomain' | 'custom';
  isPrimary: boolean;
  isVerified: boolean;
};
type CreateTenantResp = {
  tenant: Tenant;
  defaultDomain?: string;
  ownerEmail?: string | null;
  ownerTempPassword?: string | undefined;
};

export default function SubdomainsPage() {
  const [items, setItems] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);

  // إنشاء متجر
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: '',
    code: '',
    ownerEmail: '',
    ownerName: '',
  });
  const [lastCreated, setLastCreated] = useState<{
    email?: string;
    password?: string;
    domain?: string;
    name?: string;
  } | null>(null);

  // النطاقات
  const [domains, setDomains] = useState<Record<string, Domain[]>>({});
  const [newDomain, setNewDomain] = useState<{
    tenantId: string;
    type: 'subdomain' | 'custom';
    domain: string;
  } | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const { data } = await api.get<Tenant[]>(`${API_BASE_URL}/admin/tenants`);
      setItems(data);
    } finally {
      setLoading(false);
    }
  };

  const loadDomains = async (tenantId: string) => {
    const { data } = await api.get<Domain[]>(
      `${API_BASE_URL}/admin/tenants/${tenantId}/domains`,
    );
    setDomains((m) => ({ ...m, [tenantId]: data }));
  };

  useEffect(() => {
    refresh();
  }, []);

  async function createTenant() {
    if (!form.name || !form.code) return alert('أدخل الاسم والكود');
    setCreating(true);
    try {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim().toLowerCase(),
        ownerEmail: form.ownerEmail.trim() || undefined,
        ownerName: form.ownerName.trim() || undefined,
      };
      const { data } = await api.post<CreateTenantResp>(
        `${API_BASE_URL}/admin/tenants`,
        payload,
      );
      setForm({ name: '', code: '', ownerEmail: '', ownerName: '' });
      setLastCreated({
        email: data.ownerEmail || undefined,
        password: data.ownerTempPassword,
        domain: data.defaultDomain,
        name: data.tenant?.name,
      });
      await refresh();
    } catch (e: any) {
      alert(e?.response?.data?.message || 'فشل الإنشاء');
    } finally {
      setCreating(false);
    }
  }

  async function addDomain() {
    if (!newDomain) return;
    if (!newDomain.domain.trim()) return alert('أدخل اسم النطاق');
    try {
      await api.post(
        `${API_BASE_URL}/admin/tenants/${newDomain.tenantId}/domains`,
        {
          domain: newDomain.domain.trim(),
          type: newDomain.type,
          isPrimary: true,
        },
      );
      const id = newDomain.tenantId;
      setNewDomain(null);
      await loadDomains(id);
    } catch (e: any) {
      alert(e?.response?.data?.message || 'فشل إضافة النطاق');
    }
  }

  async function setPrimary(tenantId: string, domainId: string) {
    await api.patch(
      `${API_BASE_URL}/admin/tenants/${tenantId}/domains/${domainId}`,
      { isPrimary: true },
    );
    await loadDomains(tenantId);
  }

  // 🔗 مساعد لتوليد URL صالح للنطاق (يدعم بيئة dev بنفس البروتوكول/البورت)
  function asUrl(domain: string) {
    const hasScheme = /^https?:\/\//i.test(domain);
    if (hasScheme) return domain;
    if (typeof window !== 'undefined') {
      const { protocol, port } = window.location;
      const portPart = port ? `:${port}` : '';
      return `${protocol}//${domain}${portPart}`;
    }
    return `http://${domain}`;
  }

    async function resetOwnerPassword(tenantId: string) {
    try {
      const { data } = await api.post<{
        ownerEmail?: string;
        ownerTempPassword?: string;
      }>(`${API_BASE_URL}/admin/tenants/${tenantId}/reset-owner-password`, {});
      if (data?.ownerTempPassword) {
        alert(
          `تم إعادة تعيين كلمة المرور للمشرف:\nEmail: ${data?.ownerEmail}\nPassword: ${data.ownerTempPassword}`,
        );
      } else {
        alert('تمت إعادة التعيين. (لن تظهر كلمة المرور في بيئة الإنتاج)');
      }
    } catch (e: any) {
      alert(e?.response?.data?.message || 'فشل إعادة تعيين كلمة المرور');
    }
  }


  return (
    <div className="p-4 space-y-6">
      <h1 className="text-2xl font-bold">Subdomains / المتاجر</h1>

      {/* إنشاء متجر جديد */}
      <div className="bg-white rounded-xl p-4 shadow">
        <h2 className="font-semibold mb-3">إنشاء متجر جديد</h2>

        <div className="flex flex-col sm:flex-row gap-3">
          <input
            className="border rounded p-2 w-full"
            placeholder="اسم المتجر"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            className="border rounded p-2 w-full"
            placeholder="الكود (للـ subdomain)"
            value={form.code}
            onChange={(e) =>
              setForm({ ...form, code: e.target.value.toLowerCase() })
            }
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mt-3">
          <input
            className="border rounded p-2 w-full"
            placeholder="بريد مالك المتجر (Admin)"
            value={form.ownerEmail}
            onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })}
          />
          <input
            className="border rounded p-2 w-full"
            placeholder="اسم المالك (اختياري)"
            value={form.ownerName}
            onChange={(e) => setForm({ ...form, ownerName: e.target.value })}
          />
          <button
            className="bg-black text-white rounded px-4"
            onClick={createTenant}
            disabled={creating}
          >
            {creating ? '...' : 'إنشاء'}
          </button>
        </div>

        {lastCreated && (
          <div className="mt-3 text-sm bg-green-50 border border-green-200 rounded p-3">
            <div>تم الإنشاء ✅</div>
            {lastCreated.name && (
              <div>
                المتجر: <b>{lastCreated.name}</b>
              </div>
            )}
            {lastCreated.domain && (
              <div>
                النطاق الافتراضي:{' '}
                <a
                  className="text-blue-600 underline"
                  href={asUrl(lastCreated.domain)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {lastCreated.domain}
                </a>
              </div>
            )}
            {lastCreated.email && (
              <div>
                مشرف المتجر: <b>{lastCreated.email}</b>
              </div>
            )}
            {lastCreated.password && (
              <div>
                كلمة السر المؤقتة (Dev فقط){' '}
                <code className="px-1.5 py-0.5 rounded bg-white border">
                  {lastCreated.password}
                </code>
              </div>
            )}
          </div>
        )}
      </div>

      {/* قائمة المتاجر */}
      <div className="bg-white rounded-xl p-4 shadow">
        <h2 className="font-semibold mb-3">كل المتاجر</h2>
        {loading ? (
          <div>Loading...</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-right border-b">
                <th className="py-2">الاسم</th>
                <th>الكود</th>
                <th>النطاقات</th>
                <th>إضافة نطاق</th>
                <th>إدارة</th>
              </tr>
            </thead>
            <tbody>
              {items.map((t) => (
                <tr key={t.id} className="border-b align-top">
                  <td className="py-2">{t.name}</td>
                  <td>{t.code}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <button
                        className="underline"
                        onClick={() => loadDomains(t.id)}
                      >
                        تحديث
                      </button>
                      <span className="text-xs text-gray-500">
                        ({(domains[t.id] || []).length})
                      </span>
                    </div>
                    <ul className="mt-2 space-y-1">
                      {(domains[t.id] || []).map((d) => (
                        <li key={d.id} className="flex items-center gap-2">
                          {/* 🔗 عرض الدومين كرابط يفتح في تبويب جديد */}
                          <a
                            className="text-blue-600 underline"
                            href={asUrl(d.domain)}
                            target="_blank"
                            rel="noreferrer"
                            title={d.type === 'custom' ? 'Custom Domain' : 'Subdomain'}
                          >
                            {d.domain}
                          </a>
                          {d.isPrimary && (
                            <span className="text-xs px-2 py-0.5 bg-green-100 rounded">
                              Primary
                            </span>
                          )}
                          {!d.isPrimary && (
                            <button
                              className="text-xs underline"
                              onClick={() => setPrimary(t.id, d.id)}
                            >
                              اجعله أساسيًا
                            </button>
                          )}
                          {!d.isVerified && (
                            <span className="text-xs px-2 py-0.5 bg-yellow-100 rounded">
                              غير مُتحقق
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td>
                    {newDomain?.tenantId === t.id ? (
                      <div className="flex flex-col sm:flex-row gap-2">
                        <select
                          className="border rounded p-2"
                          value={newDomain.type}
                          onChange={(e) =>
                            setNewDomain({
                              ...newDomain!,
                              type: e.target.value as any,
                            })
                          }
                        >
                          <option value="subdomain">Subdomain</option>
                          <option value="custom">Custom</option>
                        </select>
                        <input
                          className="border rounded p-2"
                          placeholder="domain أو sub.example.com"
                          value={newDomain.domain}
                          onChange={(e) =>
                            setNewDomain({
                              ...newDomain!,
                              domain: e.target.value,
                            })
                          }
                        />
                        <button
                          className="bg-black text-white rounded px-3"
                          onClick={addDomain}
                        >
                          إضافة
                        </button>
                        <button
                          className="rounded px-3 border"
                          onClick={() => setNewDomain(null)}
                        >
                          إلغاء
                        </button>
                      </div>
                    ) : (
                      <button
                        className="rounded px-3 border"
                        onClick={() =>
                          setNewDomain({
                            tenantId: t.id,
                            type: 'subdomain',
                            domain: '',
                          })
                        }
                      >
                        + نطاق
                      </button>
                    )}
                  </td>
                  <td>
                    <button
                      className="rounded px-3 py-1 border text-xs"
                      onClick={() => resetOwnerPassword(t.id)}
                      title="إعادة تعيين كلمة مرور مالك المتجر"
                    >
                      إعادة تعيين باسورد المالك
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td className="py-6 text-center" colSpan={5}>
                    لا توجد متاجر بعد
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
