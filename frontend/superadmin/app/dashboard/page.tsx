'use client';

import { useEffect, useState } from 'react';
import {
  FiGlobe,
  FiDollarSign,
  FiShoppingCart,
  FiTrendingUp,
  FiUsers,
  FiPackage,
  FiActivity,
  FiAlertCircle,
  FiBell,
} from 'react-icons/fi';

interface StatCard {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  change?: string;
  changeType?: 'up' | 'down';
  color: string;
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<StatCard[]>([
    {
      title: 'المستأجرون النشطون',
      value: 24,
      icon: <FiGlobe size={28} />,
      change: '+12%',
      changeType: 'up',
      color: 'from-blue-500 to-blue-600',
    },
    {
      title: 'إجمالي الإيرادات',
      value: '$48,500',
      icon: <FiDollarSign size={28} />,
      change: '+24%',
      changeType: 'up',
      color: 'from-green-500 to-green-600',
    },
    {
      title: 'الطلبات الكلية',
      value: '1,248',
      icon: <FiShoppingCart size={28} />,
      change: '+8%',
      changeType: 'up',
      color: 'from-purple-500 to-purple-600',
    },
    {
      title: 'المنتجات العالمية',
      value: 156,
      icon: <FiPackage size={28} />,
      change: '+5',
      changeType: 'up',
      color: 'from-orange-500 to-orange-600',
    },
  ]);

  const [recentActivity, setRecentActivity] = useState([
    { id: 1, type: 'tenant', message: 'تم إنشاء مستأجر جديد: shop.ahla.com', time: 'منذ 5 دقائق', icon: <FiGlobe />, color: 'text-blue-500' },
    { id: 2, type: 'payment', message: 'دفعة جديدة من: المتجر الأول - $200', time: 'منذ 15 دقيقة', icon: <FiDollarSign />, color: 'text-green-500' },
    { id: 3, type: 'product', message: 'تم إضافة منتج عالمي: PUBG UC', time: 'منذ ساعة', icon: <FiPackage />, color: 'text-purple-500' },
    { id: 4, type: 'error', message: 'خطأ في النظام: Database connection timeout', time: 'منذ ساعتين', icon: <FiAlertCircle />, color: 'text-red-500' },
  ]);

  useEffect(() => {
    // محاكاة تحميل البيانات
    const timer = setTimeout(() => setLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-text-secondary">جارٍ تحميل البيانات...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-500">
            لوحة المعلومات
          </h1>
          <p className="text-text-secondary mt-1">نظرة عامة على النظام</p>
        </div>
        <div className="text-sm text-text-secondary">
          آخر تحديث: {new Date().toLocaleString('ar-EG')}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <div
            key={index}
            className="bg-bg-surface border border-border rounded-xl p-6 hover:shadow-lg transition-all duration-300 hover:scale-105"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-lg bg-gradient-to-br ${stat.color} text-white shadow-lg`}>
                {stat.icon}
              </div>
              {stat.change && (
                <div className={`flex items-center gap-1 text-sm font-medium ${
                  stat.changeType === 'up' ? 'text-green-500' : 'text-red-500'
                }`}>
                  <FiTrendingUp className={stat.changeType === 'down' ? 'rotate-180' : ''} />
                  {stat.change}
                </div>
              )}
            </div>
            <h3 className="text-2xl font-bold text-text-primary mb-1">{stat.value}</h3>
            <p className="text-text-secondary text-sm">{stat.title}</p>
          </div>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="bg-bg-surface border border-border rounded-xl p-6">
          <h2 className="text-xl font-bold text-text-primary mb-4 flex items-center gap-2">
            <FiActivity className="text-primary" />
            النشاط الأخير
          </h2>
          <div className="space-y-4">
            {recentActivity.map((activity) => (
              <div
                key={activity.id}
                className="flex items-start gap-3 p-3 rounded-lg hover:bg-bg-surface-hover transition-colors"
              >
                <div className={`p-2 rounded-lg bg-bg-surface-alt ${activity.color}`}>
                  {activity.icon}
                </div>
                <div className="flex-1">
                  <p className="text-text-primary text-sm">{activity.message}</p>
                  <p className="text-text-secondary text-xs mt-1">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-bg-surface border border-border rounded-xl p-6">
          <h2 className="text-xl font-bold text-text-primary mb-4 flex items-center gap-2">
            <FiActivity className="text-primary" />
            إجراءات سريعة
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <button className="p-4 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-all group">
              <FiGlobe className="text-primary mb-2 group-hover:scale-110 transition-transform" size={24} />
              <p className="text-text-primary font-medium text-sm">إضافة مستأجر</p>
            </button>
            <button className="p-4 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-all group">
              <FiPackage className="text-primary mb-2 group-hover:scale-110 transition-transform" size={24} />
              <p className="text-text-primary font-medium text-sm">إضافة منتج</p>
            </button>
            <button className="p-4 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-all group">
              <FiBell className="text-primary mb-2 group-hover:scale-110 transition-transform" size={24} />
              <p className="text-text-primary font-medium text-sm">إرسال إشعار</p>
            </button>
            <button className="p-4 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-all group">
              <FiActivity className="text-primary mb-2 group-hover:scale-110 transition-transform" size={24} />
              <p className="text-text-primary font-medium text-sm">مراقبة النظام</p>
            </button>
          </div>
        </div>
      </div>

      {/* System Health */}
      <div className="bg-bg-surface border border-border rounded-xl p-6">
        <h2 className="text-xl font-bold text-text-primary mb-4 flex items-center gap-2">
          <FiActivity className="text-primary" />
          صحة النظام
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
              <div>
                <p className="text-green-500 font-medium">API Server</p>
                <p className="text-text-secondary text-xs">يعمل بشكل طبيعي</p>
              </div>
            </div>
          </div>
          <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
              <div>
                <p className="text-green-500 font-medium">Database</p>
                <p className="text-text-secondary text-xs">متصل - استجابة 15ms</p>
              </div>
            </div>
          </div>
          <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-yellow-500 animate-pulse"></div>
              <div>
                <p className="text-yellow-500 font-medium">Storage</p>
                <p className="text-text-secondary text-xs">75% مستخدم</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
