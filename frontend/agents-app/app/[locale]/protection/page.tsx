'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Shield, Lock, Eye, EyeOff } from 'lucide-react';

export default function ProtectionPage() {
  const t = useTranslations('Protection');
  
  // Two-Factor Authentication State
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  
  // Change Password State
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleToggleTwoFactor = () => {
    setTwoFactorEnabled(!twoFactorEnabled);
    // هنا يمكن إضافة API call لتفعيل/تعطيل المصادقة الثنائية
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    // التحقق من تطابق كلمة السر الجديدة
    if (newPassword !== confirmPassword) {
      alert(t('passwordMismatch'));
      return;
    }
    // هنا يمكن إضافة API call لتغيير كلمة السر
    console.log('Password change requested');
  };

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <h1 className="text-2xl md:text-3xl font-bold text-gold">
        {t('title')}
      </h1>

      {/* Two-Factor Authentication Section */}
      <div className="bg-card/50 backdrop-blur-sm border border-border rounded-lg p-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <div className="w-12 h-12 rounded-full bg-gold/20 flex items-center justify-center">
              <Shield className="w-6 h-6 text-gold" />
            </div>
          </div>
          
          <div className="flex-1 space-y-3">
            <div>
              <h2 className="text-xl font-semibold mb-1">{t('twoFactor.title')}</h2>
              <p className="text-sm text-muted-foreground">
                {t('twoFactor.description')}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleToggleTwoFactor}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                  twoFactorEnabled ? 'bg-green-500' : 'bg-muted'
                }`}
                dir="ltr"
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    twoFactorEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
              <span className="text-sm font-medium">
                {twoFactorEnabled ? t('twoFactor.enabled') : t('twoFactor.disabled')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-border"></div>

      {/* Change Password Section */}
      <div className="bg-card/50 backdrop-blur-sm border border-border rounded-lg p-6">
        <div className="flex items-start gap-4 mb-6">
          <div className="flex-shrink-0">
            <div className="w-12 h-12 rounded-full bg-gold/20 flex items-center justify-center">
              <Lock className="w-6 h-6 text-gold" />
            </div>
          </div>
          
          <div className="flex-1">
            <h2 className="text-xl font-semibold mb-1">{t('changePassword.title')}</h2>
            <p className="text-sm text-muted-foreground">
              {t('changePassword.description')}
            </p>
          </div>
        </div>

        <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
          {/* Current Password */}
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('changePassword.currentPassword')}</label>
            <div className="relative">
              <input
                type={showCurrentPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-4 py-2.5 pr-10 focus:outline-none focus:ring-2 focus:ring-gold/50"
                required
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('changePassword.newPassword')}</label>
            <div className="relative">
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-4 py-2.5 pr-10 focus:outline-none focus:ring-2 focus:ring-gold/50"
                required
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('changePassword.confirmPassword')}</label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-4 py-2.5 pr-10 focus:outline-none focus:ring-2 focus:ring-gold/50"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full bg-card/30 backdrop-blur-sm border border-border hover:bg-card/50 hover:border-gold text-foreground font-semibold py-2.5 px-4 rounded-lg transition-all cursor-pointer"
          >
            {t('changePassword.submit')}
          </button>
        </form>
      </div>
    </div>
  );
}
