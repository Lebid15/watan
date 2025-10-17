'use client';
import React from 'react';
import type { Announcement } from '@/types/dashboard';

interface AnnouncementCardProps {
  announcement: Announcement;
}

const AnnouncementCard: React.FC<AnnouncementCardProps> = ({ announcement }) => {
  // ألوان حسب النوع
  const typeColors: Record<string, { bg: string; border: string; text: string; badge: string }> = {
    info: {
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      border: 'border-blue-200 dark:border-blue-800',
      text: 'text-blue-900 dark:text-blue-100',
      badge: 'bg-blue-500',
    },
    success: {
      bg: 'bg-green-50 dark:bg-green-900/20',
      border: 'border-green-200 dark:border-green-800',
      text: 'text-green-900 dark:text-green-100',
      badge: 'bg-green-500',
    },
    warning: {
      bg: 'bg-yellow-50 dark:bg-yellow-900/20',
      border: 'border-yellow-200 dark:border-yellow-800',
      text: 'text-yellow-900 dark:text-yellow-100',
      badge: 'bg-yellow-500',
    },
    update: {
      bg: 'bg-purple-50 dark:bg-purple-900/20',
      border: 'border-purple-200 dark:border-purple-800',
      text: 'text-purple-900 dark:text-purple-100',
      badge: 'bg-purple-500',
    },
    announcement: {
      bg: 'bg-cyan-50 dark:bg-cyan-900/20',
      border: 'border-cyan-200 dark:border-cyan-800',
      text: 'text-cyan-900 dark:text-cyan-100',
      badge: 'bg-cyan-500',
    },
  };

  const colors = typeColors[announcement.announcement_type] || typeColors.info;

  // أيقونات حسب النوع
  const typeIcons: Record<string, string> = {
    info: '💡',
    success: '✅',
    warning: '⚠️',
    update: '🔄',
    announcement: '📢',
  };

  const icon = announcement.icon || typeIcons[announcement.announcement_type] || '📌';

  return (
    <div
      dir="rtl"
      className={`
        relative rounded-lg border-2 p-4 sm:p-6 shadow-sm transition-all duration-200
        hover:shadow-md ${colors.bg} ${colors.border} w-full
      `}
    >
      {/* Badge النوع */}
      <div className="absolute top-3 right-3">
        <span
          className={`
            inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold
            text-white ${colors.badge}
          `}
        >
          {announcement.type_display}
        </span>
      </div>

      {/* المحتوى */}
      <div className="mt-8">
        {/* العنوان */}
        <div className="flex items-start gap-3 mb-3 flex-wrap">
          <span className="text-2xl flex-shrink-0">{icon}</span>
          <h3 className={`text-lg sm:text-xl font-bold ${colors.text} flex-1 break-words`}>
            {announcement.title}
          </h3>
        </div>

        {/* النص */}
        <div
          className={`
            prose prose-sm max-w-none ${colors.text} 
            break-words overflow-wrap-anywhere
            [&>*]:text-right [&_p]:text-right [&_ul]:text-right [&_ol]:text-right
            [&_h1]:text-right [&_h2]:text-right [&_h3]:text-right
          `}
          dangerouslySetInnerHTML={{ __html: announcement.content }}
        />

        {/* التاريخ */}
        <div className="mt-4 text-xs opacity-60 text-right">
          {new Date(announcement.created_at).toLocaleDateString('ar', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            calendar: 'gregory'
          })}
        </div>
      </div>

      {/* إذا كان خاص بمستأجر */}
      {!announcement.is_global && (
        <div className="absolute bottom-3 left-3">
          <span className="text-xs opacity-50">🔒 خاص</span>
        </div>
      )}
    </div>
  );
};

export default AnnouncementCard;
