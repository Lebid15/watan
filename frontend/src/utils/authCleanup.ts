// توحيد عملية تنظيف بيانات الاعتماد (توكن + كوكيز + مفاتيح مخزنة)
export function clearAuthArtifacts(options: { keepTheme?: boolean } = {}) {
  try {
    const theme = options.keepTheme ? localStorage.getItem('theme') : null;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('userCurrencyCode');
    // إزالة أي مفاتيح يبدأ اسمها بـ auth_
    Object.keys(localStorage).forEach((k) => {
      if (k.startsWith('auth_')) localStorage.removeItem(k);
    });
    if (options.keepTheme && theme) localStorage.setItem('theme', theme);
  } catch {}
  // حذف الكوكيز الأساسية
  const kill = (name: string) => {
    try {
      document.cookie = `${name}=; Max-Age=0; path=/`;
    } catch {}
  };
  kill('access_token');
  kill('role');
  // لا نحذف tenant_host إلا لو أردت قطع الارتباط بالمستأجر (نتركه افتراضياً)
}

export function hasAccessTokenCookie(): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie.split('; ').some(c => c.startsWith('access_token='));
}
