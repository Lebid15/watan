'use client';

import { useState } from 'react';
import {
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiX,
  FiBell,
} from 'react-icons/fi';

interface Notification {
  id: string;
  message: string;
  isActive: boolean;
  createdAt: string;
}

export default function NotificationsPage() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingNotification, setEditingNotification] = useState<Notification | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: '1',
      message: 'سيتم إجراء صيانة دورية على النظام يوم الجمعة القادمة من الساعة 2 صباحاً إلى 4 صباحاً',
      isActive: true,
      createdAt: '2025-11-05',
    },
    {
      id: '2',
      message: 'تم إضافة نظام التقارير المتقدمة الجديد. يمكنك الآن الوصول إليه من قائمة التقارير',
      isActive: false,
      createdAt: '2025-11-03',
    },
  ]);

  const [newNotification, setNewNotification] = useState({
    message: '',
  });

  const activeNotification = notifications.find((n) => n.isActive);

  const handleAddNotification = () => {
    console.log('Adding notification:', newNotification);
    // TODO: API call
    // Deactivate all existing notifications
    const updatedNotifications = notifications.map((n) => ({ ...n, isActive: false }));
    
    const notification: Notification = {
      id: Date.now().toString(),
      message: newNotification.message,
      isActive: true,
      createdAt: new Date().toISOString().split('T')[0],
    };
    setNotifications([notification, ...updatedNotifications]);
    setIsAddModalOpen(false);
    setNewNotification({ message: '' });
  };

  const handleUpdateNotification = () => {
    if (!editingNotification) return;
    console.log('Updating notification:', editingNotification);
    // TODO: API call
    setNotifications(
      notifications.map((n) => (n.id === editingNotification.id ? editingNotification : n))
    );
    setEditingNotification(null);
  };

  const handleDeleteNotification = (id: string) => {
    if (confirm('هل أنت متأكد من حذف هذا الإشعار؟')) {
      console.log('Deleting notification:', id);
      // TODO: API call
      setNotifications(notifications.filter((n) => n.id !== id));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-text-primary">الإشعارات</h1>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2 bg-primary text-white px-4 py-3 rounded-lg hover:bg-primary/90 transition-all font-medium cursor-pointer"
        >
          <FiPlus size={20} />
          إضافة إشعار
        </button>
      </div>

      {/* Current Active Notification */}
      {activeNotification && (
        <div className="bg-blue-500/10 border-2 border-blue-500/30 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <FiBell className="text-blue-500" size={20} />
                <h2 className="text-sm font-bold text-text-primary">آخر إشعار</h2>
              </div>
              <p className="text-base text-text-primary leading-relaxed">{activeNotification.message}</p>
              <p className="text-xs text-text-secondary mt-2">تاريخ الإنشاء: {activeNotification.createdAt}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => setEditingNotification(activeNotification)}
                className="p-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-all"
                title="تعديل"
              >
                <FiEdit2 size={18} />
              </button>
              <button
                onClick={() => handleDeleteNotification(activeNotification.id)}
                className="p-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20 transition-all"
                title="حذف"
              >
                <FiTrash2 size={18} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {(isAddModalOpen || editingNotification) && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-bg-surface border border-border rounded-xl shadow-2xl max-w-2xl w-full">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h2 className="text-xl font-bold text-text-primary">
                {editingNotification ? 'تعديل الإشعار' : 'إضافة إشعار جديد'}
              </h2>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingNotification(null);
                  setNewNotification({ message: '' });
                }}
                className="p-2 hover:bg-bg-base rounded-lg transition-colors"
              >
                <FiX size={20} className="text-text-secondary" />
              </button>
            </div>

            {/* Form */}
            <div className="p-6 space-y-6">
              {/* Message */}
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  نص الإشعار <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={4}
                  value={editingNotification?.message || newNotification.message}
                  onChange={(e) =>
                    editingNotification
                      ? setEditingNotification({ ...editingNotification, message: e.target.value })
                      : setNewNotification({ message: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm bg-bg-base border border-border rounded-lg focus:outline-none focus:border-primary transition-colors text-text-primary resize-none"
                  placeholder="اكتب نص الإشعار هنا..."
                />
                <p className="text-xs text-text-secondary mt-2">
                  {editingNotification
                    ? 'سيتم تحديث الإشعار فقط دون تفعيله'
                    : 'سيتم تفعيل هذا الإشعار تلقائياً وإخفاء الإشعار النشط الحالي'}
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-border">
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingNotification(null);
                  setNewNotification({ message: '' });
                }}
                className="px-4 py-2 text-sm font-medium text-text-secondary hover:bg-bg-base rounded-lg transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={editingNotification ? handleUpdateNotification : handleAddNotification}
                disabled={!(editingNotification?.message || newNotification.message)}
                className="px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editingNotification ? 'تحديث' : 'إضافة وتفعيل'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
