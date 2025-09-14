"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Redirects to /login if no auth token is present.
 * Allows specifying paths that are publicly allowed (default only '/').
 */
export function useAuthRequired(options?: { allowIf?: () => boolean }) {
  const router = useRouter();
  const allowIf = options?.allowIf; // stable reference for dep array
  useEffect(() => {
    // لا تُنفذ على السيرفر
    if (typeof window === 'undefined') return;
    const hasTokenLocal = !!localStorage.getItem('token');
    const hasCookie = typeof document !== 'undefined' && /(?:^|; )access_token=/.test(document.cookie);
    if (hasTokenLocal || hasCookie) return; // authenticated
    if (allowIf && allowIf()) return; // custom allow
    router.replace('/login');
  }, [router, allowIf]);
}
