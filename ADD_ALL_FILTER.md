# إضافة خيار "الكل" في فلتر المنتجات ✅

## التاريخ: 14 أكتوبر 2025

## الطلب

المستخدم يريد خيار **"الكل"** في قائمة المنتجات لعرض جميع الباقات من كل المنتجات بدون فلترة.

## التغييرات

### 1. إضافة "الكل" في قائمة الخيارات

```typescript
const productSuggestions = useMemo(() => {
  const baseOptions = productOptions.length
    ? productOptions
    : Array.from(new Set(rows.map((r) => r.our_package_name?.split(' ')?.[0] || '').filter(Boolean)));
  
  // إضافة خيار "الكل" في البداية
  return ['الكل', ...baseOptions];
}, [productOptions, rows]);
```

### 2. القيمة الافتراضية = "الكل"

```typescript
const [product, setProduct] = useState<string>(searchParams.get('product') || 'الكل');
```

### 3. تحديث دالة `applyFilter`

```typescript
const applyFilter = (nextProduct: string) => {
  const qp = new URLSearchParams(searchParams.toString());
  
  // إذا كان "الكل" لا نرسل فلتر للـ backend
  if (nextProduct && nextProduct !== 'الكل') {
    qp.set('product', nextProduct);
  } else {
    qp.delete('product');
  }
  
  const qs = qp.toString();
  const url = qs ? `/admin/products/integrations/${id}?${qs}` : `/admin/products/integrations/${id}`;
  router.replace(url);
};
```

### 4. تحديث دالة `load`

```typescript
const load = async (options?: LoadOptions): Promise<Row[]> => {
  if (!id) return [];
  const targetProduct = options?.productOverride ?? product;
  setLoading(true);
  setError('');
  if (!options?.preserveMsg) setMsg('');
  
  try {
    // إذا كان "الكل" لا نرسل query parameter
    const productParam = targetProduct && targetProduct !== 'الكل' 
      ? `?product=${encodeURIComponent(targetProduct)}` 
      : '';
    
    const { data } = await api.get<{ api: ApiInfo; packages: Row[] }>(
      `${API_ROUTES.admin.integrations.packages(String(id))}${productParam}`
    );
    // ...
  }
}
```

## النتيجة

### القائمة المنسدلة الآن تحتوي على:
```
┌─────────────────────────┐
│ الكل                     │  ← جديد! يعرض كل المنتجات
│ Crystal                 │
│ Ahlan                   │
│ Pubg Mobile Global      │
│ ...                     │
└─────────────────────────┘
```

### السلوك:

1. **عند اختيار "الكل"**:
   - لا يُرسل `?product=...` للـ backend
   - يعرض جميع الباقات من كل المنتجات
   - مفيد للحصول على نظرة شاملة

2. **عند اختيار منتج محدد** (مثل "Crystal"):
   - يُرسل `?product=Crystal` للـ backend
   - يعرض فقط باقات Crystal
   - مفيد للتركيز على منتج واحد

3. **القيمة الافتراضية** عند فتح الصفحة:
   - **"الكل"** (بدلاً من أول منتج)
   - المستخدم يرى كل شيء من البداية

## الفوائد

✅ **مرونة أكبر** - المستخدم يتحكم في ما يراه  
✅ **نظرة شاملة** - رؤية كل الباقات دفعة واحدة  
✅ **سهولة المقارنة** - مقارنة باقات من منتجات مختلفة  
✅ **أفضل UX** - تجربة مستخدم محسّنة  

## الملف المعدل

**frontend/src/app/integrations/[id]/page.tsx**

السطور المعدلة:
- 318: القيمة الافتراضية = "الكل"
- 347-353: إضافة "الكل" في productSuggestions
- 371-379: تحديث دالة load لدعم "الكل"
- 414-423: تحديث دالة applyFilter لدعم "الكل"
- 340-350: إزالة التحديد التلقائي لأول منتج

---

**الحالة**: ✅ جاهز للاستخدام  
**تم الاختبار**: ✅  
**المستخدم**: سعيد 😊
