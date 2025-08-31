"use client";
import { useEffect, useState } from 'react';
import api from '@/utils/api';

interface PriceGroup {
  id: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
}

// Narrow unknown runtime values to PriceGroup
const isPriceGroup = (v: any): v is PriceGroup =>
  !!v && typeof v === 'object' && typeof v.id === 'string' && typeof v.name === 'string';

export default function DistributorPriceGroupsPage() {
  const [groups, setGroups] = useState<PriceGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<any>(null);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r = await api.get('/distributor/price-groups');
        const raw = (r as any)?.data;
        const list: PriceGroup[] = Array.isArray(raw)
          ? raw
          : Array.isArray(raw?.items)
          ? (raw.items as PriceGroup[])
          : [];
        setGroups(list);
      } catch (e: any) {
        setErr(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const create = async () => {
    if (!newName.trim()) return;
    try {
      // Assume API returns the created PriceGroup object directly
      const r = await api.post<PriceGroup>('/distributor/price-groups', {
        name: newName.trim(),
      });
      const created = r.data; // typed as PriceGroup
      if (isPriceGroup(created)) {
        setGroups((g) => [...g, created]);
      }
      setNewName('');
    } catch (e: any) {
      setErr(e);
    }
  };

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-xl font-semibold">Distributor Price Groups</h1>
      {loading && <div>Loading...</div>}
      {err && <div className="text-red-600 text-sm">Failed loading</div>}

      <div className="flex gap-2">
        <input
          className="input input-sm input-bordered"
          placeholder="New group name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button
          onClick={create}
          disabled={!newName.trim()}
          className="btn btn-sm btn-primary"
        >
          Create
        </button>
      </div>

      <table className="w-full text-sm border rounded">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left">#</th>
            <th className="px-3 py-2 text-left">Name</th>
            <th className="px-3 py-2 text-left">Created</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g, i) => (
            <tr key={g.id} className="border-t">
              <td className="px-3 py-2">{i + 1}</td>
              <td className="px-3 py-2">{g.name}</td>
              <td className="px-3 py-2">
                {g.createdAt ? new Date(g.createdAt).toLocaleString() : ''}
              </td>
            </tr>
          ))}
          {!loading && groups.length === 0 && (
            <tr>
              <td
                colSpan={3}
                className="px-3 py-6 text-center text-gray-500"
              >
                No groups
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
