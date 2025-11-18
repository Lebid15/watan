'use client';

import { useState } from 'react';
import { MOCK_TRANSACTIONS, type TransactionType } from '@/data/mockTransactions';

export default function TransactionsPage() {
  const [typeFilter, setTypeFilter] = useState<TransactionType | 'all'>('all');

  const filteredTransactions = MOCK_TRANSACTIONS.filter(tx => {
    if (typeFilter === 'all') return true;
    return tx.type === typeFilter;
  });

  const getTransactionIcon = (type: TransactionType) => {
    switch (type) {
      case 'approved': return '✅';
      case 'rejected': return '❌';
      case 'status_change': return '🔄';
      case 'deposit': return '💰';
      case 'deposit_reversal': return '↩️';
      default: return '📄';
    }
  };

  const getAmountColor = (amount: number) => {
    if (amount > 0) return 'text-green-600';
    if (amount < 0) return 'text-red-600';
    return 'text-text-secondary';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  return (
    <div className="min-h-screen bg-bg-base p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* الترويسة */}
        <div className="mb-6">
          <h1 className="text-2xl text-text-primary mb-4">سجل المعاملات</h1>
          
          {/* الفلتر */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as TransactionType | 'all')}
            className="w-full md:w-auto px-4 py-2 bg-bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">جميع المعاملات</option>
            <option value="deposit">💰 الإيداعات</option>
            <option value="approved">✅ الطلبات المقبولة</option>
            <option value="rejected">❌ الطلبات المرفوضة</option>
            <option value="status_change">🔄 تغييرات الحالة</option>
            <option value="deposit_reversal">↩️ استرجاع إيداع</option>
          </select>
        </div>

        {/* عرض سطح المكتب - جدول */}
        <div className="hidden md:block bg-bg-surface border border-border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-bg-base border-b border-border">
              <tr>
                <th className="px-4 py-3 text-right text-text-secondary">النوع</th>
                <th className="px-4 py-3 text-right text-text-secondary">الوصف</th>
                <th className="px-4 py-3 text-right text-text-secondary">المبلغ</th>
                <th className="px-4 py-3 text-right text-text-secondary">المحفظة</th>
                <th className="px-4 py-3 text-right text-text-secondary">التاريخ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredTransactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-bg-base transition-colors">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{getTransactionIcon(tx.type)}</span>
                      <span className="text-text-primary text-sm">{tx.typeDisplay}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-text-primary">{tx.description}</div>
                    {tx.paymentMethod && (
                      <div className="text-sm text-text-secondary mt-1">{tx.paymentMethod}</div>
                    )}
                    {tx.orderId && (
                      <div className="text-sm text-text-secondary mt-1">{tx.orderId}</div>
                    )}
                  </td>
                  <td className={`px-4 py-4 ${getAmountColor(tx.amount)}`}>
                    {tx.amount > 0 ? '+' : ''}{tx.amount.toFixed(2)} {tx.currency}
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-yellow-500 line-through">${tx.balanceBefore.toFixed(2)}</div>
                    <div className="text-text-primary">${tx.balanceAfter.toFixed(2)}</div>
                  </td>
                  <td className="px-4 py-4 text-text-secondary text-sm" suppressHydrationWarning>
                    {formatDate(tx.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {filteredTransactions.length === 0 && (
            <div className="text-center py-12 text-text-secondary">
              لا توجد معاملات
            </div>
          )}
        </div>

        {/* عرض الموبايل - بطاقات */}
        <div className="md:hidden space-y-3">
          {filteredTransactions.map((tx) => (
            <div key={tx.id} className="bg-bg-surface border border-border rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{getTransactionIcon(tx.type)}</span>
                  <div>
                    <div className="text-text-primary">{tx.typeDisplay}</div>
                    <div className="text-xs text-text-secondary mt-0.5" suppressHydrationWarning>
                      {formatDate(tx.createdAt)}
                    </div>
                  </div>
                </div>
                <div className={`text-lg ${getAmountColor(tx.amount)}`}>
                  {tx.amount > 0 ? '+' : ''}{tx.amount.toFixed(2)}
                </div>
              </div>
              
              <div className="text-text-primary mb-2">{tx.description}</div>
              
              {tx.paymentMethod && (
                <div className="text-sm text-text-secondary mb-1">{tx.paymentMethod}</div>
              )}
              
              {tx.orderId && (
                <div className="text-sm text-text-secondary mb-2">{tx.orderId}</div>
              )}
              
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <span className="text-sm text-text-secondary">المحفظة</span>
                <div className="text-left">
                  <div className="text-yellow-500 line-through text-sm">${tx.balanceBefore.toFixed(2)}</div>
                  <div className="text-text-primary">${tx.balanceAfter.toFixed(2)}</div>
                </div>
              </div>
            </div>
          ))}
          
          {filteredTransactions.length === 0 && (
            <div className="text-center py-12 text-text-secondary bg-bg-surface border border-border rounded-lg">
              لا توجد معاملات
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
