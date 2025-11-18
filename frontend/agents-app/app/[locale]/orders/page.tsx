"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Search } from "lucide-react";

export default function OrdersPage() {
  const t = useTranslations("orders");
  const locale = useLocale();
  const isRTL = locale === "ar";

  const [dateFrom, setDateFrom] = useState("2025-11-02");
  const [dateTo, setDateTo] = useState("2025-11-02");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // بيانات الطلبات التجريبية
  const orders = [
    {
      id: "55ff2g5t5",
      package: "ببجي 325 شدة",
      cost: "2",
      price: "3",
      status: "completed",
      date: "2025-11-03",
      time: "14:30",
      playerId: "5542145454212",
      additionalField: "the_king",
      duration: "30 ثا"
    },
    {
      id: "88aa3h9r2",
      package: "ببجي 660 شدة",
      cost: "4",
      price: "5.5",
      status: "completed",
      date: "2025-11-03",
      time: "13:15",
      playerId: "7789654123698",
      additionalField: "pro_gamer",
      duration: "1 د"
    },
    {
      id: "22bb5k1w8",
      package: "فري فاير 500 جوهرة",
      cost: "3",
      price: "4.2",
      status: "pending",
      date: "2025-11-03",
      time: "12:45",
      playerId: "4521369874521",
      additionalField: "fire_master",
      duration: "2 د"
    },
    {
      id: "99cc7m3p4",
      package: "ببجي 1800 شدة",
      cost: "10",
      price: "13",
      status: "rejected",
      date: "2025-11-03",
      time: "11:20",
      playerId: "9638527410258",
      additionalField: "sniper_x",
      duration: "45 ثا"
    },
    {
      id: "44dd9n6q1",
      package: "فري فاير 1000 جوهرة",
      cost: "6",
      price: "8",
      status: "completed",
      date: "2025-11-02",
      time: "22:10",
      playerId: "1472583690147",
      additionalField: "legend_ff",
      duration: "1 سا"
    }
  ];

  // Filter orders
  const filteredOrders = orders
    .filter((order) => {
      if (statusFilter !== "all" && order.status !== statusFilter) return false;
      if (searchQuery && !order.id.includes(searchQuery) && !order.playerId.includes(searchQuery)) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      // ترتيب حسب الحالة: pending أولاً
      if (a.status === "pending" && b.status !== "pending") return -1;
      if (a.status !== "pending" && b.status === "pending") return 1;
      return 0;
    });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center border border-green-500/50">
            <span className="text-green-500 text-lg">✓</span>
          </div>
        );
      case "pending":
        return (
          <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center border border-yellow-500/50">
            <span className="text-yellow-500 text-lg">⏱</span>
          </div>
        );
      case "rejected":
        return (
          <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center border border-red-500/50">
            <span className="text-red-500 text-lg">✗</span>
          </div>
        );
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "text-green-500";
      case "pending":
        return "text-yellow-500";
      case "rejected":
        return "text-red-500";
      default:
        return "text-muted-foreground";
    }
  };

  return (
    <>
      <style jsx>{`
        input[type="date"]::-webkit-calendar-picker-indicator {
          display: none;
          -webkit-appearance: none;
        }
      `}</style>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl md:text-3xl font-bold text-gold">
            {t("title")}
          </h1>
        </div>

        {/* Filters Section - No Card Background */}
        <div className="space-y-4">
          {/* Date Filters & Search */}
          <div className="flex flex-wrap gap-3 items-end">
            {/* Date From */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-muted-foreground px-2">{t("from")}</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="bg-background/50 backdrop-blur-sm border border-border rounded-full px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold/50"
              />
            </div>
            
            {/* Date To */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-muted-foreground px-2">{t("to")}</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="bg-background/50 backdrop-blur-sm border border-border rounded-full px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold/50"
              />
            </div>

            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className={`absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground ${isRTL ? 'right-3' : 'left-3'}`} />
              <input
                type="text"
                placeholder={t("searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full bg-background/50 backdrop-blur-sm border border-border rounded-lg py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/50 ${isRTL ? 'pr-10 pl-4' : 'pl-10 pr-4'}`}
              />
            </div>
          </div>

          {/* Filter Badges - Icons Only */}
          <div className="flex gap-3 flex-wrap">
            {/* All */}
            <button
              onClick={() => setStatusFilter("all")}
              className={`flex items-center justify-center w-12 h-12 rounded-full transition-all hover:scale-110 cursor-pointer ${
                statusFilter === "all" 
                  ? "bg-primary text-[#1b1f25] dark:text-background shadow-lg border border-primary/80" 
                  : "bg-card/50 backdrop-blur-sm border-2 border-border hover:border-gold"
              }`}
              title={t("all")}
            >
              <span className="text-sm font-semibold">{t("all")}</span>
            </button>
            
            {/* Accepted */}
            <button
              onClick={() => setStatusFilter("completed")}
              className={`flex items-center justify-center w-12 h-12 rounded-full transition-all hover:scale-110 cursor-pointer ${
                statusFilter === "completed" 
                  ? "bg-green-500 shadow-lg border-2 border-green-500" 
                  : "bg-green-500/20 backdrop-blur-sm border-2 border-green-500/50 hover:border-green-500"
              }`}
              title={t("completed")}
            >
              <span className={`text-2xl ${statusFilter === "completed" ? "text-white" : "text-green-500"}`}>✓</span>
            </button>
            
            {/* Rejected */}
            <button
              onClick={() => setStatusFilter("rejected")}
              className={`flex items-center justify-center w-12 h-12 rounded-full transition-all hover:scale-110 cursor-pointer ${
                statusFilter === "rejected" 
                  ? "bg-red-500 shadow-lg border-2 border-red-500" 
                  : "bg-red-500/20 backdrop-blur-sm border-2 border-red-500/50 hover:border-red-500"
              }`}
              title={t("rejected")}
            >
              <span className={`text-2xl ${statusFilter === "rejected" ? "text-white" : "text-red-500"}`}>✗</span>
            </button>
            
            {/* Pending */}
            <button
              onClick={() => setStatusFilter("pending")}
              className={`flex items-center justify-center w-12 h-12 rounded-full transition-all hover:scale-110 cursor-pointer ${
                statusFilter === "pending" 
                  ? "bg-yellow-500 shadow-lg border-2 border-yellow-500" 
                  : "bg-yellow-500/20 backdrop-blur-sm border-2 border-yellow-500/50 hover:border-yellow-500"
              }`}
              title={t("pending")}
            >
              <span className={`text-2xl ${statusFilter === "pending" ? "text-white" : "text-yellow-500"}`}>⏱</span>
            </button>
          </div>
        </div>

        {/* Orders List */}
        <div className="space-y-3">
          {filteredOrders.length > 0 ? (
            filteredOrders.map((order, index) => (
              <div
                key={index}
                className={`backdrop-blur-sm rounded-xl p-3 shadow-lg border transition-all duration-300 ${
                  order.status === "pending"
                    ? "bg-yellow-500/20 border-yellow-500/50 hover:border-yellow-500"
                    : "bg-card/50 border-border hover:border-gold/50"
                }`}
              >
                {/* الصف الأول والثاني - معلومات رئيسية */}
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {/* اليمين - رقم الطلب والباقة */}
                  <div className="flex flex-col gap-1">
                    <span className="font-mono text-sm text-gold">#{order.id}</span>
                    <p className="text-xs">{order.package}</p>
                  </div>

                  {/* المنتصف - التكلفة والبيع */}
                  <div className="flex flex-col gap-1 items-center justify-center">
                    <p className="text-orange-500">{order.cost}.00$</p>
                    <p className="text-green-500">{order.price}$</p>
                  </div>

                  {/* اليسار - الحالة والتاريخ */}
                  <div className="flex flex-col gap-1 items-end">
                    <div className="flex items-center justify-end gap-2">
                      <span className={`text-xs ${getStatusColor(order.status)}`}>{order.duration}</span>
                      {getStatusIcon(order.status)}
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">{order.date}</p>
                      <p className="text-xs">{order.time}</p>
                    </div>
                  </div>
                </div>

                {/* الصف الثالث - معرف اللاعب والحقل الإضافي */}
                <div className="pt-2 border-t border-border/50 flex flex-wrap gap-3 text-sm">
                  <span className="font-mono">{order.playerId}</span>
                  <span className="text-gold">{order.additionalField}</span>
                </div>
              </div>
            ))
          ) : (
            <p className="text-center text-muted-foreground py-8">
              {t("noOrders")}
            </p>
          )}
        </div>
      </div>
    </>
  );
}
