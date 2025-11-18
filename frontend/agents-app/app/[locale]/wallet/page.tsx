"use client";

import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useState } from "react";

export default function WalletPage() {
  const t = useTranslations("wallet");
  const [filterType, setFilterType] = useState<"all" | "add" | "withdraw">("all");

  // بيانات تغييرات المحفظة
  const walletTransactions = [
    {
      id: "1",
      type: "admin_add", // شحن من الأدمن
      amount: 200,
      previousBalance: 1500,
      currentBalance: 1700,
      date: "2024-01-15",
      time: "14:30",
      description: "تم شحن محفظتك بمبلغ 200$ من قبل الأدمن"
    },
    {
      id: "2",
      type: "payment_add", // دفعة مالية
      amount: 350,
      previousBalance: 1200,
      currentBalance: 1550,
      date: "2024-01-14",
      time: "10:15",
      description: "تم شحن محفظتك بمبلغ 350$ بعد أن قمت بطلب دفعة مالية بنجاح"
    },
    {
      id: "3",
      type: "order_success", // طلب ناجح
      amount: 4.2,
      previousBalance: 1550,
      currentBalance: 1545.8,
      date: "2024-01-13",
      time: "16:45",
      description: "تم قبول شحن طلب ببجي 360 شدة بسعر 4.2$ بنجاح",
      packageName: "ببجي 360 شدة"
    },
    {
      id: "4",
      type: "order_refund", // رفض طلب وإرجاع
      amount: 2.5,
      previousBalance: 1543.3,
      currentBalance: 1545.8,
      date: "2024-01-12",
      time: "09:20",
      description: "تم رفض شحن طلب ببجي 1800 شدة بسعر 2.5$ وإعادة المبلغ",
      packageName: "ببجي 1800 شدة"
    },
  ];

  const getIcon = (type: string) => {
    switch (type) {
      case "admin_add":
      case "payment_add":
      case "order_refund":
        return (
          <div className="w-10 h-10 rounded-full bg-green-500/20 border-2 border-green-500/50 flex items-center justify-center">
            <ArrowDown className="w-5 h-5 text-green-500" />
          </div>
        );
      case "order_success":
        return (
          <div className="w-10 h-10 rounded-full bg-red-500/20 border-2 border-red-500/50 flex items-center justify-center">
            <ArrowUp className="w-5 h-5 text-red-500" />
          </div>
        );
      default:
        return null;
    }
  };

  const isAddType = (type: string) => {
    return type === "admin_add" || type === "payment_add" || type === "order_refund";
  };

  // Filter transactions
  const filteredTransactions = walletTransactions.filter(transaction => {
    if (filterType === "all") return true;
    if (filterType === "add") return isAddType(transaction.type);
    if (filterType === "withdraw") return transaction.type === "order_success";
    return true;
  });

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header with Filters */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl md:text-2xl font-bold text-foreground">
          {t("title")}
        </h1>

        {/* Filter Buttons */}
        <div className="flex gap-3">
          {/* All */}
          <button
            onClick={() => setFilterType("all")}
            className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
              filterType === "all"
                ? "bg-gold shadow-lg border-2 border-gold text-white"
                : "bg-card border-2 border-border hover:border-gold"
            }`}
          >
            الكل
          </button>

          {/* Add (Income) */}
          <button
            onClick={() => setFilterType("add")}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
              filterType === "add"
                ? "bg-green-500 shadow-lg border-2 border-green-500"
                : "bg-green-500/20 border-2 border-green-500/50 hover:border-green-500"
            }`}
          >
            <ArrowDown className={`w-4 h-4 ${filterType === "add" ? "text-white" : "text-green-500"}`} />
          </button>

          {/* Withdraw (Expense) */}
          <button
            onClick={() => setFilterType("withdraw")}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
              filterType === "withdraw"
                ? "bg-red-500 shadow-lg border-2 border-red-500"
                : "bg-red-500/20 border-2 border-red-500/50 hover:border-red-500"
            }`}
          >
            <ArrowUp className={`w-4 h-4 ${filterType === "withdraw" ? "text-white" : "text-red-500"}`} />
          </button>
        </div>
      </div>

      {/* Transactions List */}
      <div className="space-y-3">
        {filteredTransactions.map((transaction) => (
          <div
            key={transaction.id}
            className="bg-card border border-border rounded-lg p-4 space-y-3"
          >
            {/* First Row: Icon + Description */}
            <div className="flex items-start gap-3">
              {getIcon(transaction.type)}
              <p className="flex-1 text-sm text-foreground leading-relaxed">
                {transaction.description}
              </p>
            </div>

            {/* Second Row: Previous Balance | Current Balance */}
            <div className="flex items-center gap-3">
              {/* Previous Balance */}
              <div className="flex items-center gap-1">
                <span className="text-red-500 line-through font-semibold text-sm">
                  {transaction.previousBalance.toFixed(2)}$
                </span>
              </div>
              
              {/* Current Balance */}
              <div className="flex items-center gap-1">
                <span className="text-green-500 font-bold text-base">
                  {transaction.currentBalance.toFixed(2)}$
                </span>
              </div>
            </div>

            {/* Third Row: Date & Time */}
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{transaction.date}</span>
              <span>{transaction.time}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
