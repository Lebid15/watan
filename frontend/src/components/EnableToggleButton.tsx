"use client";
import React from 'react';

export interface EnableToggleButtonProps {
  enabled: boolean | undefined;
  loading?: boolean;
  onToggle: () => void;
  size?: 'sm' | 'md';
}

// Reusable enable/disable pill button
export function EnableToggleButton({ enabled, loading, onToggle, size='sm' }: EnableToggleButtonProps) {
  const base = enabled ? 'bg-green-600/10 text-green-600 border-green-600/40' : 'bg-gray-500/10 text-gray-500 border-gray-400/30';
  const sz = size === 'sm' ? 'px-3 py-1 text-xs' : 'px-4 py-2 text-sm';
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={loading}
      className={`${sz} rounded font-medium border transition ${base} ${loading ? 'opacity-60 cursor-not-allowed' : ''}`}
    >
      {loading ? '...' : enabled ? 'Enabled' : 'Disabled'}
    </button>
  );
}

export default EnableToggleButton;
