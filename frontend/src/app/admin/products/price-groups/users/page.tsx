// src/app/admin/users/link-users-prices/page.tsx
'use client';

import { useEffect, useState } from 'react';
import api, { API_ROUTES } from '@/utils/api';

interface PriceGroup {
  id: string;
  name: string;
}

interface User {
  id: string;
  email: string; // محفوظ لكن لن يُعرض الآن
  username?: string | null;
  priceGroupId?: string | null;
}

export default function LinkUsersPricesPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<PriceGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const fetchUsers = async (): Promise<User[]> => {
    const res = await api.get<any[]>(API_ROUTES.users.withPriceGroup);
    return res.data
      .map((u) => ({
        id: u.id,
        email: u.email,
        username: u.username ?? u.userName ?? null,
        priceGroupId: u.priceGroup?.id ?? null,
      }))
      .sort((a, b) => {
        const an = (a.username || a.email || '').toLowerCase();
        const bn = (b.username || b.email || '').toLowerCase();
        return an.localeCompare(bn, 'ar');
      });
  };

  const fetchGroups = async (): Promise<PriceGroup[]> => {
    const res = await api.get<PriceGroup[]>(API_ROUTES.priceGroups.base);
    return res.data;
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      window.location.href = '/login';
      return;
    }

    Promise.all([fetchUsers(), fetchGroups()])
      .then(([usersData, groupsData]) => {
        setUsers(usersData);
        setGroups(groupsData);
        setLoading(false);
      })
      .catch((err) => {
        console.error('خطأ أثناء جلب البيانات:', err);
        if (err.response?.status === 401) {
          localStorage.removeItem('token');
          window.location.href = '/login';
        } else {
          setError('حدث خطأ أثناء تحميل البيانات.');
          setLoading(false);
        }
      });
  }, []);

  const handleChangeGroup = async (userId: string, newGroupId: string | null) => {
    try {
      await api.patch(`/users/${userId}/price-group`, { priceGroupId: newGroupId });

      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, priceGroupId: newGroupId } : u)),
      );
    } catch (err) {
      console.error('خطأ أثناء تحديث مجموعة السعر:', err);
      alert('فشل تحديث مجموعة السعر للمستخدم.');
    }
  };

  if (loading) return <div className="p-4 text-text-primary">جاري التحميل...</div>;
  if (error) return <div className="p-4 text-danger">{error}</div>;

  const searchLower = search.trim().toLowerCase();
  const filteredUsers = !searchLower
    ? users
    : users.filter(u =>
        (u.username || '').toLowerCase().includes(searchLower) ||
        (u.email || '').toLowerCase().includes(searchLower)
      );

  return (
    <div className="p-4 min-h-screen bg-bg-base text-text-primary">
      <h1 className="text-xl font-bold mb-4">ربط المستخدمين بمجموعات الأسعار</h1>

      <div className="mb-4 flex items-center gap-2">
        <input
          type="text"
          className="input w-72 bg-bg-input border border-border"
          placeholder="ابحث باسم المستخدم أو البريد..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="btn btn-secondary text-sm"
          >مسح</button>
        )}
      </div>

      <div className="overflow-x-auto bg-bg-surface rounded-xl border border-border">
        <table className="min-w-full text-right">
          <thead className="bg-bg-surface-alt text-text-secondary">
            <tr>
              <th className="px-3 py-2 border-b border-border font-medium">المستخدم</th>
              <th className="px-3 py-2 border-b border-border font-medium">مجموعة السعر</th>
            </tr>
          </thead>

          <tbody>
            {filteredUsers.map((user) => (
              <tr key={user.id} className="hover:bg-bg-surface-alt/60 transition-colors">
                <td className="px-3 py-2 border-b border-border">{user.username || user.email}</td>
                <td className="px-3 py-2 border-b border-border">
                  <select
                    className="min-w-[220px] rounded bg-bg-input border border-border p-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                    value={user.priceGroupId || ''}
                    onChange={(e) => handleChangeGroup(user.id, e.target.value || null)}
                  >
                    <option value="">لا يوجد</option>
                    {groups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
