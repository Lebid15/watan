"use client";

import { OrderCard, type Order } from "@/components/orders/order-card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Clock3, Search, SlidersHorizontal, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";

const statusPriority: Record<Order["status"], number> = {
  pending: 0,
  success: 1,
  failed: 2,
};

type StatusFilter = Order["status"]; 

const baseOrders: Order[] = [
  {
    id: 10234,
    image: "/images/pubg.jpg",
    agent: "وكيل المنصور",
    packageName: "ببجي 325 شدة",
    playerId: "P-77892123",
    extra: "سيرفر MENA - UID 445",
    cost: 12.5,
    sale: 15,
    profit: 2.5,
    status: "success",
    provider: "znet",
    durationSec: 65,
    createdAt: "2024-04-11",
  },
  {
    id: 10235,
    image: "/images/freefire.png",
    agent: "وكيل الرفاعي",
    packageName: "فري فاير 500 جوهرة",
    playerId: "PID-009912",
    extra: "سيرفر أوروبا",
    cost: 30,
    sale: 34,
    profit: 4,
    status: "pending",
    provider: "manual",
    durationSec: 48,
    createdAt: "2024-04-12",
  },
  {
    id: 10236,
    image: "/images/likee.png",
    agent: "وكيل أفق",
    packageName: "Likee 3400 Coins",
    playerId: "783211-XX",
    extra: "Note: iOS",
    cost: 100,
    sale: 108,
    profit: 8,
    status: "failed",
    provider: "apstore",
    durationSec: 12,
    createdAt: "2024-04-10",
  },
];

function applyFilters(
  orders: Order[],
  provider: string,
  search: string,
  statuses: StatusFilter[],
  dateRange: { from?: string; to?: string }
) {
  return orders.filter((order) => {
    if (provider !== "all" && order.provider !== provider) {
      return false;
    }

    const normalized = search.trim().toLowerCase();
    if (normalized) {
      const haystack = [
        order.packageName,
        order.agent,
        order.playerId,
        String(order.id),
      ]
        .join(" ")
        .toLowerCase();

      if (!haystack.includes(normalized)) {
        return false;
      }
    }

    if (statuses.length && !statuses.includes(order.status)) {
      return false;
    }

    const orderDate = new Date(order.createdAt).getTime();
    if (dateRange.from) {
      const fromTime = new Date(dateRange.from).getTime();
      if (Number.isFinite(fromTime) && orderDate < fromTime) {
        return false;
      }
    }
    if (dateRange.to) {
      const toTime = new Date(dateRange.to).getTime();
      if (Number.isFinite(toTime) && orderDate > toTime) {
        return false;
      }
    }

    return true;
  });
}

export default function OrdersPage() {
  const t = useTranslations("pages.orders");
  const locale = useLocale();
  const isRTL = locale === "ar";

  const [selectedProvider, setSelectedProvider] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter[]>([]);
  const [dateRange, setDateRange] = useState<{ from?: string; to?: string }>(
    {}
  );
  const [filtersPanelOpen, setFiltersPanelOpen] = useState(false);
  const [tempStatuses, setTempStatuses] = useState<StatusFilter[]>([]);
  const [tempDateRange, setTempDateRange] = useState<{ from?: string; to?: string }>(
    {}
  );

  const providers = useMemo(
    () => Array.from(new Set(baseOrders.map((order) => order.provider))),
    []
  );

  const sortedOrders = useMemo(() => {
    const sorted = [...baseOrders].sort((a, b) => {
      const priorityDiff = statusPriority[a.status] - statusPriority[b.status];
      return priorityDiff !== 0 ? priorityDiff : b.id - a.id;
    });
    return sorted;
  }, []);

  const filteredOrders = useMemo(() => {
    const filtered = applyFilters(
      sortedOrders,
      selectedProvider,
      searchTerm,
      statusFilter,
      dateRange
    );
    return filtered;
  }, [sortedOrders, selectedProvider, searchTerm, statusFilter, dateRange]);

  const handleOpenFilters = () => {
    setTempStatuses([...statusFilter]);
    setTempDateRange({ ...dateRange });
    setFiltersPanelOpen(true);
  };

  const toggleTempStatus = (status: StatusFilter) => {
    setTempStatuses((prev) =>
      prev.includes(status)
        ? prev.filter((item) => item !== status)
        : [...prev, status]
    );
  };

  const applyAdvancedFilters = () => {
    setStatusFilter([...tempStatuses]);
    setDateRange({ ...tempDateRange });
    setFiltersPanelOpen(false);
  };

  const clearAdvancedFilters = () => {
    setTempStatuses([]);
    setTempDateRange({});
  };

  return (
    <div className="space-y-4 sm:space-y-6" dir={isRTL ? "rtl" : "ltr"}>
      <div className="flex items-center gap-3 pb-3 border-b border-gold/20">
        <div className="w-1 h-8 bg-gradient-to-b from-gold to-gold-light rounded-full" />
        <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-br from-gold to-gold-light bg-clip-text text-transparent">
          {t("title")}
        </h1>
      </div>

      <div className="rounded-xl border border-border/60 bg-card/60 p-3 backdrop-blur-sm shadow-sm space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="min-w-[9rem] justify-between border-dashed"
              >
                <span className="font-medium text-sm">API</span>
                <span className="text-xs font-semibold uppercase text-muted-foreground">
                  {selectedProvider === "all" ? "الكل" : selectedProvider}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align={isRTL ? "end" : "start"}
              className="min-w-[9rem]"
            >
              <DropdownMenuLabel>اختر المزود</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup
                value={selectedProvider}
                onValueChange={setSelectedProvider}
              >
                <DropdownMenuRadioItem value="all">الكل</DropdownMenuRadioItem>
                {providers.map((provider) => (
                  <DropdownMenuRadioItem key={provider} value={provider}>
                    {provider}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex flex-1 items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search
                className={cn(
                  "pointer-events-none absolute top-1/2 size-4 -translate-y-1/2 text-muted-foreground/70",
                  isRTL ? "right-3" : "left-3"
                )}
              />
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="ابحث باسم اللعبة، الوكيل، المعرف او رقم الطلب"
                className={cn(
                  "w-full rounded-lg border border-border/50 bg-background/70 py-2 text-sm shadow-inner outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/20 dark:bg-background/40",
                  isRTL ? "pr-10 pl-3 text-right" : "pl-10 pr-3 text-left"
                )}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="border-dashed"
              onClick={handleOpenFilters}
            >
              <SlidersHorizontal className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-3" dir={isRTL ? "rtl" : "ltr"}>
        {filteredOrders.length ? (
          filteredOrders.map((order) => <OrderCard key={order.id} order={order} />)
        ) : (
          <div className="rounded-xl border border-border/60 bg-card/60 p-6 text-sm text-muted-foreground text-center">
            لا توجد طلبات مطابقة للخيارات الحالية.
          </div>
        )}
      </div>

      {filtersPanelOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-background/70 backdrop-blur-sm"
            onClick={() => setFiltersPanelOpen(false)}
          />
          <div className="relative w-full max-w-md rounded-xl border border-border/70 bg-card p-5 shadow-2xl">
            <div className="flex items-center justify-between gap-3 pb-3">
              <h2 className="text-lg font-semibold">تصفية متقدمة</h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setFiltersPanelOpen(false)}
                aria-label="إغلاق"
              >
                <X className="size-4" />
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <span className="text-sm font-medium text-muted-foreground">الحالات</span>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {(
                    [
                      {
                        value: "pending",
                        label: "قيد المعالجة",
                        tone: "text-yellow-500",
                        bg: "bg-yellow-500/15",
                        glow: "shadow-[0_0_0_1px_rgba(234,179,8,0.45)]",
                      },
                      {
                        value: "success",
                        label: "مكتمل",
                        tone: "text-emerald-500",
                        bg: "bg-emerald-500/15",
                        glow: "shadow-[0_0_0_1px_rgba(16,185,129,0.45)]",
                      },
                      {
                        value: "failed",
                        label: "مرفوض",
                        tone: "text-red-500",
                        bg: "bg-red-500/15",
                        glow: "shadow-[0_0_0_1px_rgba(239,68,68,0.45)]",
                      },
                    ] as Array<{ value: StatusFilter; label: string; tone: string; bg: string; glow: string }>
                  ).map((status) => {
                    const active = tempStatuses.includes(status.value);
                    return (
                      <button
                        key={status.value}
                        type="button"
                        onClick={() => toggleTempStatus(status.value)}
                        className={cn(
                          "flex flex-col items-center gap-1 rounded-lg border px-3 py-2 text-xs font-medium transition",
                          active
                            ? cn(
                                "border-gold text-foreground ring-2 ring-gold/40 bg-gold/5 shadow-[0_0_12px_rgba(212,175,55,0.35)]",
                                status.glow
                              )
                            : "border-border/60 text-muted-foreground hover:border-border/80 hover:bg-card/40"
                        )}
                      >
                        <span
                          className={cn(
                            "flex size-9 items-center justify-center rounded-full text-lg transition",
                            status.bg,
                            status.tone,
                            active && "shadow-[inset_0_0_6px_rgba(212,175,55,0.35)] bg-gold/15"
                          )}
                        >
                          {status.value === "pending" && <Clock3 className="size-4" />}
                          {status.value === "success" && <span className="font-bold">✓</span>}
                          {status.value === "failed" && <span className="font-bold">✗</span>}
                        </span>
                        <span className={cn(active ? "text-gold" : undefined)}>{status.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-sm font-medium text-muted-foreground">الفترة الزمنية</span>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                    من
                    <input
                      type="date"
                      value={tempDateRange.from ?? ""}
                      onChange={(event) =>
                        setTempDateRange((prev) => ({ ...prev, from: event.target.value }))
                      }
                      className="rounded-md border border-border/60 bg-background/50 px-3 py-2 text-sm text-foreground outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                    إلى
                    <input
                      type="date"
                      value={tempDateRange.to ?? ""}
                      onChange={(event) =>
                        setTempDateRange((prev) => ({ ...prev, to: event.target.value }))
                      }
                      className="rounded-md border border-border/60 bg-background/50 px-3 py-2 text-sm text-foreground outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
              <Button
                type="button"
                variant="ghost"
                className="text-xs"
                onClick={clearAdvancedFilters}
              >
                إعادة التعيين
              </Button>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setFiltersPanelOpen(false)}
                >
                  إلغاء
                </Button>
                <Button type="button" onClick={applyAdvancedFilters}>
                  تطبيق
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
