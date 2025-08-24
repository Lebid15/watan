"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Redirects to /login if no auth token is present.
 * Allows specifying paths that are publicly allowed (default only '/').
 */
export function useAuthRequired(options?: { allowIf?: () => boolean }) {
  const router = useRouter();
  useEffect(() => {
    const hasTokenLocal = typeof window !== 'undefined' && !!localStorage.getItem('token');
    const hasCookie = typeof document !== 'undefined' && /(?:^|; )access_token=/.test(document.cookie);
    if (hasTokenLocal || hasCookie) return; // authenticated
    if (options?.allowIf && options.allowIf()) return; // custom allow
    router.replace('/login');
  }, [router, options]);
}
