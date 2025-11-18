'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FiLock, FiUser, FiShield } from 'react-icons/fi';
import { extractErrorMessage, setSuperAdminToken, superadminApi } from '@/lib/superadminApi';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await superadminApi.login(email.trim(), password);
      setSuperAdminToken(res.token);
      try {
        localStorage.setItem('superadminProfile', JSON.stringify(res.super_admin));
      } catch {
        // ignore profile cache errors
      }
      const next = searchParams.get('next') || '/dashboard';
      router.replace(next);
    } catch (err) {
      setError(extractErrorMessage(err, 'فشل تسجيل الدخول. تحقق من البيانات.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-4">
      <div className="w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-primary to-blue-500 mb-4">
            <FiShield size={40} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            المدير العام
          </h1>
          <p className="text-gray-400">تسجيل الدخول إلى لوحة التحكم</p>
        </div>

        {/* Login Form */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-8 shadow-2xl">
          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                <p className="text-red-500 text-sm text-center">{error}</p>
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-gray-300 text-sm font-medium mb-2">
                البريد الإلكتروني
              </label>
              <div className="relative">
                <FiUser className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pr-10 pl-4 py-3 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-primary transition-colors text-white placeholder-gray-500"
                  placeholder="admin@ahla.com"
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-gray-300 text-sm font-medium mb-2">
                كلمة المرور
              </label>
              <div className="relative">
                <FiLock className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pr-10 pl-4 py-3 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-primary transition-colors text-white placeholder-gray-500"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-primary to-blue-500 text-white py-3 rounded-lg font-medium hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4A4 4 0 004 12z"/>
                  </svg>
                  جارٍ تسجيل الدخول...
                </>
              ) : (
                <>
                  <FiShield size={20} />
                  تسجيل الدخول
                </>
              )}
            </button>
          </form>

          {/* Development Note */}
          <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <p className="text-blue-400 text-xs text-center">
              💡 <strong>وضع التطوير:</strong> يمكنك إدخال أي بيانات للدخول مؤقتاً
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-gray-500 text-sm">
            Ahla Store SuperAdmin Panel v1.0
          </p>
        </div>
      </div>
    </div>
  );
}
