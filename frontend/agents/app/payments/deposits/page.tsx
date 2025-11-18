'use client';

import { useState } from 'react';
import { MOCK_PAYMENT_METHODS } from '@/data/mockPaymentMethods';
import toast from 'react-hot-toast';

export default function DepositMethodsPage() {
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [showForm, setShowForm] = useState(false);

  const handleMethodClick = (methodId: string) => {
    setSelectedMethod(methodId);
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('الرجاء إدخال مبلغ صحيح');
      return;
    }
    
    const method = MOCK_PAYMENT_METHODS.find(m => m.id === selectedMethod);
    toast.success(`تم إرسال طلب إيداع ${amount}$ عبر ${method?.name}. سيتم المراجعة قريباً.`);
    setShowForm(false);
    setAmount('');
    setSelectedMethod(null);
  };

  const selectedMethodData = MOCK_PAYMENT_METHODS.find(m => m.id === selectedMethod);

  return (
    <div className="min-h-screen p-4 max-w-5xl mx-auto bg-bg-base text-text-primary" dir="rtl">
      <h1 className="text-xl mb-2">💰 إضافة رصيد</h1>
      <p className="text-text-secondary mb-6">اختر طريقة الدفع المناسبة لك</p>

      {/* طرق الدفع */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {MOCK_PAYMENT_METHODS.map((m) => (
          <button
            key={m.id}
            onClick={() => handleMethodClick(m.id)}
            className="bg-bg-surface rounded-xl p-4 hover:bg-bg-surface-alt transition-all border border-border hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <div className="w-full h-20 flex items-center justify-center text-5xl mb-2">
              {m.logoUrl}
            </div>
            <div className="text-center">
              <div className="truncate">{m.name}</div>
            </div>
          </button>
        ))}
      </div>

      {/* نموذج الإيداع */}
      {showForm && selectedMethodData && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-bg-surface rounded-xl p-6 w-full max-w-md border border-border">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl">إيداع عبر {selectedMethodData.name}</h2>
              <button
                onClick={() => {
                  setShowForm(false);
                  setAmount('');
                  setSelectedMethod(null);
                }}
                className="text-2xl text-text-secondary hover:text-red-500"
              >
                ✖
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm mb-2">المبلغ (بالدولار)</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="أدخل المبلغ"
                  min="1"
                  step="0.01"
                  className="w-full px-4 py-3 rounded-lg bg-bg-base border border-border focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>

              <div className="mb-4 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <p className="text-sm text-yellow-700">
                  📌 ملاحظة: سيتم مراجعة طلبك من قبل الإدارة خلال 24 ساعة
                </p>
              </div>

              {selectedMethodData.type === 'BANK_ACCOUNT' && (
                <div className="mb-4 p-4 bg-bg-base rounded-lg border border-border">
                  <p className="text-sm text-text-secondary mb-2">
                    معلومات التحويل:
                  </p>
                  <p className="text-xs">
                    • اسم البنك: البنك الأهلي<br/>
                    • رقم الحساب: 1234567890<br/>
                    • اسم المستفيد: شركة المدفوعات
                  </p>
                </div>
              )}

              {selectedMethodData.type === 'USDT' && (
                <div className="mb-4 p-4 bg-bg-base rounded-lg border border-border">
                  <p className="text-sm text-text-secondary mb-2">
                    عنوان المحفظة:
                  </p>
                  <p className="text-xs font-mono break-all">
                    TXj7k9mN3pQ2rS4tU5vW6xY7zA8bC9dE0f
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-lg bg-primary text-white hover:bg-primary/90 transition-all"
                >
                  إرسال الطلب
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setAmount('');
                    setSelectedMethod(null);
                  }}
                  className="px-6 py-3 rounded-lg bg-bg-base border border-border hover:bg-bg-surface-alt transition-all"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
