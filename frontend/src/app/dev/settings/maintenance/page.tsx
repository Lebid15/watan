"use client";
import { MaintenanceToggle } from './MaintenanceToggle';

export default function DevMaintenanceSettingsPage() {
  return (
    <div className="p-6" dir="rtl">
      <h1 className="text-2xl font-bold mb-4">وضع الصيانة</h1>
      <MaintenanceToggle />
    </div>
  );
}
