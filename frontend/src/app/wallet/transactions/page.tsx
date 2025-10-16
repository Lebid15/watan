'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fmtDateStable } from '@/lib/fmtDateStable';
import api from '@/utils/api';
import { useAuthRequired } from '@/hooks/useAuthRequired';
import { 
  HiCheckCircle,
  HiXCircle,
  HiArrowPath,
  HiWallet,
  HiClock,
} from 'react-icons/hi2';

interface WalletTransaction {
  id: string;
  transaction_type: 'approved' | 'rejected' | 'status_change' | 'deposit' | 'deposit_reversal';
  transaction_type_display: string;
  amount: string | number;
  currency: string;
  balance_before: string | number;
  balance_after: string | number;
  description: string;
  order_id?: string | null;
  created_at: string;
  metadata?: {
    created_at_order?: boolean;
    order_status?: string;
    status_change?: boolean;
    [key: string]: any;
  };
}

interface TransactionsResponse {
  transactions: WalletTransaction[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

const fmt = (v: number | string | undefined | null, maxFrac = 2) => {
  const n = Number(v);
  if (!isFinite(n)) return '—';
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFrac,
  });
};

const fmtDate = (d: string) => fmtDateStable(d);

export default function WalletTransactionsPage() {
  useAuthRequired();
  const { t } = useTranslation();

  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [typeFilter, setTypeFilter] = useState<string>('all');

  useEffect(() => {
    fetchTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, typeFilter]);

  const fetchTransactions = async () => {
    setLoading(true);
    setError('');

    try {
      const params: Record<string, any> = {
        page: currentPage,
        page_size: 20,
      };

      if (typeFilter !== 'all') {
        params.type = typeFilter;
      }

      const { data } = await api.get<TransactionsResponse>(
        '/users/wallet/transactions',
        { params }
      );

      setTransactions(data.transactions);
      setTotalPages(data.total_pages);
      setTotal(data.total);
    } catch (err: any) {
      console.error('Failed to fetch wallet transactions:', err);
      setError(err?.response?.data?.message || 'فشل تحميل سجل المحفظة');
    } finally {
      setLoading(false);
    }
  };

  const getTransactionIcon = (tx: WalletTransaction) => {
    const { transaction_type: type, metadata, description } = tx;
    const status = typeof metadata?.order_status === 'string' ? metadata.order_status.toLowerCase() : undefined;

    if (type === 'status_change' || metadata?.status_change === true) {
      return <HiArrowPath className="h-5 w-5 text-blue-500" />;
    }

    if (status === 'pending') {
      return <HiClock className="h-5 w-5 text-yellow-500" />;
    }

    if (status === 'approved') {
      return <HiCheckCircle className="h-5 w-5 text-green-500" />;
    }

    if (status === 'rejected') {
      return <HiXCircle className="h-5 w-5 text-red-500" />;
    }

    if (metadata?.created_at_order) {
      return <HiClock className="h-5 w-5 text-yellow-500" />;
    }

    if (description.includes('تغيير الحالة')) {
      return <HiArrowPath className="h-5 w-5 text-blue-500" />;
    }

    switch (type) {
      case 'approved':
        return <HiCheckCircle className="h-5 w-5 text-green-500" />;
      case 'rejected':
        return <HiXCircle className="h-5 w-5 text-red-500" />;
      case 'deposit':
        return <HiWallet className="h-5 w-5 text-green-500" />;
      case 'deposit_reversal':
        return <HiWallet className="h-5 w-5 text-red-500" />;
      default:
        return null;
    }
  };

  const getAmountColor = (amount: number | string) => {
    const num = Number(amount);
    if (num > 0) return 'text-green-600 dark:text-green-400';
    if (num < 0) return 'text-red-600 dark:text-red-400';
    return 'text-gray-600 dark:text-gray-400';
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {t('wallet.transactions.title', 'سجل المحفظة')}
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {t('wallet.transactions.subtitle', 'جميع التغييرات على رصيد محفظتك')}
          </p>
        </div>

        {/* Filter */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('wallet.transactions.filter', 'تصفية حسب النوع')}
          </label>
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="block w-full max-w-xs rounded-md border-gray-300 dark:border-gray-600 
                     bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                     shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          >
            <option value="all">{t('wallet.transactions.all', 'الكل')}</option>
            <option value="approved">{t('wallet.transactions.approved', 'قبول')}</option>
            <option value="rejected">{t('wallet.transactions.rejected', 'رفض')}</option>
            <option value="status_change">{t('wallet.transactions.status_change', 'تغيير الحالة')}</option>
            <option value="deposit">{t('wallet.transactions.deposit', 'شحن المحفظة')}</option>
            <option value="deposit_reversal">{t('wallet.transactions.deposit_reversal', 'إلغاء شحن المحفظة')}</option>
          </select>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4 mb-6">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {/* Transactions List */}
        {!loading && !error && (
          <>
            {transactions.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 dark:text-gray-400">
                  {t('wallet.transactions.empty', 'لا توجد معاملات بعد')}
                </p>
              </div>
            ) : (
              <>
                {/* Desktop View */}
                <div className="hidden md:block overflow-hidden bg-white dark:bg-gray-800 shadow sm:rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-900">
                      <tr>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          {t('wallet.transactions.type', 'النوع')}
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          {t('wallet.transactions.description', 'الوصف')}
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          {t('wallet.transactions.amount', 'المبلغ')}
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          {t('wallet.transactions.balance_after', 'الرصيد بعد')}
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          {t('wallet.transactions.date', 'التاريخ')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {transactions.map((tx) => (
                        <tr key={tx.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              {getTransactionIcon(tx)}
                              <span className="text-sm text-gray-900 dark:text-white">
                                {tx.description.split('\n')[0]}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-900 dark:text-white whitespace-pre-line">
                              {tx.description.split('\n').slice(1).join('\n')}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {tx.description.includes('تغيير الحالة إلى رفض') || tx.transaction_type === 'rejected' ? (
                              <span className="text-sm text-gray-400 dark:text-gray-500">—</span>
                            ) : (
                              <span className={`text-sm font-semibold ${getAmountColor(tx.amount)}`}>
                                {Number(tx.amount) > 0 ? '+' : ''}
                                {fmt(tx.amount)} {tx.currency}
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {fmt(tx.balance_after)} {tx.currency}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {fmtDate(tx.created_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile View */}
                <div className="md:hidden space-y-4">
                  {transactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="bg-white dark:bg-gray-800 shadow rounded-lg p-4"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          {getTransactionIcon(tx)}
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {tx.description.split('\n')[0]}
                          </span>
                        </div>
                        {tx.description.includes('تغيير الحالة إلى رفض') || tx.transaction_type === 'rejected' ? (
                          <span className="text-sm text-gray-400 dark:text-gray-500">—</span>
                        ) : (
                          <span className={`text-sm font-bold ${getAmountColor(tx.amount)}`}>
                            {Number(tx.amount) > 0 ? '+' : ''}
                            {fmt(tx.amount)} {tx.currency}
                          </span>
                        )}
                      </div>
                      
                      <p className="text-sm text-gray-700 dark:text-gray-300 mb-2 whitespace-pre-line">
                        {tx.description.split('\n').slice(1).join('\n')}
                      </p>
                      
                      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                        <span>{fmtDate(tx.created_at)}</span>
                        <span>الرصيد: {fmt(tx.balance_after)} {tx.currency}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="mt-6 flex items-center justify-between border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 sm:px-6 rounded-lg">
                    <div className="flex flex-1 justify-between sm:hidden">
                      <button
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="relative inline-flex items-center rounded-md border border-gray-300 dark:border-gray-600 
                                 bg-white dark:bg-gray-800 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 
                                 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        السابق
                      </button>
                      <button
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="relative mr-3 inline-flex items-center rounded-md border border-gray-300 dark:border-gray-600 
                                 bg-white dark:bg-gray-800 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 
                                 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        التالي
                      </button>
                    </div>
                    <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                          عرض{' '}
                          <span className="font-medium">{(currentPage - 1) * 20 + 1}</span>
                          {' '}إلى{' '}
                          <span className="font-medium">
                            {Math.min(currentPage * 20, total)}
                          </span>
                          {' '}من{' '}
                          <span className="font-medium">{total}</span>
                          {' '}معاملة
                        </p>
                      </div>
                      <div>
                        <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                          <button
                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 
                                     ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 
                                     focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <span className="sr-only">السابق</span>
                            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                              <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
                            </svg>
                          </button>
                          
                          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            let pageNum: number;
                            if (totalPages <= 5) {
                              pageNum = i + 1;
                            } else if (currentPage <= 3) {
                              pageNum = i + 1;
                            } else if (currentPage >= totalPages - 2) {
                              pageNum = totalPages - 4 + i;
                            } else {
                              pageNum = currentPage - 2 + i;
                            }
                            
                            return (
                              <button
                                key={pageNum}
                                onClick={() => setCurrentPage(pageNum)}
                                className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold 
                                          ${
                                            currentPage === pageNum
                                              ? 'z-10 bg-blue-600 text-white focus:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600'
                                              : 'text-gray-900 dark:text-gray-300 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 focus:z-20 focus:outline-offset-0'
                                          }`}
                              >
                                {pageNum}
                              </button>
                            );
                          })}

                          <button
                            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 
                                     ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 
                                     focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <span className="sr-only">التالي</span>
                            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                              <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </nav>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
