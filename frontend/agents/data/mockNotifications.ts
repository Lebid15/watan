// بيانات الإشعارات الوهمية

export interface MockNotification {
  id: string;
  title: string;
  message: string;
  link?: string | null;
  isRead: boolean;
  createdAt: string;
}

export const MOCK_NOTIFICATIONS: MockNotification[] = [
  {
    id: 'notif-001',
    title: 'تحديث الموقع',
    message: 'هناك تحديث جديد على الموقع. تم تحسين الأداء وإضافة منتجات جديدة.',
    isRead: false,
    createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString() // قبل 10 دقائق
  },
  {
    id: 'notif-002',
    title: 'عرض خاص',
    message: 'تخفيض على أسعار ببجي! احصل على UC بأسعار مخفضة لفترة محدودة.',
    isRead: false,
    createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString() // قبل 30 دقيقة
  },
  {
    id: 'notif-003',
    title: 'منتجات جديدة',
    message: 'تمت إضافة بطاقات Roblox و Mobile Legends إلى المتجر. اطلبها الآن!',
    isRead: false,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() // قبل ساعتين
  },
  {
    id: 'notif-004',
    title: 'عرض نهاية الأسبوع',
    message: 'خصم 15% على جميع بطاقات Google Play و iTunes. العرض ساري حتى الأحد.',
    isRead: true,
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString() // قبل 5 ساعات
  },
  {
    id: 'notif-005',
    title: 'صيانة مجدولة',
    message: 'سيتم إجراء صيانة على الموقع يوم السبت من الساعة 2 صباحاً حتى 4 صباحاً.',
    isRead: true,
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() // قبل يوم
  },
  {
    id: 'notif-006',
    title: 'توفر Steam Wallet',
    message: 'بطاقات Steam Wallet متوفرة الآن! احصل على ألعابك المفضلة.',
    isRead: true,
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() // قبل 3 أيام
  },
  {
    id: 'notif-007',
    title: 'تحسينات في الخدمة',
    message: 'تم تحسين سرعة معالجة الطلبات. الآن طلباتك تصل بشكل أسرع!',
    isRead: true,
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() // قبل 5 أيام
  },
  {
    id: 'notif-008',
    title: 'عروض Free Fire',
    message: 'عروض خاصة على الماسات! احصل على 10% إضافية عند شراء باقات Free Fire الكبيرة.',
    isRead: true,
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() // قبل أسبوع
  },
  {
    id: 'notif-009',
    title: 'دعم فني محسّن',
    message: 'الآن يمكنك التواصل مع الدعم الفني بشكل أسرع عبر صفحة المساعدة الجديدة.',
    isRead: true,
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString() // قبل 10 أيام
  },
  {
    id: 'notif-010',
    title: 'اشتراكات Netflix',
    message: 'بطاقات Netflix متوفرة بجميع الفئات. استمتع بمشاهدة مسلسلاتك المفضلة!',
    isRead: true,
    createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString() // قبل أسبوعين
  }
];
