'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  FiPlus,
  FiSearch,
  FiPackage,
  FiLayers,
  FiX,
  FiUpload,
} from 'react-icons/fi';

interface Product {
  id: string;
  name: string;
  packages: number;
  status: 'active' | 'inactive';
  image?: string;
}

export default function CatalogPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newProduct, setNewProduct] = useState({
    name: '',
    status: 'active' as 'active' | 'inactive',
    image: null as File | null,
  });
  const [imagePreview, setImagePreview] = useState<string>('');
  
  const [products, setProducts] = useState<Product[]>([
    {
      id: '1',
      name: 'PUBG Mobile UC',
      packages: 12,
      status: 'active',
    },
    {
      id: '2',
      name: 'Free Fire Diamonds',
      packages: 8,
      status: 'active',
    },
    {
      id: '3',
      name: 'Netflix Subscription',
      packages: 4,
      status: 'active',
    },
  ]);

  const filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setNewProduct({ ...newProduct, image: file });
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddProduct = () => {
    console.log('Adding new product:', newProduct);
    // TODO: API call to add product
    
    // Reset form
    setNewProduct({ name: '', status: 'active', image: null });
    setImagePreview('');
    setIsAddModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-text-primary">
            المنتجات العالمية
          </h1>
        </div>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2 bg-primary text-white px-4 py-3 rounded-lg hover:bg-primary/90 transition-all font-medium cursor-pointer"
        >
          <FiPlus size={20} />
          إضافة منتج
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-bg-surface border border-border rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-text-secondary text-sm">إجمالي المنتجات</p>
              <p className="text-3xl font-bold text-text-primary mt-1">{products.length}</p>
            </div>
            <div className="p-3 rounded-lg bg-purple-500/10">
              <FiPackage className="text-purple-500" size={28} />
            </div>
          </div>
        </div>
        <div className="bg-bg-surface border border-border rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-text-secondary text-sm">إجمالي الباقات</p>
              <p className="text-3xl font-bold text-text-primary mt-1">
                {products.reduce((sum, p) => sum + p.packages, 0)}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-blue-500/10">
              <FiLayers className="text-blue-500" size={28} />
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
            placeholder="ابحث عن منتج..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pr-10 pl-4 py-3 bg-bg-base border border-border rounded-lg focus:outline-none focus:border-primary transition-colors text-text-primary"
          />
        </div>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProducts.map((product) => (
          <div
            key={product.id}
            onClick={() => router.push(`/catalog/${product.id}`)}
            className="bg-bg-surface border border-border rounded-xl p-6 hover:shadow-xl transition-all duration-300 hover:scale-105 cursor-pointer"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 rounded-lg bg-primary text-white">
                <FiPackage size={24} />
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                product.status === 'active' 
                  ? 'bg-green-500/10 text-green-500 border border-green-500/20' 
                  : 'bg-gray-500/10 text-gray-500 border border-gray-500/20'
              }`}>
                {product.status === 'active' ? 'نشط' : 'غير نشط'}
              </span>
            </div>
            
            <h3 className="text-xl font-bold text-text-primary mb-4">{product.name}</h3>
            
            <div className="flex items-center justify-between">
              <div>
                <p className="text-text-secondary text-xs mb-1">عدد الباقات</p>
                <p className="text-text-primary font-bold flex items-center gap-1">
                  <FiLayers size={16} />
                  {product.packages}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Product Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-bg-surface border border-border rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border sticky top-0 bg-bg-surface">
              <h2 className="text-xl font-bold text-text-primary">إضافة منتج جديد</h2>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setNewProduct({ name: '', status: 'active', image: null });
                  setImagePreview('');
                }}
                className="p-2 hover:bg-bg-base rounded-lg transition-colors"
              >
                <FiX size={20} className="text-text-secondary" />
              </button>
            </div>

            {/* Form */}
            <div className="p-6 space-y-6">
              {/* Product Name */}
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  اسم المنتج <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newProduct.name}
                  onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-bg-base border border-border rounded-lg focus:outline-none focus:border-primary transition-colors text-text-primary"
                  placeholder="أدخل اسم المنتج"
                />
              </div>

              {/* Product Image */}
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  صورة المنتج
                </label>
                <div className="border-2 border-dashed border-border rounded-lg p-4 hover:border-primary transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                    id="product-image"
                  />
                  <label
                    htmlFor="product-image"
                    className="flex flex-col items-center justify-center cursor-pointer"
                  >
                    {imagePreview ? (
                      <div className="relative w-full">
                        <img
                          src={imagePreview}
                          alt="Preview"
                          className="w-full h-48 object-cover rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            setNewProduct({ ...newProduct, image: null });
                            setImagePreview('');
                          }}
                          className="absolute top-2 left-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                        >
                          <FiX size={16} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <FiUpload className="text-text-secondary mb-2" size={32} />
                        <p className="text-sm text-text-secondary">اضغط لرفع صورة</p>
                        <p className="text-xs text-text-secondary mt-1">PNG, JPG, GIF حتى 5MB</p>
                      </>
                    )}
                  </label>
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  الحالة <span className="text-red-500">*</span>
                </label>
                <select
                  value={newProduct.status}
                  onChange={(e) => setNewProduct({ ...newProduct, status: e.target.value as 'active' | 'inactive' })}
                  className="w-full px-3 py-2 text-sm bg-bg-base border border-border rounded-lg focus:outline-none focus:border-primary transition-colors text-text-primary"
                >
                  <option value="active">نشط</option>
                  <option value="inactive">غير نشط</option>
                </select>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-border sticky bottom-0 bg-bg-surface">
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setNewProduct({ name: '', status: 'active', image: null });
                  setImagePreview('');
                }}
                className="px-4 py-2 text-sm font-medium text-text-secondary hover:bg-bg-base rounded-lg transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={handleAddProduct}
                disabled={!newProduct.name}
                className="px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                إضافة المنتج
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
