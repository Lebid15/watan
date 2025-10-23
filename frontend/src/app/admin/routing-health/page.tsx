/**
 * Routing Health Monitoring Page
 * صفحة مراقبة صحة التوجيه
 */

'use client';

import React from 'react';
import { useTranslation } from 'next-i18next';
import RoutingHealthMonitor from '@/components/RoutingHealthMonitor';

export default function RoutingHealthPage() {
  const { t } = useTranslation();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          مراقبة صحة نظام التوجيه
        </h1>
        <p className="text-gray-600">
          مراقبة شاملة لصحة نظام التوجيه مع تقارير مفصلة وإحصائيات
        </p>
      </div>

      <RoutingHealthMonitor />
    </div>
  );
}

