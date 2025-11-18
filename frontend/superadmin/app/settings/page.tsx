'use client';

import { useState } from 'react';
import { FiSettings, FiShield, FiDatabase } from 'react-icons/fi';

type Tab = 'general' | 'security' | 'backup';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('general');

  const tabs = [
    { id: 'general' as Tab, name: 'الإعدادات العامة', icon: <FiSettings size={18} /> },
    { id: 'security' as Tab, name: 'الأمان', icon: <FiShield size={18} /> },
    { id: 'backup' as Tab, name: 'النسخ الاحتياطي', icon: <FiDatabase size={18} /> },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-lg font-bold text-text-primary">الإعدادات</h1>
        <p className="text-sm text-text-secondary mt-1">إدارة إعدادات النظام والأمان</p>
      </div>

      {/* Tabs */}
      <div className="bg-bg-surface border border-border rounded-xl overflow-hidden">
        {/* Tab Headers */}
        <div className="flex border-b border-border overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-4 font-medium transition-all whitespace-nowrap cursor-pointer ${
                activeTab === tab.id
                  ? 'text-primary border-b-2 border-primary bg-primary/5'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-base'
              }`}
            >
              {tab.icon}
              {tab.name}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'general' && (
            <div>
              <h2 className="text-base font-semibold text-text-primary mb-4">الإعدادات العامة</h2>
              <p className="text-sm text-text-secondary">محتوى الإعدادات العامة سيتم إضافته هنا</p>
            </div>
          )}

          {activeTab === 'security' && (
            <div>
              <h2 className="text-base font-semibold text-text-primary mb-4">إعدادات الأمان</h2>
              <p className="text-sm text-text-secondary">محتوى إعدادات الأمان سيتم إضافته هنا</p>
            </div>
          )}

          {activeTab === 'backup' && (
            <div>
              <h2 className="text-base font-semibold text-text-primary mb-4">النسخ الاحتياطي</h2>
              <p className="text-sm text-text-secondary">محتوى النسخ الاحتياطي سيتم إضافته هنا</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
