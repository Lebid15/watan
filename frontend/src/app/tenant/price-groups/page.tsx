"use client";
import React, { useEffect, useState } from 'react';
import api, { API_ROUTES } from '@/utils/api';

interface PriceGroup {
  id: string;
  name: string;
  description?: string;
}

export default function TenantPriceGroupsPage() {
  const [groups, setGroups] = useState<PriceGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<any>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const isPriceGroup = (v: any): v is PriceGroup =>
    !!v && typeof v === 'object' && typeof v.id === 'string' && typeof v.name === 'string';

  const normalize = (raw: unknown): PriceGroup[] => {
    if (Array.isArray(raw)) return raw.filter(isPriceGroup);
    if (raw && typeof raw === 'object' && Array.isArray((raw as any).items))
      return (raw as any).items.filter(isPriceGroup);
    return [];
  };

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get(API_ROUTES.priceGroups.base);
        setGroups(normalize((r as any)?.data));
      } catch (e: any) {
        setErr(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const create = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const r = await api.post(API_ROUTES.priceGroups.create, {
        name: newName.trim(),
      });
      setGroups((g) => [...g, r.data]);
      setNewName('');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Price Groups</h1>
      <div className="flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New group name"
          className="px-2 py-1 rounded bg-bg-surface-alt border border-border text-sm"
        />
        <button
          disabled={creating}
          onClick={create}
          className="btn btn-sm btn-primary"
        >
          Create
        </button>
      </div>
      {loading && <div>Loading...</div>}
      {err && <div className="text-danger text-sm">Failed loading</div>}
      <ul className="space-y-2">
        {groups.map((g) => (
          <li
            key={g.id}
            className="p-3 border border-border rounded bg-bg-surface-alt text-sm flex justify-between"
          >
            <span>{g.name}</span>
            <span className="opacity-50">{g.description || ''}</span>
          </li>
        ))}
        {!loading && groups.length === 0 && (
          <li className="opacity-60 text-xs">No groups</li>
        )}
      </ul>
    </div>
  );
}
