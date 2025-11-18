'use client';

import { useState } from 'react';
import {
  FiDollarSign,
  FiTrendingUp,
  FiTrendingDown,
  FiUsers,
  FiCalendar,
  FiBarChart2,
  FiPieChart,
  FiPackage,
} from 'react-icons/fi';

interface RevenueData {
  month: string;
  revenue: number;
  subscriptions: number;
}

export default function BillingStatsPage() {
  const [selectedPlan, setSelectedPlan] = useState<string>('all');

  // Mock data - في الواقع سيتم جلبها من API
  const currentMonthRevenue = 4250;
  const lastMonthRevenue = 3800;
  const revenueGrowth = ((currentMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100;

  const totalRevenue = 45600;
  const activeSubscriptions = 156;
  const newSubscriptionsThisMonth = 23;
  const churnRate = 2.3;

  const revenueByPlan = [
    { plan: 'الباقة الأساسية', revenue: 12400, count: 62, percentage: 27.2 },
    { plan: 'الباقة الاحترافية', revenue: 21350, count: 61, percentage: 46.8 },
    { plan: 'باقة الأعمال', revenue: 11850, count: 33, percentage: 26.0 },
  ];

  const monthlyData: RevenueData[] = [
    { month: 'يناير', revenue: 3200, subscriptions: 140 },
    { month: 'فبراير', revenue: 3400, subscriptions: 145 },
    { month: 'مارس', revenue: 3600, subscriptions: 148 },
    { month: 'أبريل', revenue: 3800, subscriptions: 150 },
    { month: 'مايو', revenue: 4100, subscriptions: 153 },
    { month: 'يونيو', revenue: 4250, subscriptions: 156 },
  ];

  const topTenants = [
    { name: 'متجر الإلكترونيات الحديثة', plan: 'باقة الأعمال', revenue: 600, status: 'active' },
    { name: 'مول الأزياء العصرية', plan: 'باقة الأعمال', revenue: 600, status: 'active' },
    { name: 'متجر الألعاب الذكية', plan: 'الباقة الاحترافية', revenue: 350, status: 'active' },
    { name: 'معرض الهواتف', plan: 'الباقة الاحترافية', revenue: 350, status: 'active' },
    { name: 'متجر الكتب والقرطاسية', plan: 'الباقة الاحترافية', revenue: 350, status: 'active' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-text-primary">إحصائيات الإيرادات</h1>
          <p className="text-sm text-text-secondary mt-1">تحليل شامل للإيرادات والاشتراكات</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-bg-surface border border-border rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-text-primary">من:</span>
            <input
              type="date"
              className="px-4 py-2 bg-bg-base border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary transition-colors"
              placeholder="من تاريخ"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-text-primary">إلى:</span>
            <input
              type="date"
              className="px-4 py-2 bg-bg-base border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary transition-colors"
              placeholder="إلى تاريخ"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-text-primary">الباقة:</span>
            <select
              value={selectedPlan}
              onChange={(e) => setSelectedPlan(e.target.value)}
              className="px-4 py-2 bg-bg-base border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary transition-colors"
            >
              <option value="all">جميع الباقات</option>
              <option value="basic">الباقة الأساسية</option>
              <option value="professional">الباقة الاحترافية</option>
              <option value="business">باقة الأعمال</option>
            </select>
          </div>

          <button className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
            تطبيق الفلتر
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Revenue */}
        <div className="bg-bg-surface border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-lg bg-green-500/10">
              <FiDollarSign className="text-green-500" size={24} />
            </div>
            <div className="flex items-center gap-1 text-green-500 text-sm font-medium">
              <FiTrendingUp size={16} />
              <span>+{revenueGrowth.toFixed(1)}%</span>
            </div>
          </div>
          <p className="text-text-secondary text-sm">إجمالي الإيرادات</p>
          <p className="text-3xl font-bold text-text-primary mt-1">${totalRevenue.toLocaleString()}</p>
          <p className="text-xs text-text-secondary mt-2">آخر 6 أشهر</p>
        </div>

        {/* Monthly Revenue */}
        <div className="bg-bg-surface border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-lg bg-blue-500/10">
              <FiCalendar className="text-blue-500" size={24} />
            </div>
            <div className="flex items-center gap-1 text-green-500 text-sm font-medium">
              <FiTrendingUp size={16} />
              <span>+{revenueGrowth.toFixed(1)}%</span>
            </div>
          </div>
          <p className="text-text-secondary text-sm">إيرادات هذا الشهر</p>
          <p className="text-3xl font-bold text-text-primary mt-1">${currentMonthRevenue.toLocaleString()}</p>
          <p className="text-xs text-text-secondary mt-2">مقارنة بـ ${lastMonthRevenue.toLocaleString()} الشهر الماضي</p>
        </div>

        {/* Active Subscriptions */}
        <div className="bg-bg-surface border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-lg bg-purple-500/10">
              <FiUsers className="text-purple-500" size={24} />
            </div>
            <div className="flex items-center gap-1 text-green-500 text-sm font-medium">
              <FiTrendingUp size={16} />
              <span>+{newSubscriptionsThisMonth}</span>
            </div>
          </div>
          <p className="text-text-secondary text-sm">الاشتراكات النشطة</p>
          <p className="text-3xl font-bold text-text-primary mt-1">{activeSubscriptions}</p>
          <p className="text-xs text-text-secondary mt-2">+{newSubscriptionsThisMonth} مشترك جديد هذا الشهر</p>
        </div>

        {/* Churn Rate */}
        <div className="bg-bg-surface border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-lg bg-orange-500/10">
              <FiBarChart2 className="text-orange-500" size={24} />
            </div>
            <div className="flex items-center gap-1 text-red-500 text-sm font-medium">
              <FiTrendingDown size={16} />
              <span>{churnRate}%</span>
            </div>
          </div>
          <p className="text-text-secondary text-sm">معدل إلغاء الاشتراكات</p>
          <p className="text-3xl font-bold text-text-primary mt-1">{churnRate}%</p>
          <p className="text-xs text-text-secondary mt-2">انخفض عن الشهر الماضي</p>
        </div>
      </div>

      {/* Revenue by Plan & Monthly Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue by Plan */}
        <div className="bg-bg-surface border border-border rounded-xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <FiPieChart className="text-primary" size={20} />
            <h2 className="text-lg font-bold text-text-primary">الإيرادات حسب الباقة</h2>
          </div>
          <div className="space-y-4">
            {revenueByPlan.map((item, index) => (
              <div key={index}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <FiPackage className="text-primary" size={16} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-text-primary">{item.plan}</p>
                      <p className="text-xs text-text-secondary">{item.count} مشترك</p>
                    </div>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-text-primary">${item.revenue.toLocaleString()}</p>
                    <p className="text-xs text-text-secondary">{item.percentage}%</p>
                  </div>
                </div>
                <div className="w-full bg-bg-base rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Monthly Trend */}
        <div className="bg-bg-surface border border-border rounded-xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <FiBarChart2 className="text-primary" size={20} />
            <h2 className="text-lg font-bold text-text-primary">الاتجاه الشهري</h2>
          </div>
          <div className="space-y-3">
            {monthlyData.map((item, index) => {
              const maxRevenue = Math.max(...monthlyData.map((d) => d.revenue));
              const percentage = (item.revenue / maxRevenue) * 100;
              
              return (
                <div key={index}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-text-primary">{item.month}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-text-secondary">{item.subscriptions} مشترك</span>
                      <span className="text-sm font-bold text-text-primary">${item.revenue.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="w-full bg-bg-base rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-primary rounded-full transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Top Revenue Tenants */}
      <div className="bg-bg-surface border border-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <FiTrendingUp className="text-primary" size={20} />
            <h2 className="text-lg font-bold text-text-primary">أعلى المستأجرين إيراداً</h2>
          </div>
          <span className="text-sm text-text-secondary">آخر 30 يوم</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-bg-base border-b border-border">
              <tr>
                <th className="px-4 py-3 text-right text-sm font-semibold text-text-primary">الترتيب</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-text-primary">اسم المستأجر</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-text-primary">الباقة</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-text-primary">الإيرادات الشهرية</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-text-primary">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {topTenants.map((tenant, index) => (
                <tr key={index} className="hover:bg-bg-base transition-colors">
                  <td className="px-4 py-4">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm">
                      {index + 1}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-sm font-medium text-text-primary">{tenant.name}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-sm text-text-secondary">{tenant.plan}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-sm font-bold text-green-500">${tenant.revenue}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-500 border border-green-500/20">
                      نشط
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-blue-500/10 to-primary/10 border border-primary/20 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-primary text-white">
              <FiDollarSign size={20} />
            </div>
            <h3 className="text-sm font-semibold text-text-primary">متوسط الإيرادات لكل مستأجر</h3>
          </div>
          <p className="text-3xl font-bold text-text-primary">${(totalRevenue / activeSubscriptions).toFixed(2)}</p>
          <p className="text-xs text-text-secondary mt-2">شهرياً</p>
        </div>

        <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-green-500 text-white">
              <FiTrendingUp size={20} />
            </div>
            <h3 className="text-sm font-semibold text-text-primary">معدل النمو الشهري</h3>
          </div>
          <p className="text-3xl font-bold text-text-primary">+{revenueGrowth.toFixed(1)}%</p>
          <p className="text-xs text-text-secondary mt-2">مقارنة بالشهر الماضي</p>
        </div>

        <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-purple-500 text-white">
              <FiUsers size={20} />
            </div>
            <h3 className="text-sm font-semibold text-text-primary">معدل التحويل</h3>
          </div>
          <p className="text-3xl font-bold text-text-primary">92.5%</p>
          <p className="text-xs text-text-secondary mt-2">من التجارب المجانية للمدفوعة</p>
        </div>
      </div>
    </div>
  );
}
