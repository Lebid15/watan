"use client";
import React from 'react';

export interface EnableToggleButtonProps {
  enabled: boolean | undefined;
  loading?: boolean;
  onToggle: () => void;
  size?: 'sm' | 'md';
  variant?: 'pill' | 'circle'; // circle = أيقونة خضراء/حمراء فقط
  tooltip?: string; // نص اختياري عند الوقوف
}

// Reusable enable/disable pill button
export function EnableToggleButton({ enabled, loading, onToggle, size='sm', variant='pill', tooltip }: EnableToggleButtonProps) {
  if (variant === 'circle') {
    const colorBase = enabled ? 'bg-green-500 shadow-green-500/40' : 'bg-red-500 shadow-red-500/30';
    const dim = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
    return (
      <button
        type="button"
        aria-label={enabled ? 'Disable' : 'Enable'}
        title={tooltip || (enabled ? 'اضغط للتعطيل' : 'اضغط للتفعيل')}
        onClick={onToggle}
        disabled={loading}
        className={`inline-flex items-center justify-center rounded-full ${dim} transition transform ${colorBase} ${loading ? 'opacity-60 cursor-not-allowed' : 'hover:scale-110'} focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500`}
      >
        {loading && (
          <span className="block h-2 w-2 rounded-full bg-white animate-pulse" />
        )}
      </button>
    );
  }
  // pill variant (القديمة)
  const base = enabled ? 'bg-green-600/10 text-green-600 border-green-600/40' : 'bg-gray-500/10 text-gray-500 border-gray-400/30';
  const sz = size === 'sm' ? 'px-3 py-1 text-xs' : 'px-4 py-2 text-sm';
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={loading}
      title={tooltip || (enabled ? 'اضغط للتعطيل' : 'اضغط للتفعيل')}
      className={`${sz} rounded font-medium border transition ${base} ${loading ? 'opacity-60 cursor-not-allowed' : ''}`}
    >
      {loading ? '...' : enabled ? 'Enabled' : 'Disabled'}
    </button>
  );
}

export default EnableToggleButton;
