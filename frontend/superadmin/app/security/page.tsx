'use client';

import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  FiShield,
  FiKey,
  FiRefreshCw,
  FiCopy,
  FiSmartphone,
  FiClock,
  FiMapPin,
} from 'react-icons/fi';

const seedSessions = [
  { id: 'sess-1', device: 'Chrome • macOS', ip: '176.45.18.10', location: 'Istanbul, TR', lastUsed: 'قبل دقيقة' },
  { id: 'sess-2', device: 'Safari • iPhone 15', ip: '102.65.90.4', location: 'Dubai, AE', lastUsed: 'قبل ساعتين' },
  { id: 'sess-3', device: 'Edge • Windows', ip: '87.120.44.11', location: 'Cairo, EG', lastUsed: 'أمس' },
];

const seedLogs = [
  { id: 'log-1', action: 'تم تفعيل المصادقة الثنائية', time: 'منذ 5 دقائق', ip: '176.45.18.10' },
  { id: 'log-2', action: 'إعادة إنشاء مفتاح الـ API', time: 'منذ 35 دقيقة', ip: '176.45.18.10' },
  { id: 'log-3', action: 'محاولة تسجيل دخول فاشلة', time: 'منذ 12 ساعة', ip: '87.120.44.11' },
];

function maskKey(key: string) {
  if (key.length <= 8) return key;
  return `${key.slice(0, 4)}••••${key.slice(-4)}`;
}

export default function SecurityPage() {
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(true);
  const [apiKey, setApiKey] = useState('sk_live_64bd8f305da74CAD');
  const [revokingSession, setRevokingSession] = useState<string | null>(null);

  const sessions = useMemo(() => seedSessions, []);

  const handleToggle2fa = () => {
    setTwoFactorEnabled((prev) => !prev);
    toast.success(!twoFactorEnabled ? 'تم تفعيل المصادقة الثنائية' : 'تم إيقاف المصادقة الثنائية مؤقتاً');
  };

  const handleCopyKey = async () => {
    try {
      await navigator.clipboard.writeText(apiKey);
      toast.success('تم نسخ المفتاح');
    } catch (error) {
      console.error(error);
      toast.error('تعذر نسخ المفتاح');
    }
  };

  const handleRotateKey = () => {
    const newKey = `sk_live_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    setApiKey(newKey);
    toast.success('تم إصدار مفتاح جديد');
  };

  const handleRevokeSession = async (id: string) => {
    setRevokingSession(id);
    await new Promise((resolve) => setTimeout(resolve, 600));
    setRevokingSession(null);
    toast.success('تم إلغاء الجلسة بنجاح');
  };

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-wider text-text-secondary">الإعدادات</p>
        <h1 className="mt-1 text-2xl font-bold text-text-primary">الأمان والتحكم بالوصول</h1>
        <p className="text-sm text-text-secondary">إدارة المصادقة الثنائية، مفاتيح الـ API والجلسات النشطة للمسؤولين</p>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-bg-surface p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-text-secondary">
                <FiShield /> المصادقة الثنائية (2FA)
              </div>
              <p className="mt-1 text-sm text-text-secondary">حافظ على حساب المشرف آمناً بإضافة خطوة تحقق إضافية</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${twoFactorEnabled ? 'bg-green-500/10 text-green-600' : 'bg-yellow-500/10 text-yellow-600'}`}>
              {twoFactorEnabled ? 'مفعّل' : 'متوقف'}
            </span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={handleToggle2fa}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-primary transition hover:border-primary hover:text-primary"
            >
              {twoFactorEnabled ? 'إيقاف مؤقت' : 'تفعيل الآن'}
            </button>
            <button className="rounded-lg border border-dashed border-border px-4 py-2 text-sm text-text-secondary">
              إعداد تطبيق المصادقة
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-bg-surface p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-text-secondary">
            <FiKey /> مفاتيح الـ API
          </div>
          <p className="mt-1 text-sm text-text-secondary">استخدم المفتاح الحالي للتواصل مع واجهات الإدارة</p>
          <div className="mt-4 flex items-center justify-between rounded-xl border border-border bg-bg-base px-4 py-3 font-mono text-sm">
            <span>{maskKey(apiKey)}</span>
            <div className="flex gap-2">
              <button onClick={handleCopyKey} className="rounded-lg border border-border p-2 hover:border-primary">
                <FiCopy size={16} />
              </button>
              <button onClick={handleRotateKey} className="rounded-lg border border-border p-2 text-primary">
                <FiRefreshCw size={16} />
              </button>
            </div>
          </div>
          <p className="mt-2 text-xs text-text-secondary">لمشاركة صلاحيات محدودة، أنشئ مفتاحاً ثانوياً بصلاحيات مقيدة</p>
        </section>
      </div>

      <section className="rounded-2xl border border-border bg-bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">الجلسات النشطة</h2>
            <p className="text-sm text-text-secondary">تابع الأجهزة المتصلة واحذف أي جلسة مشبوهة</p>
          </div>
          <button className="rounded-lg border border-border px-4 py-2 text-sm text-text-secondary hover:border-primary">إنهاء جميع الجلسات</button>
        </div>
        <div className="mt-4 divide-y divide-border rounded-xl border border-border">
          {sessions.map((session) => (
            <div key={session.id} className="flex flex-col gap-2 p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-semibold text-text-primary">{session.device}</p>
                <p className="text-sm text-text-secondary flex items-center gap-2">
                  <FiMapPin size={14} /> {session.location} • {session.ip}
                </p>
              </div>
              <div className="flex items-center gap-3 text-sm text-text-secondary">
                <FiClock size={14} /> {session.lastUsed}
                <button
                  onClick={() => handleRevokeSession(session.id)}
                  disabled={revokingSession === session.id}
                  className="rounded-lg border border-border px-3 py-1 text-xs text-text-primary transition hover:border-primary disabled:opacity-60"
                >
                  {revokingSession === session.id ? 'جارٍ الإنهاء...' : 'إنهاء الجلسة'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-bg-surface p-5">
        <h2 className="text-lg font-semibold text-text-primary">أحدث الأنشطة</h2>
        <div className="mt-4 space-y-3">
          {seedLogs.map((log) => (
            <div key={log.id} className="rounded-xl border border-border bg-bg-base p-4">
              <div className="flex items-start gap-3">
                <FiSmartphone className="mt-1 text-primary" size={18} />
                <div>
                  <p className="font-semibold text-text-primary">{log.action}</p>
                  <p className="text-sm text-text-secondary">{log.time} • IP {log.ip}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
