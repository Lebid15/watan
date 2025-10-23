/**
 * Routing Health Monitor Component
 * مكون مراقبة صحة التوجيه
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'next-i18next';

interface HealthIssue {
  type: string;
  severity: 'high' | 'medium' | 'low';
  message: string;
  count?: number;
  suggestion?: string;
}

interface RoutingStats {
  total: number;
  active: number;
  auto: number;
  manual: number;
  external: number;
  codes: number;
  auto_percentage: number;
}

interface OrderStats {
  total: number;
  pending: number;
  last_24h: number;
  last_7d: number;
  successful_24h: number;
  success_rate: number;
  pending_percentage: number;
}

interface HealthReport {
  tenant_id: string;
  timestamp: string;
  overall_health: 'healthy' | 'warning' | 'critical' | 'error';
  issues: HealthIssue[];
  recommendations: string[];
  routing_stats: RoutingStats;
  order_stats: OrderStats;
}

export default function RoutingHealthMonitor() {
  const { t } = useTranslation();
  const [healthReport, setHealthReport] = useState<HealthReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchHealthReport();
  }, []);

  const fetchHealthReport = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/orders/routing/health/');
      if (!response.ok) {
        throw new Error('Failed to fetch health report');
      }
      
      const data = await response.json();
      setHealthReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'healthy': return 'text-green-600 bg-green-100';
      case 'warning': return 'text-yellow-600 bg-yellow-100';
      case 'critical': return 'text-red-600 bg-red-100';
      case 'error': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'text-red-600 bg-red-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-blue-600 bg-blue-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  if (loading) {
    return (
      <div className="p-6 bg-white rounded-lg shadow">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-2">
            <div className="h-3 bg-gray-200 rounded"></div>
            <div className="h-3 bg-gray-200 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-white rounded-lg shadow">
        <div className="text-red-600">
          <h3 className="text-lg font-semibold mb-2">خطأ في فحص الصحة</h3>
          <p>{error}</p>
          <button 
            onClick={fetchHealthReport}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            إعادة المحاولة
          </button>
        </div>
      </div>
    );
  }

  if (!healthReport) {
    return (
      <div className="p-6 bg-white rounded-lg shadow">
        <p className="text-gray-500">لا توجد بيانات صحة متاحة</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* حالة الصحة العامة */}
      <div className="p-6 bg-white rounded-lg shadow">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">حالة صحة نظام التوجيه</h2>
          <button 
            onClick={fetchHealthReport}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            تحديث
          </button>
        </div>
        
        <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getHealthColor(healthReport.overall_health)}`}>
          {healthReport.overall_health === 'healthy' && '✅ صحي'}
          {healthReport.overall_health === 'warning' && '⚠️ تحذير'}
          {healthReport.overall_health === 'critical' && '🚨 حرج'}
          {healthReport.overall_health === 'error' && '❌ خطأ'}
        </div>
        
        <p className="text-sm text-gray-500 mt-2">
          آخر تحديث: {new Date(healthReport.timestamp).toLocaleString('ar-SA')}
        </p>
      </div>

      {/* المشاكل المكتشفة */}
      {healthReport.issues.length > 0 && (
        <div className="p-6 bg-white rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">المشاكل المكتشفة ({healthReport.issues.length})</h3>
          <div className="space-y-3">
            {healthReport.issues.map((issue, index) => (
              <div key={index} className="border-l-4 border-red-500 pl-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getSeverityColor(issue.severity)}`}>
                    {issue.severity === 'high' && 'عالي'}
                    {issue.severity === 'medium' && 'متوسط'}
                    {issue.severity === 'low' && 'منخفض'}
                  </span>
                  {issue.count && (
                    <span className="text-sm text-gray-500">({issue.count})</span>
                  )}
                </div>
                <p className="text-sm text-gray-700 mb-1">{issue.message}</p>
                {issue.suggestion && (
                  <p className="text-xs text-blue-600">💡 {issue.suggestion}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* إحصائيات التوجيه */}
      <div className="p-6 bg-white rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">إحصائيات التوجيه</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{healthReport.routing_stats.total}</div>
            <div className="text-sm text-gray-500">إجمالي التوجيهات</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{healthReport.routing_stats.active}</div>
            <div className="text-sm text-gray-500">نشط</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">{healthReport.routing_stats.auto}</div>
            <div className="text-sm text-gray-500">تلقائي</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">{healthReport.routing_stats.manual}</div>
            <div className="text-sm text-gray-500">يدوي</div>
          </div>
        </div>
        <div className="mt-4">
          <div className="text-sm text-gray-500 mb-1">نسبة التوجيه التلقائي</div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full" 
              style={{ width: `${healthReport.routing_stats.auto_percentage}%` }}
            ></div>
          </div>
          <div className="text-xs text-gray-500 mt-1">{healthReport.routing_stats.auto_percentage.toFixed(1)}%</div>
        </div>
      </div>

      {/* إحصائيات الطلبات */}
      <div className="p-6 bg-white rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">إحصائيات الطلبات</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{healthReport.order_stats.total}</div>
            <div className="text-sm text-gray-500">إجمالي الطلبات</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">{healthReport.order_stats.pending}</div>
            <div className="text-sm text-gray-500">معلق</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{healthReport.order_stats.success_rate}%</div>
            <div className="text-sm text-gray-500">معدل النجاح</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">{healthReport.order_stats.last_24h}</div>
            <div className="text-sm text-gray-500">آخر 24 ساعة</div>
          </div>
        </div>
      </div>

      {/* التوصيات */}
      {healthReport.recommendations.length > 0 && (
        <div className="p-6 bg-white rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">التوصيات ({healthReport.recommendations.length})</h3>
          <div className="space-y-2">
            {healthReport.recommendations.map((recommendation, index) => (
              <div key={index} className="flex items-start gap-2">
                <span className="text-blue-500 mt-1">💡</span>
                <span className="text-sm text-gray-700">{recommendation}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

