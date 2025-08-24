'use client';
import { useEffect, useState } from 'react';
import { useUser } from '@/context/UserContext';
import api, { API_ROUTES } from '@/utils/api';
import { usePasskeys } from '@/hooks/usePasskeys';
import { useToast } from '@/context/ToastContext';

interface PasskeyItem { id: string; credentialId: string; label?: string | null; lastUsedAt?: string | null; createdAt: string; }

export default function PasskeyPrompt() {
  const { user } = useUser();
  const { registerPasskey, loading } = usePasskeys();
  const { show } = useToast();
  const [hasPasskey, setHasPasskey] = useState<boolean | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!user) return;
  const dismissedFlag = localStorage.getItem('passkey_prompt_dismissed');
    if (dismissedFlag === '1') { setDismissed(true); }
    (async () => {
      try {
        const res = await api.get<PasskeyItem[]>(API_ROUTES.auth.passkeys.list, { validateStatus: () => true });
        if (res.status === 200) setHasPasskey(res.data.length > 0);
        else setHasPasskey(false);
      } catch { setHasPasskey(false); }
    })();
  }, [user]);

  const hasJwt = typeof window !== 'undefined' ? !!localStorage.getItem('token') : false;
  if (!user || !hasJwt || dismissed || hasPasskey === null || hasPasskey) return null;

  return (
    <div className="fixed bottom-4 right-4 w-80 bg-white dark:bg-gray-800 shadow-xl rounded-lg border border-gray-200 dark:border-gray-700 p-4 z-50">
      <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">أضف مفتاح مرور (Passkey)</h3>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-3 leading-relaxed">زد أمان حسابك وسرعة الدخول بإضافة Passkey مرتبط بجهازك (بصمة / وجه / PIN).</p>
      <div className="flex gap-2">
        <button
          disabled={loading}
          onClick={async () => { try { await registerPasskey('جهازي'); setHasPasskey(true); show('تم إنشاء Passkey'); } catch (e:any) { show(e?.message || 'فشل'); } }}
          className="flex-1 bg-sky-600 text-white text-sm py-2 rounded hover:brightness-110 disabled:opacity-60"
        >{loading ? '...' : 'إنشاء'}</button>
        <button
          onClick={() => { localStorage.setItem('passkey_prompt_dismissed','1'); setDismissed(true); }}
          className="px-3 py-2 text-sm rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
        >لاحقاً</button>
      </div>
    </div>
  );
}
