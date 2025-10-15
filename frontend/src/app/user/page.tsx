'use client';

import { useEffect, useMemo, useState } from 'react';
import api, { API_ROUTES } from '@/utils/api';
import { useUser } from '@/context/UserContext';

type ServerProfile = {
  id: string;
  email: string;
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  countryCode?: string | null;
  phone?: string | null;        // لبعض النسخ
  phoneNumber?: string | null;  // الاسم الأحدث في الباك
  currencyCode?: string | null; // معلومة إضافية إن لزم
};

// نفس تعريفات الثيم لديك
type ThemeKey = 'light' | 'dark1' | 'dark2' | 'dark3' | 'dark4';
const THEME_ITEMS: { key: ThemeKey; name: string; hintBg: string; hintText: string; hintBorder: string }[] = [
  { key: 'light', name: 'الافتراضي (فاتح)', hintBg: '#ffffff', hintText: '#111827', hintBorder: '#e5e7eb' },
  { key: 'dark1', name: 'Dark 1',            hintBg: '#1f2937', hintText: '#ffffff', hintBorder: '#4b5563' },
  { key: 'dark2', name: 'Dark 2',            hintBg: '#1e293b', hintText: '#ffffff', hintBorder: '#475569' },
  { key: 'dark3', name: 'Dark 3',            hintBg: '#18181b', hintText: '#ffffff', hintBorder: '#3f3f46' },
  { key: 'dark4', name: 'Dark 4',            hintBg: '#309898', hintText: '#ffffff', hintBorder: '#1f6d6d' },
];

export default function UserProfilePage() {
  const { user } = useUser();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>('');

  // بيانات البروفايل من السيرفر حصراً (لا نعتمد على context حتى لا تختفي الحقول)
  const [profile, setProfile] = useState<ServerProfile | null>(null);

  // ====== الثيم (كما هو) ======
  const [theme, setTheme] = useState<ThemeKey>('light');
  const [savingTheme, setSavingTheme] = useState(false);
  const [themeMsg, setThemeMsg] = useState<string | null>(null);

  // فورم تغيير كلمة السر
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPassword2, setNewPassword2] = useState('');
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [pwBusy, setPwBusy] = useState(false);

  // جلب البروفايل من API مباشرة
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr('');
        // نفضّل profile-with-currency إن متاح؛ وإلا نستخدم profile
        const url = (API_ROUTES.users as any).profileWithCurrency || API_ROUTES.users.profile;
        const { data } = await api.get<ServerProfile>(url);
        if (!alive) return;
        setProfile(data);
      } catch (e: any) {
        if (!alive) return;
        setErr('تعذّر جلب بيانات الملف الشخصي');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [user?.id]); // أعد التحميل إن تغيّر المستخدم

  // تجهيز عرض الاسم الكامل والرقم
  const fullName = useMemo(() => {
    if (!profile) return '';
    return (
      profile.fullName ||
      [profile.firstName, profile.lastName].filter(Boolean).join(' ') ||
      ''
    );
  }, [profile]);

  const phoneDisplay = useMemo(() => {
    if (!profile) return '';
    const phoneVal = profile.phoneNumber ?? profile.phone ?? '';
    return [profile.countryCode, phoneVal].filter(Boolean).join(' ');
  }, [profile]);

  // ====== الثيم (كما كان) ======
  useEffect(() => {
    try {
      const el = document.documentElement;
      const fromAttrRaw = (el.getAttribute('data-theme') || '') as string;
      const fromStorageRaw = (localStorage.getItem('theme') || '') as string;

      const allowed = new Set<ThemeKey>(['light', 'dark1', 'dark2', 'dark3', 'dark4']);
      const norm = (v: string): ThemeKey => (v === '' ? 'light' : (allowed.has(v as ThemeKey) ? (v as ThemeKey) : 'light'));

      const initial: ThemeKey = norm(fromStorageRaw || fromAttrRaw || 'light');
      applyTheme(initial, { persist: false });
      setTheme(initial);
    } catch {
      applyTheme('light', { persist: false });
      setTheme('light');
    }
  }, []);

  const applyTheme = (t: ThemeKey, opts: { persist?: boolean } = { persist: true }) => {
    const el = document?.documentElement;
    if (!el) return;
    if (t === 'light') el.removeAttribute('data-theme');
    else el.setAttribute('data-theme', t);

    const meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    if (meta) meta.content = t === 'light' ? '#ffffff' : '#0F1115';

    if (opts.persist) {
      try { localStorage.setItem('theme', t); } catch {}
    }
  };

  const saveThemePref = async (t: ThemeKey) => {
    setTheme(t);
    applyTheme(t, { persist: true });
    try {
      setSavingTheme(true);
      setThemeMsg(null);
      // يمكن لاحقًا إرسال التفضيل للخادم
      setThemeMsg('✅ تم تطبيق المظهر');
    } catch {
      setThemeMsg('❌ لم يتم حفظ التفضيل على الخادم، لكن تم تطبيقه محليًا');
    } finally {
      setSavingTheme(false);
      setTimeout(() => setThemeMsg(null), 2000);
    }
  };

  // يطبّع كلمة السر: يزيل محارف الاتجاه/المسافات الخفية ويحوّل الأرقام العربية إلى لاتينية
  const normalizePassword = (s: string) => {
    if (!s) return '';
    let out = s.replace(/[\u200E\u200F\u202A-\u202E]/g, '').trim();
    const map: Record<string, string> = {
      '٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9',
      '۰':'0','۱':'1','۲':'2','۳':'3','۴':'4','۵':'5','۶':'6','۷':'7','۸':'8','۹':'9',
    };
    out = out.replace(/[٠-٩۰-۹]/g, d => map[d] ?? d);
    return out;
  };


  // إرسال تغيير كلمة السر
  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg(null);

    const old = normalizePassword(oldPassword);
    const neu = normalizePassword(newPassword);
    const neu2 = normalizePassword(newPassword2);

    if (!old || !neu) {
      setPwMsg('❌ الرجاء إدخال كلمة السر الحالية والجديدة');
      return;
    }
    if (neu !== neu2) {
      setPwMsg('❌ كلمتا السر الجديدتان غير متطابقتين');
      return;
    }

    try {
      setPwBusy(true);

      await api.post(API_ROUTES.auth.changePassword, {
        oldPassword: old,
        newPassword: neu,
      });

      setPwMsg('✅ تم تغيير كلمة السر بنجاح');
      setOldPassword('');
      setNewPassword('');
      setNewPassword2('');
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'تعذّر تغيير كلمة السر';
      setPwMsg(`❌ ${Array.isArray(msg) ? msg.join(', ') : msg}`);
    } finally {
      setPwBusy(false);
    }
  };

  return (
    <div className="min-h-[70vh] flex items-start justify-center p-4 bg-bg-base text-text-primary" dir="rtl">
      <div className="w-full max-w-lg card p-6 shadow">
        <h1 className="text-2xl font-semibold mb-6">الملف الشخصي</h1>

        {loading && <div className="text-sm text-text-secondary">جاري تحميل البيانات...</div>}
        {err && <div className="mb-4 text-sm text-danger">{err}</div>}

        {!loading && profile && (
          <div className="space-y-6">

            {/* الاسم والكنية */}
            <div>
              <label className="block mb-1 text-sm text-text-secondary">الاسم والكنية</label>
              <input type="text" value={fullName} disabled className="input w-full bg-bg-input border-border" />
            </div>

            {/* البريد الإلكتروني */}
            <div>
              <label className="block mb-1 text-sm text-text-secondary">البريد الإلكتروني</label>
              <input type="email" value={profile.email || ''} disabled className="input w-full bg-bg-input border-border" />
            </div>

            {/* اسم المستخدم */}
            <div>
              <label className="block mb-1 text-sm text-text-secondary">اسم المستخدم</label>
              <input type="text" value={profile.username || ''} disabled className="input w-full bg-bg-input border-border" />
            </div>

            {/* رقم الجوال مع النداء */}
            <div>
              <label className="block mb-1 text-sm text-text-secondary">رقم الجوال (مع النداء)</label>
              <input
                type="text"
                value={phoneDisplay}
                disabled
                className="input w-full bg-bg-input border-border"
              />
            </div>

            {/* ====== المظهر (كما هو) ====== */}
            <div>
              <label className="block mb-2 text-sm text-text-secondary">المظهر</label>

              <div className="flex flex-wrap items-center gap-3">
                {THEME_ITEMS.map((t) => {
                  const active = t.key === theme;
                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => saveThemePref(t.key)}
                      disabled={savingTheme}
                      className={[
                        'group relative flex items-center gap-3 px-3 py-2 rounded-lg border transition',
                        active ? 'border-primary bg-primary/10' : 'border-border hover:bg-bg-surface-alt',
                      ].join(' ')}
                      aria-pressed={active}
                    >
                      <span
                        className="inline-block w-6 h-6 rounded-full border"
                        style={{
                          background: t.hintBg,
                          borderColor: t.hintBorder,
                          boxShadow: `inset 0 0 0 2px ${t.hintBg === '#ffffff' ? '#f3f4f6' : 'rgba(255,255,255,.06)'}`,
                        }}
                        aria-hidden
                      />
                      <span className={active ? 'text-text-primary font-medium' : 'text-text-primary'}>
                        {t.name}
                      </span>
                      {active && <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary" />}
                    </button>
                  );
                })}
              </div>

              {themeMsg && (
                <div className={`mt-2 text-sm ${themeMsg.startsWith('✅') ? 'text-success' : 'text-warning'}`}>
                  {themeMsg}
                </div>
              )}
            </div>

            {/* ====== تغيير كلمة السر ====== */}
            <div className="pt-2 border-t border-border">
              <h2 className="text-lg font-semibold mb-3">تغيير كلمة السر</h2>
              <form onSubmit={submitPassword} className="space-y-3">
                <div>
                  <label className="block mb-1 text-sm text-text-secondary">كلمة السر الحالية</label>
                  <input
                    type="password"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    className="input w-full bg-bg-input border-border"
                    required
                  />
                </div>
                <div>
                  <label className="block mb-1 text-sm text-text-secondary">كلمة السر الجديدة</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="input w-full bg-bg-input border-border"
                    required
                    minLength={6}
                  />
                </div>
                <div>
                  <label className="block mb-1 text-sm text-text-secondary">تأكيد كلمة السر الجديدة</label>
                  <input
                    type="password"
                    value={newPassword2}
                    onChange={(e) => setNewPassword2(e.target.value)}
                    className="input w-full bg-bg-input border-border"
                    required
                    minLength={6}
                  />
                </div>

                {pwMsg && <div className={`text-sm ${pwMsg.startsWith('✅') ? 'text-success' : 'text-danger'}`}>{pwMsg}</div>}

                <div>
                  <button type="submit" disabled={pwBusy} className="btn btn-primary">
                    حفظ
                  </button>
                </div>
              </form>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
