'use client';

import { useState, useRef, useEffect } from 'react';
import { FiLogOut, FiBell, FiMenu } from 'react-icons/fi';

const themes = [
  { id: 'light', name: 'فاتح', icon: '☀️' },
  { id: 'dark1', name: 'Dark 1', icon: '🌙' },
  { id: 'dark2', name: 'Dark 2', icon: '🌑' },
  { id: 'dark3', name: 'Dark 3', icon: '🌚' },
  { id: 'dark4', name: 'Dark 4', icon: '💙' },
];

interface Props {
  onLogout: () => void | Promise<void>;
  onToggleMobileMenu?: () => void;
  currentUserName?: string;
}

export default function SuperAdminTopBar({ onLogout, onToggleMobileMenu, currentUserName }: Props) {
  const [pending, setPending] = useState(false);
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [currentTheme, setCurrentTheme] = useState('dark1');
  const themeMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const fromAttr = document.documentElement.getAttribute('data-theme');
      const fromLS = localStorage.getItem('theme');
      const initial = fromLS || fromAttr || 'dark1';
      setCurrentTheme(initial);
    } catch {
      setCurrentTheme('dark1');
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (themeMenuRef.current && !themeMenuRef.current.contains(event.target as Node)) {
        setShowThemeMenu(false);
      }
    };

    if (showThemeMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showThemeMenu]);

  const handleThemeChange = (themeId: string) => {
    setCurrentTheme(themeId);
    
    const el = document.documentElement;
    if (themeId === 'light') {
      el.removeAttribute('data-theme');
    } else {
      el.setAttribute('data-theme', themeId);
    }
    
    const meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    if (meta) {
      meta.content = themeId === 'light' ? '#ffffff' : '#0F1115';
    }
    
    try {
      localStorage.setItem('theme', themeId);
    } catch {}
    
    setShowThemeMenu(false);
  };

  const handleLogoutClick = async () => {
    if (pending) return;
    setPending(true);
    try {
      await onLogout();
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="bg-bg-surface border-b border-border shrink-0">
      <div className="flex items-center justify-between gap-4 px-6 py-3">
        {/* اليمين: زر القائمة للموبايل */}
        <div className="flex-1 flex items-center gap-3">
          <button
            onClick={onToggleMobileMenu}
            className="lg:hidden p-2 rounded-lg hover:bg-primary/15 transition text-text-primary cursor-pointer"
            aria-label="فتح القائمة"
          >
            <FiMenu size={24} />
          </button>
        </div>

        {/* الوسط: الإجراءات */}
        <div className="flex items-center gap-2">
          {/* اختيار الثيم */}
          <div className="relative" ref={themeMenuRef}>
            <button
              onClick={() => setShowThemeMenu(!showThemeMenu)}
              className="p-2 rounded-lg hover:bg-primary/15 transition text-xl cursor-pointer"
              title="اختيار الثيم"
            >
              🎨
            </button>
            
            {showThemeMenu && (
              <div className="absolute top-full left-0 mt-2 bg-bg-surface border-2 border-border rounded-lg shadow-xl z-50 min-w-[160px] overflow-hidden">
                {themes.map((theme) => (
                  <button
                    key={theme.id}
                    onClick={() => handleThemeChange(theme.id)}
                    className={`w-full px-4 py-2.5 text-right flex items-center gap-3 hover:bg-bg-surface-hover transition-colors cursor-pointer ${
                      currentTheme === theme.id ? 'bg-primary/10 border-r-4 border-primary' : ''
                    }`}
                  >
                    <span className="text-xl">{theme.icon}</span>
                    <span className="font-medium">{theme.name}</span>
                    {currentTheme === theme.id && (
                      <span className="mr-auto text-primary">✓</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* الإشعارات */}
          <button
            className="relative p-2 rounded-lg hover:bg-primary/15 transition cursor-pointer"
            title="الإشعارات"
          >
            <FiBell size={22} className="text-text-primary" />
            <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>
        </div>

        {/* اليسار: زر الخروج */}
        <div className="flex-1 flex items-center justify-end gap-3">
          {currentUserName && (
            <div className="hidden md:flex flex-col text-right">
              <span className="text-sm font-semibold text-text-primary">{currentUserName}</span>
              <span className="text-xs text-text-secondary">مدير المنصة</span>
            </div>
          )}
          <button
            onClick={handleLogoutClick}
            disabled={pending}
            className="bg-red-600 text-white px-4 py-2 rounded-lg 
                       hover:bg-red-700 transition
                       disabled:opacity-60 disabled:cursor-not-allowed
                       flex items-center gap-2 cursor-pointer"
            title="تسجيل الخروج"
          >
            {pending ? (
              <svg
                className="h-5 w-5 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4A4 4 0 004 12z"/>
              </svg>
            ) : (
              <FiLogOut size={20} />
            )}
            <span className="hidden md:inline">خروج</span>
          </button>
        </div>
      </div>
    </div>
  );
}
