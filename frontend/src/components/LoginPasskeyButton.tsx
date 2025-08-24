"use client";
import { useState } from 'react';
import { usePasskeys } from '@/hooks/usePasskeys';

export default function LoginPasskeyButton({ onSuccess }: { onSuccess?: (data:any)=>void }) {
  const { authenticateWithPasskey, loading, error } = usePasskeys();
  const [emailOrUsername, setEmailOrUsername] = useState('');

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          className="border rounded px-3 py-2 text-sm flex-1"
          placeholder="البريد أو اسم المستخدم"
          value={emailOrUsername}
          onChange={e=>setEmailOrUsername(e.target.value)}
        />
        <button
          disabled={loading || !emailOrUsername}
          onClick={async ()=>{ try { const res = await authenticateWithPasskey(emailOrUsername); onSuccess?.(res); } catch {} }}
          className="bg-neutral-800 text-white px-4 py-2 rounded text-sm disabled:opacity-50"
        >{loading? '...' : 'دخول بمفتاح'}</button>
      </div>
      {error && <div className="text-xs text-red-600">{error}</div>}
    </div>
  );
}
