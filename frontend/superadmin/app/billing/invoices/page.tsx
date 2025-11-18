'use client';

import { useState } from 'react';
import {
  FiSearch,
  FiDollarSign,
  FiFileText,
  FiCheckCircle,
  FiAlertCircle,
  FiClock,
  FiCalendar,
  FiEdit2,
} from 'react-icons/fi';

interface Invoice {
  id: string;
  tenantName: string;
  planName: string;
  expiryDate: string;
  status: 'active' | 'expired' | 'pending';
  temporaryExtension: boolean;
  extensionDays?: number;
}

export default function InvoicesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [invoices, setInvoices] = useState<Invoice[]>([
    {
      id: '1',
      tenantName: 'متجر الإلكترونيات',
      planName: 'الباقة الاحترافية',
      expiryDate: '2025-12-15',
      status: 'active',
      temporaryExtension: false,
    },
    {
      id: '2',
      tenantName: 'متجر الأزياء',
      planName: 'الباقة الأساسية',
      expiryDate: '2025-11-10',
      status: 'pending',
      temporaryExtension: true,
      extensionDays: 7,
    },
    {
      id: '3',
      tenantName: 'متجر الألعاب',
      planName: 'باقة الأعمال',
      expiryDate: '2025-10-28',
      status: 'expired',
      temporaryExtension: false,
    },
    {
      id: '4',
      tenantName: 'متجر الكتب',
      planName: 'الباقة الأساسية',
      expiryDate: '2026-01-20',
      status: 'active',
      temporaryExtension: false,
    },
    {
      id: '5',
      tenantName: 'متجر الهدايا',
      planName: 'الباقة الاحترافية',
      expiryDate: '2025-11-08',
      status: 'expired',
      temporaryExtension: true,
      extensionDays: 3,
    },
  ]);

  const filteredInvoices = invoices.filter((invoice) =>
    invoice.tenantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    invoice.planName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleTemporaryExtension = (id: string) => {
    const days = prompt('أدخل عدد أيام التمديد المؤقت:');
    if (days && !isNaN(Number(days))) {
      console.log(`Extending invoice ${id} by ${days} days`);
      // TODO: API call
      setInvoices(
        invoices.map((inv) =>
          inv.id === id
            ? { ...inv, temporaryExtension: true, extensionDays: Number(days) }
            : inv
        )
      );
    }
  };

  const handleRemoveExtension = (id: string) => {
    console.log(`Removing extension for invoice ${id}`);
    // TODO: API call
    setInvoices(
      invoices.map((inv) =>
        inv.id === id
          ? { ...inv, temporaryExtension: false, extensionDays: undefined }
          : inv
      )
    );
  };

  const getStatusBadge = (status: Invoice['status']) => {
    const badges = {
      active: {
        icon: <FiCheckCircle size={14} />,
        text: 'نشط',
        class: 'bg-green-500/10 text-green-500 border border-green-500/20',
      },
      expired: {
        icon: <FiAlertCircle size={14} />,
        text: 'منتهي',
        class: 'bg-red-500/10 text-red-500 border border-red-500/20',
      },
      pending: {
        icon: <FiClock size={14} />,
        text: 'قيد الانتظار',
        class: 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20',
      },
    };

    const badge = badges[status];
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 w-fit ${badge.class}`}>
        {badge.icon}
        {badge.text}
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const activeCount = invoices.filter((inv) => inv.status === 'active').length;
  const expiredCount = invoices.filter((inv) => inv.status === 'expired').length;
  const totalRevenue = invoices.length * 150; // Mock calculation

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-text-primary">الفواتير</h1>
          <p className="text-sm text-text-secondary mt-1">إدارة فواتير واشتراكات المستأجرين</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-bg-surface border border-border rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-text-secondary text-sm">إجمالي الفواتير</p>
              <p className="text-3xl font-bold text-text-primary mt-1">{invoices.length}</p>
            </div>
            <div className="p-3 rounded-lg bg-blue-500/10">
              <FiFileText className="text-blue-500" size={28} />
            </div>
          </div>
        </div>
        <div className="bg-bg-surface border border-border rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-text-secondary text-sm">الاشتراكات النشطة</p>
              <p className="text-3xl font-bold text-text-primary mt-1">{activeCount}</p>
            </div>
            <div className="p-3 rounded-lg bg-green-500/10">
              <FiCheckCircle className="text-green-500" size={28} />
            </div>
          </div>
        </div>
        <div className="bg-bg-surface border border-border rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-text-secondary text-sm">الاشتراكات المنتهية</p>
              <p className="text-3xl font-bold text-text-primary mt-1">{expiredCount}</p>
            </div>
            <div className="p-3 rounded-lg bg-red-500/10">
              <FiAlertCircle className="text-red-500" size={28} />
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="bg-bg-surface border border-border rounded-xl p-4">
        <div className="relative">
          <FiSearch className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary" size={20} />
          <input
            type="text"
            placeholder="ابحث عن مستأجر أو باقة..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pr-10 pl-4 py-3 bg-bg-base border border-border rounded-lg focus:outline-none focus:border-primary transition-colors text-text-primary"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-bg-surface border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-bg-base border-b border-border">
              <tr>
                <th className="px-6 py-4 text-right text-sm font-semibold text-text-primary">اسم المستأجر</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-text-primary">الباقة</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-text-primary">تاريخ الانتهاء</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-text-primary">الحالة</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-text-primary">التمديد المؤقت</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-text-primary">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-text-secondary">
                    لا توجد فواتير
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-bg-base transition-colors">
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-text-primary">{invoice.tenantName}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-text-secondary">{invoice.planName}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-text-secondary">
                        <FiCalendar size={16} />
                        {formatDate(invoice.expiryDate)}
                      </div>
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(invoice.status)}</td>
                    <td className="px-6 py-4">
                      {invoice.temporaryExtension ? (
                        <div className="flex flex-col gap-1">
                          <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-500 border border-blue-500/20 w-fit">
                            {invoice.extensionDays} أيام
                          </span>
                          <button
                            onClick={() => handleRemoveExtension(invoice.id)}
                            className="text-xs text-red-500 hover:underline text-right"
                          >
                            إلغاء التمديد
                          </button>
                        </div>
                      ) : (
                        <span className="text-sm text-text-secondary">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleTemporaryExtension(invoice.id)}
                        className="flex items-center gap-1 bg-primary/10 text-primary px-3 py-1.5 rounded-lg hover:bg-primary/20 transition-all text-sm font-medium"
                      >
                        <FiEdit2 size={14} />
                        تمديد
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
