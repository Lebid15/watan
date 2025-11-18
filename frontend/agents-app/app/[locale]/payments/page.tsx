"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

export default function PaymentsPage() {
  const t = useTranslations("payments");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Sample data
  const payments = [
    {
      id: "1",
      amount: "17500.00",
      status: "completed",
      date: "2024-01-15",
      time: "14:30",
      method: "بطاقة ائتمان",
      transactionId: "TRX123456789",
      details: "تم الدفع بنجاح عبر بطاقة فيزا"
    },
    {
      id: "2",
      amount: "20000.00",
      status: "pending",
      date: "2024-01-14",
      time: "10:15",
      method: "تحويل بنكي",
      transactionId: "TRX987654321",
      details: "في انتظار تأكيد البنك"
    },
    {
      id: "3",
      amount: "10000.00",
      status: "completed",
      date: "2024-01-13",
      time: "16:45",
      method: "محفظة إلكترونية",
      transactionId: "TRX456789123",
      details: "تم الدفع بنجاح"
    },
    {
      id: "4",
      amount: "20000.00",
      status: "rejected",
      date: "2024-01-12",
      time: "09:20",
      method: "بطاقة ائتمان",
      transactionId: "TRX789123456",
      details: "فشلت العملية - رصيد غير كافي"
    },
  ];

  // Sort payments: pending first
  const sortedPayments = [...payments].sort((a, b) => {
    if (a.status === "pending" && b.status !== "pending") return -1;
    if (a.status !== "pending" && b.status === "pending") return 1;
    return 0;
  });

  const getStatusText = (status: string) => {
    switch (status) {
      case "completed":
        return t("completed");
      case "pending":
        return t("pending");
      case "rejected":
        return t("rejected");
      default:
        return status;
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <div className="w-6 h-6 rounded-full bg-green-500/20 border border-green-500/50 flex items-center justify-center">
            <span className="text-green-500 text-sm">✓</span>
          </div>
        );
      case "pending":
        return (
          <div className="w-6 h-6 rounded-full bg-yellow-500/20 border border-yellow-500/50 flex items-center justify-center">
            <span className="text-yellow-500 text-sm">⏱</span>
          </div>
        );
      case "rejected":
        return (
          <div className="w-6 h-6 rounded-full bg-red-500/20 border border-red-500/50 flex items-center justify-center">
            <span className="text-red-500 text-sm">✗</span>
          </div>
        );
      default:
        return null;
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header with Title and Button */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl md:text-2xl font-bold text-foreground">
          {t("title")}
        </h1>
        <button 
          className="px-4 py-1.5 rounded-lg text-sm font-semibold shadow-md cursor-pointer transition-all hover:scale-105"
          style={{ backgroundColor: 'var(--beige-600)', color: 'white' }}
        >
          {t("addBalance")}
        </button>
      </div>

      {/* Payments List */}
      <div className="space-y-3">
        {sortedPayments.map((payment) => (
          <button
            key={payment.id}
            onClick={() => toggleExpand(payment.id)}
            className={`w-full bg-card border border-border rounded-lg overflow-hidden hover:border-gold transition-colors text-right ${
              payment.status === "pending" ? "bg-yellow-500/20 border-yellow-500/50" : ""
            }`}
          >
            {/* Main Content */}
            <div className="p-4">
              {/* Desktop: 4 columns, Mobile: 2 rows */}
              <div className="hidden md:grid md:grid-cols-4 gap-3 items-center">
                {/* Amount */}
                <div className="text-center">
                  <p className="text-lg font-bold text-green-500">
                    {payment.amount}TL
                  </p>
                </div>

                {/* Method */}
                <div className="text-center">
                  <p className="text-sm text-foreground">{payment.method}</p>
                </div>

                {/* Date & Time */}
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">{payment.date}</p>
                  <p className="text-xs text-muted-foreground">{payment.time}</p>
                </div>

                {/* Status & Expand Icon */}
                <div className="flex items-center justify-center gap-2">
                  {getStatusIcon(payment.status)}
                  {expandedId === payment.id ? (
                    <ChevronUp className="w-5 h-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
              </div>

              {/* Mobile: 2 rows layout */}
              <div className="md:hidden space-y-3">
                {/* First Row: Date & Status */}
                <div className="flex items-center justify-between">
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">{payment.date}</p>
                    <p className="text-xs text-muted-foreground">{payment.time}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(payment.status)}
                    {expandedId === payment.id ? (
                      <ChevronUp className="w-5 h-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                </div>

                {/* Second Row: Method & Amount */}
                <div className="flex items-center justify-between">
                  <p className="text-sm text-foreground">{payment.method}</p>
                  <p className="text-lg font-bold text-green-500">
                    {payment.amount}TL
                  </p>
                </div>
              </div>
            </div>

            {/* Expanded Details */}
            {expandedId === payment.id && (
              <div className="px-4 pb-4 pt-3 border-t border-border bg-gradient-to-b from-amber-500/5 via-amber-500/3 to-transparent">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("transactionId")}:</span>
                    <span className="text-foreground font-medium">{payment.transactionId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("status")}:</span>
                    <span className={getStatusColor(payment.status)}>
                      {getStatusText(payment.status)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("details")}:</span>
                    <span className="text-foreground">{payment.details}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("note")}:</span>
                    <span className="text-foreground"></span>
                  </div>
                </div>
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
