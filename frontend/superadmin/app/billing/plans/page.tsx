'use client';

import { useState } from 'react';
import {
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiX,
  FiDollarSign,
  FiUsers,
  FiPackage,
  FiZap,
} from 'react-icons/fi';

interface PlanFeature {
  name: string;
  included: boolean;
}

interface Plan {
  id: string;
  name: string;
  nameEn: string;
  price: number;
  billingPeriod: 'monthly' | 'yearly';
  description: string;
  features: PlanFeature[];
  maxProducts: number;
  maxOrders: number;
  isPopular: boolean;
  status: 'active' | 'inactive';
}

export default function BillingPlansPage() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [plans, setPlans] = useState<Plan[]>([
    {
      id: '1',
      name: 'الباقة الأساسية',
      nameEn: 'Basic',
      price: 20,
      billingPeriod: 'monthly',
      description: 'مثالية للمتاجر الصغيرة والناشئة',
      maxProducts: 50,
      maxOrders: 1000,
      isPopular: false,
      status: 'active',
      features: [],
    },
    {
      id: '2',
      name: 'الباقة الاحترافية',
      nameEn: 'Professional',
      price: 35,
      billingPeriod: 'monthly',
      description: 'الأنسب للمتاجر المتوسطة',
      maxProducts: 200,
      maxOrders: 5000,
      isPopular: true,
      status: 'active',
      features: [],
    },
    {
      id: '3',
      name: 'باقة الأعمال',
      nameEn: 'Business',
      price: 50,
      billingPeriod: 'monthly',
      description: 'للمتاجر الكبيرة والمؤسسات',
      maxProducts: -1, // unlimited
      maxOrders: -1, // unlimited
      isPopular: false,
      status: 'active',
      features: [],
    },
  ]);

  const [newPlan, setNewPlan] = useState<Partial<Plan>>({
    name: '',
    nameEn: '',
    price: 0,
    billingPeriod: 'monthly',
    description: '',
    maxProducts: 0,
    maxOrders: 0,
    isPopular: false,
    status: 'active',
    features: [],
  });

  const handleAddPlan = () => {
    console.log('Adding new plan:', newPlan);
    // TODO: API call
    setIsAddModalOpen(false);
    resetForm();
  };

  const handleUpdatePlan = () => {
    console.log('Updating plan:', editingPlan);
    // TODO: API call
    setEditingPlan(null);
  };

  const handleDeletePlan = (id: string) => {
    if (confirm('هل أنت متأكد من حذف هذه الباقة؟')) {
      console.log('Deleting plan:', id);
      // TODO: API call
      setPlans(plans.filter((p) => p.id !== id));
    }
  };

  const resetForm = () => {
    setNewPlan({
      name: '',
      nameEn: '',
      price: 0,
      billingPeriod: 'monthly',
      description: '',
      maxProducts: 0,
      maxOrders: 0,
      isPopular: false,
      status: 'active',
      features: [],
    });
  };

  const totalSubscriptions = 156;
  const monthlyRevenue = plans.reduce((sum, plan) => {
    // Mock calculation
    return sum + plan.price * 15;
  }, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-text-primary">باقات الاشتراك</h1>
          <p className="text-sm text-text-secondary mt-1">إدارة باقات الاشتراك المتاحة للمستأجرين</p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2 bg-primary text-white px-4 py-3 rounded-lg hover:bg-primary/90 transition-all font-medium cursor-pointer"
        >
          <FiPlus size={20} />
          إضافة باقة
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-bg-surface border border-border rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-text-secondary text-sm">إجمالي الباقات</p>
              <p className="text-3xl font-bold text-text-primary mt-1">{plans.length}</p>
            </div>
            <div className="p-3 rounded-lg bg-blue-500/10">
              <FiPackage className="text-blue-500" size={28} />
            </div>
          </div>
        </div>
        <div className="bg-bg-surface border border-border rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-text-secondary text-sm">المشتركون الحاليون</p>
              <p className="text-3xl font-bold text-text-primary mt-1">{totalSubscriptions}</p>
            </div>
            <div className="p-3 rounded-lg bg-green-500/10">
              <FiUsers className="text-green-500" size={28} />
            </div>
          </div>
        </div>
        <div className="bg-bg-surface border border-border rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-text-secondary text-sm">الإيرادات الشهرية</p>
              <p className="text-3xl font-bold text-text-primary mt-1">${monthlyRevenue.toLocaleString()}</p>
            </div>
            <div className="p-3 rounded-lg bg-purple-500/10">
              <FiDollarSign className="text-purple-500" size={28} />
            </div>
          </div>
        </div>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`bg-bg-surface border-2 rounded-xl p-6 transition-all hover:shadow-lg relative ${
              plan.isPopular ? 'border-primary' : 'border-border'
            }`}
          >
            {/* Popular Badge */}
            {plan.isPopular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-primary text-white px-4 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-lg">
                  <FiZap size={12} />
                  الأكثر طلباً
                </span>
              </div>
            )}

            {/* Header */}
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold text-text-primary mb-2">{plan.name}</h3>
              <p className="text-sm text-text-secondary mb-4">{plan.description}</p>
              <div className="flex items-baseline justify-center gap-2">
                <span className="text-4xl font-bold text-text-primary">${plan.price}</span>
                <span className="text-text-secondary text-sm">
                  / {plan.billingPeriod === 'monthly' ? 'شهرياً' : 'سنوياً'}
                </span>
              </div>
            </div>

            {/* Limits */}
            <div className="space-y-2 mb-6 pt-6 border-t border-border">
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-secondary">الطلبات الشهرية:</span>
                <span className="font-semibold text-text-primary">
                  {plan.maxOrders === -1 ? 'غير محدود' : plan.maxOrders.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Status Badge */}
            <div className="mb-4">
              <span
                className={`px-3 py-1 rounded-full text-xs font-medium ${
                  plan.status === 'active'
                    ? 'bg-green-500/10 text-green-500 border border-green-500/20'
                    : 'bg-gray-500/10 text-gray-500 border border-gray-500/20'
                }`}
              >
                {plan.status === 'active' ? 'نشط' : 'غير نشط'}
              </span>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setEditingPlan(plan)}
                className="flex-1 flex items-center justify-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-lg hover:bg-primary/20 transition-all text-sm font-medium"
              >
                <FiEdit2 size={16} />
                تعديل
              </button>
              <button
                onClick={() => handleDeletePlan(plan.id)}
                className="flex items-center justify-center gap-2 bg-red-500/10 text-red-500 px-4 py-2 rounded-lg hover:bg-red-500/20 transition-all text-sm font-medium"
              >
                <FiTrash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add/Edit Plan Modal */}
      {(isAddModalOpen || editingPlan) && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-bg-surface border border-border rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border sticky top-0 bg-bg-surface">
              <h2 className="text-xl font-bold text-text-primary">
                {editingPlan ? 'تعديل الباقة' : 'إضافة باقة جديدة'}
              </h2>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingPlan(null);
                  resetForm();
                }}
                className="p-2 hover:bg-bg-base rounded-lg transition-colors"
              >
                <FiX size={20} className="text-text-secondary" />
              </button>
            </div>

            {/* Form */}
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Arabic Name */}
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    اسم الباقة (عربي) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editingPlan?.name || newPlan.name}
                    onChange={(e) =>
                      editingPlan
                        ? setEditingPlan({ ...editingPlan, name: e.target.value })
                        : setNewPlan({ ...newPlan, name: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm bg-bg-base border border-border rounded-lg focus:outline-none focus:border-primary transition-colors text-text-primary"
                    placeholder="الباقة الأساسية"
                  />
                </div>

                {/* English Name */}
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    اسم الباقة (إنجليزي) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editingPlan?.nameEn || newPlan.nameEn}
                    onChange={(e) =>
                      editingPlan
                        ? setEditingPlan({ ...editingPlan, nameEn: e.target.value })
                        : setNewPlan({ ...newPlan, nameEn: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm bg-bg-base border border-border rounded-lg focus:outline-none focus:border-primary transition-colors text-text-primary"
                    placeholder="Basic Plan"
                  />
                </div>

                {/* Price */}
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    السعر ($) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={editingPlan?.price || newPlan.price}
                    onChange={(e) =>
                      editingPlan
                        ? setEditingPlan({ ...editingPlan, price: Number(e.target.value) })
                        : setNewPlan({ ...newPlan, price: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 text-sm bg-bg-base border border-border rounded-lg focus:outline-none focus:border-primary transition-colors text-text-primary"
                    placeholder="99"
                    min="0"
                  />
                </div>

                {/* Billing Period */}
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    فترة الفوترة <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={editingPlan?.billingPeriod || newPlan.billingPeriod}
                    onChange={(e) =>
                      editingPlan
                        ? setEditingPlan({
                            ...editingPlan,
                            billingPeriod: e.target.value as 'monthly' | 'yearly',
                          })
                        : setNewPlan({ ...newPlan, billingPeriod: e.target.value as 'monthly' | 'yearly' })
                    }
                    className="w-full px-3 py-2 text-sm bg-bg-base border border-border rounded-lg focus:outline-none focus:border-primary transition-colors text-text-primary"
                  >
                    <option value="monthly">شهرياً</option>
                    <option value="yearly">سنوياً</option>
                  </select>
                </div>

                {/* Max Products */}
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    الحد الأقصى للمنتجات <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={editingPlan?.maxProducts || newPlan.maxProducts}
                    onChange={(e) =>
                      editingPlan
                        ? setEditingPlan({ ...editingPlan, maxProducts: Number(e.target.value) })
                        : setNewPlan({ ...newPlan, maxProducts: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 text-sm bg-bg-base border border-border rounded-lg focus:outline-none focus:border-primary transition-colors text-text-primary"
                    placeholder="50 أو -1 لغير محدود"
                  />
                  <p className="text-xs text-text-secondary mt-1">ضع -1 للمنتجات الغير محدودة</p>
                </div>

                {/* Max Orders */}
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    الحد الأقصى للطلبات الشهرية <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={editingPlan?.maxOrders || newPlan.maxOrders}
                    onChange={(e) =>
                      editingPlan
                        ? setEditingPlan({ ...editingPlan, maxOrders: Number(e.target.value) })
                        : setNewPlan({ ...newPlan, maxOrders: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 text-sm bg-bg-base border border-border rounded-lg focus:outline-none focus:border-primary transition-colors text-text-primary"
                    placeholder="1000 أو -1 لغير محدود"
                  />
                  <p className="text-xs text-text-secondary mt-1">ضع -1 للطلبات الغير محدودة</p>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">الوصف</label>
                <textarea
                  rows={3}
                  value={editingPlan?.description || newPlan.description}
                  onChange={(e) =>
                    editingPlan
                      ? setEditingPlan({ ...editingPlan, description: e.target.value })
                      : setNewPlan({ ...newPlan, description: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm bg-bg-base border border-border rounded-lg focus:outline-none focus:border-primary transition-colors text-text-primary resize-none"
                  placeholder="وصف مختصر للباقة"
                />
              </div>

              {/* Checkboxes */}
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingPlan?.isPopular || newPlan.isPopular}
                    onChange={(e) =>
                      editingPlan
                        ? setEditingPlan({ ...editingPlan, isPopular: e.target.checked })
                        : setNewPlan({ ...newPlan, isPopular: e.target.checked })
                    }
                    className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-text-primary">الأكثر طلباً</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={(editingPlan?.status || newPlan.status) === 'active'}
                    onChange={(e) =>
                      editingPlan
                        ? setEditingPlan({ ...editingPlan, status: e.target.checked ? 'active' : 'inactive' })
                        : setNewPlan({ ...newPlan, status: e.target.checked ? 'active' : 'inactive' })
                    }
                    className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-text-primary">نشط</span>
                </label>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-border sticky bottom-0 bg-bg-surface">
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingPlan(null);
                  resetForm();
                }}
                className="px-4 py-2 text-sm font-medium text-text-secondary hover:bg-bg-base rounded-lg transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={editingPlan ? handleUpdatePlan : handleAddPlan}
                className="px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
              >
                {editingPlan ? 'تحديث الباقة' : 'إضافة الباقة'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
