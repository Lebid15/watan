"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, Clock3, Hash, Package, Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useLocale } from "next-intl";

export type OrderStatus = "success" | "failed" | "pending";

export type Order = {
  id: number;
  image: string; // public path e.g. /images/...
  agent: string;
  packageName: string;
  playerId: string;
  extra: string;
  cost: number;
  sale: number;
  profit: number;
  status: OrderStatus;
  provider: string; // manual | znet | barakat | apstore | ...
  durationSec: number; // total seconds
  createdAt: string; // ISO date string (yyyy-mm-dd)
};

function StatusIcon({ status }: { status: OrderStatus }) {
  const toneStyles: Record<OrderStatus, string> = {
    success: "bg-emerald-500/20 border-emerald-500/50 text-emerald-500",
    failed: "bg-red-500/20 border-red-500/50 text-red-500",
    pending: "bg-yellow-500/20 border-yellow-500/50 text-yellow-500",
  };

  const base = "flex items-center justify-center size-8 rounded-full border text-lg font-semibold";

  return (
    <div className={cn(base, toneStyles[status])} aria-label={status}>
      {status === "success" && "✓"}
      {status === "failed" && "✗"}
      {status === "pending" && "⏱"}
    </div>
  );
}

function formatDuration(sec: number) {
  if (sec < 60) return `${sec} ث`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s ? `${m} د ${s} ث` : `${m} د`;
}

export function OrderCard({ order }: { order: Order }) {
  const locale = useLocale();
  const isRTL = locale === "ar";
  const direction = isRTL ? "rtl" : "ltr";
  const textStart = isRTL ? "text-right" : "text-left";
  const justifyEdge = isRTL ? "justify-start" : "justify-end";
  const extraLabel = order.extra?.trim() ? order.extra : "—";
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [note, setNote] = useState("الايدي خطأ يرجى التأكد من جديد");
  const [mounted, setMounted] = useState(false);

  const providerTone: Record<OrderStatus, string> = {
    pending: "bg-yellow-500/15 text-yellow-500 border-yellow-500/40",
    success: "bg-emerald-500/15 text-emerald-500 border-emerald-500/40",
    failed: "bg-red-500/15 text-red-500 border-red-500/40",
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  const statusVariants: Record<OrderStatus, string> = {
    pending: "bg-yellow-500/20 border-yellow-500/50 hover:border-yellow-500",
    success: "bg-card/50 border-border hover:border-gold/50",
    failed: "bg-card/50 border-border hover:border-gold/50",
  };

  const statusLabels: Record<OrderStatus, string> = {
    pending: "قيد المعالجة",
    success: "مكتمل",
    failed: "مرفوض",
  };

  return (
    <Card
      dir={direction}
      className={cn(
        "overflow-hidden border transition-all duration-300 hover:shadow-lg hover:scale-[1.01] backdrop-blur-sm p-0",
        statusVariants[order.status]
      )}
    >
      {/* Mobile layout */}
      <div className="flex flex-col gap-2.5 px-3 py-2.5 md:hidden">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="relative size-11 sm:size-12 shrink-0 overflow-hidden rounded-lg border border-border/40 shadow-sm">
              <Image
                src={order.image}
                alt={order.packageName}
                fill
                className="object-cover"
              />
            </div>
              <div className="grid grid-cols-2 gap-1 text-[11px] text-muted-foreground">
                <div className="flex items-center gap-1 text-gold font-semibold">
                  <Hash className="size-3" />
                  <span className="font-mono text-xs tabular-nums">{order.id}</span>
                </div>
                <div className="flex items-center gap-1 justify-end">
                  <Clock3 className="size-3" />
                  <span className="tabular-nums text-xs">{formatDuration(order.durationSec)}</span>
                </div>
              </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                providerTone[order.status]
              )}
            >
              {order.provider}
            </span>
            <StatusIcon status={order.status} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <Package className="size-4 text-primary shrink-0" />
            <span className="font-semibold text-foreground truncate">
              {order.packageName}
            </span>
          </div>
          <span className="font-mono text-muted-foreground truncate text-right" title={order.playerId}>
            {order.playerId}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
          <span className="truncate" title={order.agent}>
            {order.agent}
          </span>
          <span className="truncate text-primary text-right" title={extraLabel}>
            {extraLabel}
          </span>
        </div>

        <div className="flex items-center border-t border-border/40 pt-2 text-[11px]">
          <div className="grid flex-1 grid-cols-2 gap-2">
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">التكلفة:</span>
              <span className="text-sm sm:text-base font-medium text-amber-500 dark:text-amber-300 tabular-nums">
                {`$ ${order.cost}`}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">سعر البيع:</span>
              <span className="text-sm sm:text-base font-medium text-amber-500 dark:text-amber-300 tabular-nums">
                {`$ ${order.sale}`}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">الربح:</span>
              <span className="text-sm sm:text-base font-medium text-[#15c75b] dark:text-[#7cff85] tabular-nums">
                {`$ ${order.profit}`}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-sm sm:text-base font-medium text-foreground tabular-nums">
                {formatDuration(order.durationSec)}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setDetailsOpen(true)}
            className={cn(
              "ml-2 flex size-8 shrink-0 items-center justify-center rounded-full border border-border/60 bg-background/50 text-muted-foreground transition hover:border-gold hover:text-gold",
              isRTL && "mr-2 ml-0"
            )}
            aria-label="عرض تفاصيل الطلب"
          >
            <AlertCircle className="size-4" />
          </button>
        </div>
      </div>

      {/* Desktop layout */}
      <div className="hidden md:flex md:flex-col md:gap-3 md:px-3 md:py-3 lg:px-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className={cn("flex items-center gap-2", textStart)}>
            <div className="relative size-12 shrink-0 overflow-hidden rounded-lg border border-border/40 shadow-sm">
              <Image
                src={order.image}
                alt={order.packageName}
                fill
                className="object-cover"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <Hash className="size-3.5 text-gold" />
              <span className="font-mono text-sm lg:text-base font-semibold text-gold tabular-nums">
                {order.id}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-center gap-1 md:flex-1">
            <span
              className="max-w-[12rem] lg:max-w-[16rem] text-center font-mono text-sm lg:text-base text-foreground/80 truncate"
              title={order.playerId}
            >
              {order.playerId}
            </span>
          </div>
          <div className={cn("flex items-center gap-2", justifyEdge)}>
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                providerTone[order.status]
              )}
            >
              {order.provider}
            </span>
            <StatusIcon status={order.status} />
          </div>
        </div>

        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className={cn("flex items-center gap-2 min-w-0", textStart)}>
            <Package className="size-4 text-primary shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="text-xs sm:text-sm font-semibold text-foreground truncate">
                {order.packageName}
              </span>
              <span className={cn("text-[11px] sm:text-xs text-muted-foreground truncate", textStart)}>
                {order.agent}
              </span>
            </div>
          </div>
          <div
            className={cn("text-xs sm:text-sm text-muted-foreground truncate", textStart)}
            title={extraLabel}
          >
            {extraLabel}
          </div>
          <div className={cn("flex items-center gap-1.5 text-xs text-muted-foreground", justifyEdge)}>
            <Clock3 className="size-3.5" />
            <span className="tabular-nums text-sm">
              {formatDuration(order.durationSec)}
            </span>
          </div>
        </div>

        <div className="flex items-center border-t border-border/40 pt-3 text-[11px] sm:text-sm">
          <div className="grid flex-1 grid-cols-3 gap-2">
            <div className={cn("flex items-center gap-1", textStart)}>
              <span className="text-muted-foreground">التكلفة:</span>
              <span className="text-base lg:text-lg font-medium text-amber-500 dark:text-amber-300 tabular-nums">
                {`$ ${order.cost}`}
              </span>
            </div>
            <div className={cn("flex items-center gap-1", textStart)}>
              <span className="text-muted-foreground">البيع:</span>
              <span className="text-base lg:text-lg font-medium text-amber-500 dark:text-amber-300 tabular-nums">
                {`$ ${order.sale}`}
              </span>
            </div>
            <div className={cn("flex items-center gap-1", textStart)}>
              <span className="text-muted-foreground">الربح:</span>
              <span className="text-base lg:text-lg font-medium text-[#15c75b] dark:text-[#7cff85] tabular-nums">
                {`$ ${order.profit}`}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setDetailsOpen(true)}
            className={cn(
              "ml-2 flex size-9 shrink-0 items-center justify-center rounded-full border border-border/60 bg-background/50 text-muted-foreground transition hover:border-gold hover:text-gold",
              isRTL && "mr-2 ml-0"
            )}
            aria-label="عرض تفاصيل الطلب"
          >
            <AlertCircle className="size-5" />
          </button>
        </div>
      </div>

      {mounted && detailsOpen &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm p-4" dir={direction}>
            <div className="absolute inset-0" onClick={() => setDetailsOpen(false)} aria-hidden="true" />
            <div className="relative z-10 w-full max-w-2xl rounded-2xl border border-border/70 bg-card p-5 shadow-2xl">
              <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-3">
                <div className="flex flex-col">
                  <h2 className="text-lg font-semibold text-foreground">تفاصيل الطلب #{order.id}</h2>
                  <span className="text-xs text-muted-foreground">جاهزة للطباعة</span>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setDetailsOpen(false)} aria-label="إغلاق النافذة">
                  <X className="size-4" />
                </Button>
              </div>

              <div className="mt-4 space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <InfoRow label="رقم الطلب" value={`#${order.id}`} />
                  <InfoRow
                    label="سعر البيع"
                    value={`$ ${order.sale}`}
                    valueClassName="text-sm font-semibold text-amber-500 dark:text-amber-300"
                  />
                  <InfoRow label="" value={order.packageName} colSpan={2} />
                  <InfoRow label="" value={order.agent} />
                  <InfoRow label="" value={order.playerId} />
                  <InfoRow label="" value={extraLabel} colSpan={2} />
                  <InfoRow label="" value={statusLabels[order.status]} />
                  <InfoRow label="" value={formatDuration(order.durationSec)} />
                  <InfoRow label="" value={order.createdAt} />
                </div>

                <div className="space-y-2">
                  <label htmlFor={`note-${order.id}`} className="text-xs font-semibold text-muted-foreground">
                    الملاحظة
                  </label>
                  <textarea
                    id={`note-${order.id}`}
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    className="min-h-[90px] w-full resize-none rounded-lg border border-border/60 bg-background/60 p-3 text-sm leading-relaxed text-foreground outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                  />
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
                <Button variant="outline" onClick={() => window.print()} className="flex items-center gap-2">
                  <Printer className="size-4" />
                  طباعة
                </Button>
                <Button onClick={() => setDetailsOpen(false)}>تم</Button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </Card>
  );
}

type InfoRowProps = {
  label: string;
  value: string;
  colSpan?: number;
  valueClassName?: string;
  labelClassName?: string;
};

type InlineProps = {
  label: string;
  value: string;
  className?: string;
  valueClassName?: string;
  labelClassName?: string;
};

function InfoRow({ label, value, colSpan = 1, valueClassName, labelClassName }: InfoRowProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border/40 bg-background/40 p-3 shadow-sm",
        colSpan === 2 && "col-span-2"
      )}
    >
      <InfoInline
        label={label}
        value={value}
        className="text-sm font-semibold text-foreground"
        valueClassName={valueClassName}
        labelClassName={labelClassName}
      />
    </div>
  );
}

function InfoInline({ label, value, className, valueClassName, labelClassName }: InlineProps) {
  const hasLabel = Boolean(label?.trim());
  const baseValueClass = hasLabel
    ? "truncate text-xs text-foreground"
    : "truncate text-sm font-semibold text-foreground";
  return (
    <span className={cn("inline-flex w-full items-center gap-1", className)}>
      {hasLabel && (
        <span className={cn("whitespace-nowrap text-xs text-muted-foreground", labelClassName)}>
          {label}:
        </span>
      )}
      <span className={cn(baseValueClass, valueClassName)}>{value}</span>
    </span>
  );
}
