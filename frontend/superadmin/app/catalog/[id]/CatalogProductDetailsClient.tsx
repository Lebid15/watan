'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  FiArrowRight,
  FiPackage,
  FiEdit,
  FiPlus,
  FiDollarSign,
  FiLayers,
  FiTrash2,
} from 'react-icons/fi';

type Tab = 'packages' | 'edit';

interface Package {
  id: string;
  name: string;
  cost: string;
  linkNumber: string;
  status: 'active' | 'inactive';
}

export default function CatalogProductDetailsClient({ id }: { id: string }) {
  const router = useRouter();
  
  const [activeTab, setActiveTab] = useState<Tab>('packages');
  const [packages, setPackages] = useState<Package[]>([
    { id: '1', name: '60 UC', cost: '$0.80', linkNumber: '60', status: 'active' },
    { id: '2', name: '325 UC', cost: '$4.20', linkNumber: '325', status: 'active' },
    { id: '3', name: '660 UC', cost: '$8.50', linkNumber: '660', status: 'active' },
  ]);
  
  const [productData, setProductData] = useState({
    name: 'PUBG Mobile UC',
    status: 'active',
    image: '',
  });

  const handlePackageUpdate = (pkgId: string, field: keyof Package, value: string) => {
    setPackages((prevPackages) =>
      prevPackages.map((pkg) =>
        pkg.id === pkgId ? { ...pkg, [field]: value } : pkg
      )
    );
    // TODO: إضافة API call للحفظ التلقائي
    console.log('Auto-saving:', pkgId, field, value);
  };

  return (
    <div className="space-y-6">
      {/* Header with Back Button */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-lg hover:bg-bg-surface-hover transition-colors"
        >
          <FiArrowRight size={24} className="text-text-primary" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-text-primary">
            {productData.name}
          </h1>
        </div>
      </div>

      {/* Tabs Header */}
      <div className="bg-bg-surface border border-border rounded-xl overflow-hidden">
        <div className="flex border-b border-border">
          <button
            onClick={() => setActiveTab('packages')}
            className={`flex-1 px-6 py-4 text-sm font-medium transition-colors cursor-pointer ${
              activeTab === 'packages'
                ? 'bg-primary/10 text-primary border-b-2 border-primary'
                : 'text-text-secondary hover:bg-bg-surface-hover'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <FiLayers size={18} />
              الباقات
            </div>
          </button>
          <button
            onClick={() => setActiveTab('edit')}
            className={`flex-1 px-6 py-4 text-sm font-medium transition-colors cursor-pointer ${
              activeTab === 'edit'
                ? 'bg-primary/10 text-primary border-b-2 border-primary'
                : 'text-text-secondary hover:bg-bg-surface-hover'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <FiEdit size={18} />
              تعديل المنتج
            </div>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'packages' && (
            <div className="space-y-6">
              {/* Add Package Button */}
              <div className="flex justify-end">
                <button className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 text-sm rounded-lg hover:bg-primary/90 transition-colors font-medium cursor-pointer">
                  <FiPlus size={18} />
                  إضافة باقة
                </button>
              </div>

              {/* Packages Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {packages.map((pkg) => (
                  <div
                    key={pkg.id}
                    className="bg-bg-surface border border-border rounded-xl p-5 hover:shadow-lg transition-all hover:border-primary/30"
                  >
                    {/* Package Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <FiPackage className="text-primary" size={20} />
                        </div>
                        <div className="flex-1">
                          <input
                            type="text"
                            value={pkg.name}
                            onChange={(e) => handlePackageUpdate(pkg.id, 'name', e.target.value)}
                            onBlur={() => console.log('Saved:', pkg.name)}
                            className="text-lg font-bold text-text-primary bg-transparent border-none focus:outline-none w-full p-0"
                          />
                        </div>
                      </div>
                      <button 
                        className="p-2 rounded-lg hover:bg-red-500/10 text-red-500 transition-colors"
                        title="حذف الباقة"
                      >
                        <FiTrash2 size={16} />
                      </button>
                    </div>

                    {/* Package Details */}
                    <div className="space-y-3">
                      {/* Cost */}
                      <div>
                        <label className="block text-xs text-text-secondary mb-1.5">التكلفة</label>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-2 bg-bg-base border border-border rounded-lg px-3 py-2 focus-within:border-primary transition-colors flex-1">
                            <input
                              type="text"
                              value={pkg.cost.replace('$', '')}
                              onChange={(e) => handlePackageUpdate(pkg.id, 'cost', `$${e.target.value}`)}
                              onBlur={() => console.log('Saved:', pkg.cost)}
                              className="text-sm text-text-primary bg-transparent border-none focus:outline-none w-full"
                              placeholder="0.00"
                            />
                          </div>
                          <div className="flex items-center justify-center px-2 py-2 bg-bg-surface-alt border border-border rounded-lg">
                            <FiDollarSign size={16} className="text-text-secondary" />
                          </div>
                        </div>
                      </div>

                      {/* Link Number */}
                      <div>
                        <label className="block text-xs text-text-secondary mb-1.5">رقم الربط</label>
                        <input
                          type="text"
                          value={pkg.linkNumber}
                          onChange={(e) => handlePackageUpdate(pkg.id, 'linkNumber', e.target.value)}
                          onBlur={() => console.log('Saved:', pkg.linkNumber)}
                          className="w-full text-sm text-text-primary bg-bg-base border border-border focus:outline-none focus:border-primary rounded-lg px-3 py-2 transition-colors"
                          placeholder="رقم الربط"
                        />
                      </div>

                      {/* Status */}
                      <div>
                        <label className="block text-xs text-text-secondary mb-1.5">الحالة</label>
                        <select
                          value={pkg.status}
                          onChange={(e) => handlePackageUpdate(pkg.id, 'status', e.target.value)}
                          className={`w-full px-3 py-2 rounded-lg text-sm font-medium border cursor-pointer focus:outline-none focus:border-primary transition-colors bg-bg-base ${
                            pkg.status === 'active'
                              ? 'text-green-500 border-green-500/30'
                              : 'text-gray-500 border-gray-500/30'
                          }`}
                        >
                          <option value="active">نشط</option>
                          <option value="inactive">غير نشط</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'edit' && (
            <form className="space-y-6 max-w-2xl">
              {/* Product Name */}
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  اسم المنتج
                </label>
                <input
                  type="text"
                  value={productData.name}
                  onChange={(e) => setProductData({ ...productData, name: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-bg-base border border-border rounded-lg focus:outline-none focus:border-primary transition-colors text-text-primary"
                  placeholder="أدخل اسم المنتج"
                />
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  الحالة
                </label>
                <select
                  value={productData.status}
                  onChange={(e) => setProductData({ ...productData, status: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-bg-base border border-border rounded-lg focus:outline-none focus:border-primary transition-colors text-text-primary"
                >
                  <option value="active">نشط</option>
                  <option value="inactive">غير نشط</option>
                </select>
              </div>

              {/* Product Image */}
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  صورة المنتج
                </label>
                <label className="flex items-center justify-center gap-2 px-4 py-8 bg-bg-base border-2 border-dashed border-border rounded-lg hover:border-primary transition-colors cursor-pointer">
                  <FiPackage size={24} className="text-text-secondary" />
                  <span className="text-sm text-text-secondary">اضغط لرفع صورة المنتج</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                  />
                </label>
              </div>

              {/* Save Button */}
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-primary text-white text-sm rounded-lg hover:bg-primary/90 transition-colors font-medium"
                >
                  حفظ التعديلات
                </button>
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="px-6 py-2.5 bg-bg-base text-text-primary text-sm rounded-lg hover:bg-bg-surface-hover transition-colors font-medium border border-border"
                >
                  إلغاء
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}