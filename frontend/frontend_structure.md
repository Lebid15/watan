# 🎨 Design System - نظام التصميم

## 📁 Frontend Structure

```
src/
 ├─ app/
 │   ├─ page.tsx              ← الصفحة الجذرية "/" (صفحة عامة أو Landing)
 │   │
 │   ├─ super_admin/                ← لوحة السوبر أدمن
 │   │   ├─ layout.tsx
 │   │   ├─ dashboard/page.tsx
 │   │   └─ users/page.tsx
 │   │
 │   ├─ tenant/               ← لوحة المستأجر (ساب دومين)
 │   │   ├─ layout.tsx
 │   │   ├─ dashboard/page.tsx
 │   │   └─ products/page.tsx
 │   │
 │   ├─ agent/               ← لوحة العملاء (واجهة المتجر)
 │   │   ├─ layout.tsx
 │   │   ├─ page.tsx
 │   │   └─ orders/page.tsx
 │   │
 │   ├─ login/page.tsx
 │   └─ register/page.tsx
 │
 ├─ components/
 │   ├─ layout/               ← عناصر مشتركة (Header, Sidebar...)
 │   ├─ ui/                   ← أزرار + Inputs + Cards...
 │   ├─ 3d/                   ← مكونات Three.js
 │   └─ theme/                ← Theme Provider & Toggle
 │
 ├─ styles/globals.css
 ├─ lib/
 │   └─ three-setup.ts        ← Three.js configuration
 └─ utils/api.ts
```

---

## 🎨 Design System - نظام التصميم الحالي

### 📋 **آخر التحديثات - Latest Updates**

#### **✅ تحديثات السايدبار - Sidebar Updates (Nov 2, 2025)**

**1. معلومات المستخدم في الهيدر:**
```html
<div class="sidebar-header">
    <button id="sidebar-toggle" class="sidebar-toggle-btn">
        <span class="toggle-icon">☰</span>
    </button>
    <div class="sidebar-user-info">
        <h3 class="sidebar-username">أحمد علي</h3>
        <p class="sidebar-userid">#66521</p>
    </div>
</div>
```

**2. تخطيط السايدبار:**
- **الموقع:** يمين الشاشة بالكامل (position: fixed, right: 0, top: 0, height: 100vh)
- **العرض:** 280px عادي → 80px عند الطي
- **z-index:** 999 (فوق كل العناصر)
- **الهيدر الرئيسي:** يتموضع على يسار السايدبار (right: 280px)

**3. قائمة السايدبار (9 عناصر):**
```
📦 المنتجات
🛒 طلباتي  
💳 دفعاتي
💼 المحفظة
💰 إضافة رصيد
🔒 الحماية
🔌 API
ℹ️ من نحن
🌙 تغيير الثيم
```

**4. تباعد مضغوط:**
```css
.sidebar-menu { gap: 0.15rem; }
.menu-item { padding: 0.5rem 1rem; }
```

**5. تصميم معلومات المستخدم:**
```css
.sidebar-user-info {
    flex: 1;
    text-align: right;
    transition: all 0.3s ease;
}

.sidebar-username {
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--beige-800);
}

.sidebar-userid {
    font-size: 0.85rem;
    color: var(--beige-600);
    opacity: 0.8;
}

/* عند الطي */
.main-sidebar.collapsed .sidebar-user-info {
    opacity: 0;
    width: 0;
    overflow: hidden;
}
```

**6. منتجات الألعاب (9 منتجات):**
- PUBG, Free Fire, Likee, Yoho, Ahlan, Oohla, Hiya, SoulChill, PartyStar
- الصور من: `../images/{product}.{jpg,png,jpeg}`
- شبكة متجاوبة: 6 أعمدة → 5 → 4 → 3 → 2 → 1

**7. تفاعل السايدبار:**
```javascript
sidebarToggle.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    // يخفي: .menu-text, .user-info, .sidebar-user-info
});
```

---

### 1️⃣ **Color Palette - لوحة الألوان**

#### **Light Theme (Beige) - الثيم الفاتح**
```css
:root {
    /* Beige Shades */
    --beige-50: #faf8f5;
    --beige-100: #f5f1e8;
    --beige-200: #ebe5d6;
    --beige-300: #d9cdb8;
    --beige-400: #c4b299;
    --beige-500: #a89478;
    --beige-600: #8d7860;
    --beige-700: #6f5f4b;
    --beige-800: #584b3a;
    --beige-900: #3d3329;
    
    /* Accent Colors */
    --gold: #d4af37;
    --gold-light: #e8c872;
    --bronze: #cd7f32;
    --coral: #ff9b82;
    --sage: #9caf88;
    --sky: #a8d5e2;
    
    /* Shadows */
    --shadow-sm: 0 2px 8px rgba(61, 51, 41, 0.08);
    --shadow-md: 0 4px 16px rgba(61, 51, 41, 0.12);
    --shadow-lg: 0 8px 32px rgba(61, 51, 41, 0.16);
    --shadow-xl: 0 16px 48px rgba(61, 51, 41, 0.2);
}
```

#### **Dark Theme - الثيم الداكن**
```css
body.dark-theme {
    background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%);
    color: var(--beige-100);
}
```

---

### 2️⃣ **Typography - الخطوط**

```css
body {
    font-family: 'Cairo', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

/* Heading Sizes */
h1: clamp(3rem, 8vw, 6rem);
h2: clamp(2.5rem, 5vw, 4rem);
h3: 1.3rem - 1.8rem;
h4: 1.5rem;

/* Body Text */
p: 0.85rem - 1.05rem;
small: 0.75rem;
```

---

### 3️⃣ **3D Background System - نظام الخلفية ثلاثية الأبعاد**

#### **Three.js Setup**
```javascript
// Scene Configuration
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ 
    alpha: true,      // خلفية شفافة
    antialias: true   // تحسين الحواف
});

camera.position.z = 50;
```

#### **Floating Shapes - الأشكال الطافية**
```javascript
// 7 أنواع من الأشكال الهندسية
const geometries = [
    BoxGeometry,        // مكعبات (30 من 50 - غالبية)
    SphereGeometry,     // كرات
    ConeGeometry,       // أهرامات
    TorusGeometry,      // حلقات
    OctahedronGeometry, // ثماني الأوجه
    TetrahedronGeometry,// رباعي الأوجه
    IcosahedronGeometry // عشريني الأوجه
];

// إجمالي: 50 شكل متحرك
```

#### **Materials - المواد**

**للثيم الفاتح (بني داكن - واضح):**
```javascript
const materialsLight = [
    { color: 0x4a3728, opacity: 0.95 }, // بني شوكولاتة
    { color: 0x3d3329, opacity: 0.9 },  // بني قهوة
    { color: 0x584b3a, opacity: 0.95 }, // بني خشبي
    { color: 0x6f5f4b, opacity: 0.85 }, // بني غامق
    { color: 0x5c4a37, opacity: 0.95 }  // بني كاكاو
];
```

**للثيم الداكن (ذهبي ساطع):**
```javascript
const materialsDark = [
    { color: 0xd4af37, opacity: 0.8 },  // ذهبي
    { color: 0xcd7f32, opacity: 0.75 }, // برونزي
    { color: 0xe8c872, opacity: 0.8 },  // ذهبي فاتح
    { color: 0xffd700, opacity: 0.7 },  // ذهبي لامع
    { color: 0xdaa520, opacity: 0.85 }  // ذهبي داكن
];
```

#### **Animation Logic - منطق الحركة**
```javascript
// لكل شكل:
- velocityX, velocityY, velocityZ  // سرعة الحركة
- rotationSpeedX, Y, Z             // سرعة الدوران
- Pulse Effect                     // تأثير النبض

// Boundary Check - الارتداد عن الحدود
if (Math.abs(position.x) > 50) velocity.x *= -1;
```

#### **Particle System - نظام الجزيئات**
```javascript
// 100 جزيء صغير
- Size: 0.5
- Color: يتغير مع الثيم
- Blending: Additive (إضافة ضوئية)
```

#### **Lighting - الإضاءة**
```javascript
// Ambient Light
color: 0xffffff, intensity: 0.6

// Point Light 1 (ذهبي)
position: (25, 25, 25)

// Point Light 2 (برونزي)
position: (-25, -25, 25)

// Dark Theme: تتحول للذهبي الساطع
```

---

### 4️⃣ **Interactive Cards - الكروت التفاعلية**

#### **Card Structure**
```html
<div class="card-3d" data-tilt>
    <div class="card-inner">
        <div class="card-icon">🚀</div>
        <h3 class="card-title">عنوان</h3>
        <p class="card-desc">وصف</p>
        <div class="card-stats">
            <div class="stat">
                <span class="stat-value">95%</span>
                <span class="stat-label">رضا</span>
            </div>
        </div>
        <button class="card-btn">استكشف</button>
    </div>
</div>
```

#### **Card Styling**
```css
/* Glass Morphism Effect */
background: linear-gradient(135deg, 
    rgba(255, 255, 255, 0.9), 
    rgba(245, 241, 232, 0.8)
);
backdrop-filter: blur(20px);
border-radius: 16px;
border: 2px solid rgba(255, 255, 255, 0.5);
box-shadow: var(--shadow-lg);

/* Dark Theme */
background: linear-gradient(135deg, 
    rgba(40, 40, 40, 0.9), 
    rgba(50, 50, 50, 0.8)
);
border-color: rgba(212, 175, 55, 0.3);
```

#### **3D Tilt Effect - تأثير الإمالة**
```javascript
card.addEventListener('mousemove', (e) => {
    const rotateX = (y - centerY) / 20;  // حساسية 20
    const rotateY = (centerX - x) / 20;
    
    card.style.transform = `
        perspective(1000px) 
        rotateX(${-rotateX}deg) 
        rotateY(${rotateY}deg)
        translateZ(10px)
    `;
});
```

#### **Card Grid Layout**
```css
.cards-section {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 300px));
    gap: 1.5rem;
    justify-content: center;
    max-width: 1200px;
}
```

---

### 5️⃣ **Buttons - الأزرار**

#### **Primary Button**
```css
.btn-primary {
    background: linear-gradient(135deg, var(--gold), var(--bronze));
    color: white;
    border-radius: 50px;
    padding: 1.2rem 3rem;
    box-shadow: var(--shadow-md);
}

.btn-primary:hover {
    transform: translateY(-3px) scale(1.05);
    box-shadow: var(--shadow-xl);
}
```

#### **Ripple Effect - تأثير الموجة**
```javascript
button.addEventListener('click', (e) => {
    // إنشاء دائرة متوسعة عند النقر
    const ripple = createElement('span');
    ripple.style.animation = 'rippleEffect 0.6s ease-out';
});
```

---

### 6️⃣ **Theme Toggle - تبديل الثيم**

#### **Toggle Button**
```html
<button id="theme-toggle" class="theme-toggle">
    <span class="theme-icon">🌙</span>
</button>
```

#### **Toggle Logic**
```javascript
themeToggle.addEventListener('click', () => {
    isDarkTheme = !isDarkTheme;
    document.body.classList.toggle('dark-theme');
    
    // تغيير الأيقونة
    themeIcon.textContent = isDarkTheme ? '☀️' : '🌙';
    
    // تحديث Three.js
    - Fog للثيم الداكن
    - تغيير ألوان الأشكال
    - تغيير ألوان الإضاءة
    - تغيير لون الجزيئات
});
```

---

### 7️⃣ **Animations - الأنيميشن**

#### **Keyframe Animations**
```css
@keyframes fadeInUp {
    from { opacity: 0; transform: translateY(30px); }
    to { opacity: 1; transform: translateY(0); }
}

@keyframes cardFloat {
    from { opacity: 0; transform: translateY(50px) rotateX(-15deg); }
    to { opacity: 1; transform: translateY(0) rotateX(0); }
}

@keyframes iconBounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-3px); }
}
```

#### **Staggered Animations - أنيميشن متتابع**
```css
.card-3d:nth-child(1) { animation-delay: 0.1s; }
.card-3d:nth-child(2) { animation-delay: 0.2s; }
.card-3d:nth-child(3) { animation-delay: 0.3s; }
/* ... */
```

---

### 8️⃣ **Responsive Design - التصميم المتجاوب**

```css
@media (max-width: 768px) {
    /* Mobile Adjustments */
    .cards-section {
        grid-template-columns: 1fr;
        gap: 2rem;
    }
    
    .cta-buttons {
        flex-direction: column;
        width: 100%;
    }
    
    /* تقليل حركة الأشكال */
    shapes.forEach(shape => {
        shape.userData.rotationSpeed *= 0.5;
    });
}
```

---

### 9️⃣ **Performance Optimization - تحسين الأداء**

```javascript
// تقليل الأنيميشن على الأجهزة الضعيفة
if (window.devicePixelRatio > 2 || window.innerWidth < 768) {
    shapes.forEach(shape => {
        shape.userData.rotationSpeedX *= 0.5;
        shape.userData.rotationSpeedY *= 0.5;
        shape.userData.rotationSpeedZ *= 0.5;
    });
}

// Intersection Observer للأنيميشن عند الظهور
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
        }
    });
});
```

---

## 🚀 Next.js Implementation Plan - خطة التطبيق

### **Phase 1: Setup**
1. ✅ إنشاء Next.js 14+ project
2. ✅ تثبيت Three.js: `npm install three @types/three`
3. ✅ إنشاء Theme Provider بـ Context API
4. ✅ إعداد CSS Variables في `globals.css`

### **Phase 2: Components**
```
components/
├─ 3d/
│  ├─ ThreeBackground.tsx     ← Canvas + Shapes
│  ├─ FloatingShape.tsx       ← كل شكل منفصل
│  └─ ParticleSystem.tsx      ← نظام الجزيئات
│
├─ theme/
│  ├─ ThemeProvider.tsx       ← Context
│  └─ ThemeToggle.tsx         ← زر التبديل
│
└─ ui/
   ├─ Card3D.tsx              ← الكرت التفاعلي
   ├─ Button.tsx              ← الأزرار
   └─ FeatureCard.tsx         ← كرت المميزات
```

### **Phase 3: Integration**
- استخدام `'use client'` للمكونات التفاعلية
- Server Components للصفحات الثابتة
- Dynamic imports لـ Three.js (تحسين الأداء)

---

## 📝 ملاحظات هامة

### **✅ نقاط القوة:**
1. تصميم ثلاثي الأبعاد حقيقي وتفاعلي
2. ثيمين (فاتح/داكن) بتبديل سلس
3. أنيميشن متقدم وسلس
4. Glass Morphism على الكروت
5. تفاعل مع الماوس (Parallax + Tilt)
6. Responsive على جميع الشاشات

### **🔧 للتحسين في Next.js:**
1. إضافة Header + Sidebar
2. نظام Routing متقدم
3. Authentication UI
4. Dashboard Layouts
5. Forms + Validation
6. Data Tables
7. Modals + Dialogs

---

## 🎯 الخطوة التالية

الآن جاهزون لـ:
1. **إضافة Header/Sidebar** للديمو
2. **تجربة تخطيطات مختلفة**
3. **نقل الطريقة** إلى Next.js بعد الاستقرار على التصميم

**هل نبدأ بإضافة Header + Sidebar للديمو؟** 🚀
