"use client";
import React, { useEffect, useRef, useState, useCallback } from "react";

/**
 * StorePreviewFrame
 * Implements option 3A (iframe + postMessage sizing) for full-store preview without horizontal scroll
 * while preserving native pinch-to-zoom inside the store frame.
 *
 * Contract:
 *  - Store page (child) sends: { type: 'storeDimensions', scrollWidth, scrollHeight } via postMessage.
 *  - Parent computes scale = min(viewW/scrollWidth, viewH/scrollHeight) and applies CSS transform scale.
 *  - Debounced orientation / resize recalculation (100ms default) + fallback if no message in 2000ms.
 *
 * Security:
 *  - Only accept messages whose origin is in allowedOrigins.
 *  - Ignore unexpected message shapes.
 */
export interface StorePreviewFrameProps {
  src: string;                            // URL of the store subdomain
  allowedOrigins: string[];               // e.g. ["https://shop1.example.com", "https://shop2.example.com"]
  className?: string;                     // Optional container classes
  debounceMs?: number;                    // Debounce resize/orientation recalculation (default 100)
  fallbackTimeoutMs?: number;             // Time to wait before fallback (default 2000)
  background?: string;                    // Container background (default transparent)
  border?: boolean;                       // Show a subtle border
}

interface DimensionsMsg {
  type: string;
  scrollWidth?: number;
  scrollHeight?: number;
}

const isPositiveFinite = (n: unknown): n is number => typeof n === 'number' && isFinite(n) && n > 0;

export const StorePreviewFrame: React.FC<StorePreviewFrameProps> = ({
  src,
  allowedOrigins,
  className = "",
  debounceMs = 100,
  fallbackTimeoutMs = 2000,
  background = "transparent",
  border = true,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null); // scaling wrapper
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const [storeW, setStoreW] = useState<number | null>(null);
  const [storeH, setStoreH] = useState<number | null>(null);
  const [scale, setScale] = useState(1);
  const [fallbackUsed, setFallbackUsed] = useState(false);
  const fallbackTimerRef = useRef<number | null>(null);
  const lastDimsRef = useRef({ w: 0, h: 0 });
  const pendingRecalcRef = useRef<number | null>(null);

  // Debounce util using window.setTimeout so we can clear it
  const debounce = useCallback((fn: () => void, delay: number) => {
    if (pendingRecalcRef.current) window.clearTimeout(pendingRecalcRef.current);
    pendingRecalcRef.current = window.setTimeout(() => {
      pendingRecalcRef.current = null;
      fn();
    }, delay);
  }, []);

  const recalcScale = useCallback(() => {
    if (!containerRef.current) return;
    if (!isPositiveFinite(storeW) || !isPositiveFinite(storeH)) return;
    const rect = containerRef.current.getBoundingClientRect();
    const viewW = rect.width;
    const viewH = rect.height;
    if (viewW <= 0 || viewH <= 0) return;
    const s = Math.min(viewW / storeW, viewH / storeH);
    setScale(s > 0 ? s : 1);
  }, [storeW, storeH]);

  // Handle messages from store frame
  useEffect(() => {
    function onMessage(ev: MessageEvent) {
      const origin = ev.origin;
      if (!allowedOrigins.includes(origin)) return; // security filter
      const data: DimensionsMsg = ev.data;
      if (!data || data.type !== 'storeDimensions') return;
      if (!isPositiveFinite(data.scrollWidth) || !isPositiveFinite(data.scrollHeight)) return;
      // Update only if dimensions changed (avoid needless recalcs)
      if (lastDimsRef.current.w === data.scrollWidth && lastDimsRef.current.h === data.scrollHeight) return;
      lastDimsRef.current = { w: data.scrollWidth!, h: data.scrollHeight! };
      setStoreW(data.scrollWidth!);
      setStoreH(data.scrollHeight!);
      // Cancel fallback if we got the real message
      if (fallbackTimerRef.current) {
        window.clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
      setFallbackUsed(false);
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [allowedOrigins]);

  // Recompute scale when dimensions update
  useEffect(() => {
    recalcScale();
  }, [recalcScale, storeW, storeH]);

  // ResizeObserver for container size changes
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(() => debounce(recalcScale, debounceMs));
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [recalcScale, debounce, debounceMs]);

  // Orientation change listener
  useEffect(() => {
    function handler() {
      debounce(recalcScale, debounceMs);
    }
    window.addEventListener('orientationchange', handler);
    return () => window.removeEventListener('orientationchange', handler);
  }, [recalcScale, debounce, debounceMs]);

  // Fallback if no message after timeout: Fit width only
  useEffect(() => {
    if (fallbackTimerRef.current) {
      window.clearTimeout(fallbackTimerRef.current);
    }
    fallbackTimerRef.current = window.setTimeout(() => {
      if (storeW === null || storeH === null) {
        // Fallback logic: we only know the iframe clientWidth after load
        const iframe = iframeRef.current;
        const container = containerRef.current;
        if (iframe && container) {
          const cRect = container.getBoundingClientRect();
            // Make iframe natural size attempt
          const naturalW = iframe.clientWidth || cRect.width;
          const s = cRect.width / naturalW;
          setScale(s > 0 ? s : 1);
          setFallbackUsed(true);
        }
      }
    }, fallbackTimeoutMs);
    return () => {
      if (fallbackTimerRef.current) window.clearTimeout(fallbackTimerRef.current);
    };
  }, [fallbackTimeoutMs, storeW, storeH]);

  // Cleanup timeouts when unmount
  useEffect(() => {
    return () => {
      if (pendingRecalcRef.current) window.clearTimeout(pendingRecalcRef.current);
      if (fallbackTimerRef.current) window.clearTimeout(fallbackTimerRef.current);
    };
  }, []);

  // Apply transform style
  useEffect(() => {
    if (!wrapperRef.current) return;
    wrapperRef.current.style.transform = `scale(${scale})`;
  }, [scale]);

  const showDims = isPositiveFinite(storeW) && isPositiveFinite(storeH);

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${className}`}
      style={{ background }}
    >
      <div
        ref={wrapperRef}
        className="origin-top-left"
        style={{
          width: showDims ? storeW! : '100%',
          height: showDims ? storeH! : 'auto',
          willChange: 'transform',
          transition: 'transform 120ms ease-out',
          transformOrigin: '0 0',
        }}
      >
        <iframe
          ref={iframeRef}
          src={src}
          title="store-preview"
          className={`block ${border ? 'border border-neutral-300 dark:border-neutral-700' : ''}`}
          style={{ width: showDims ? storeW! : '100%', height: showDims ? storeH! : '100%', background: '#fff' }}
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-pointer-lock allow-downloads"
        />
      </div>
      <div className="absolute bottom-1 left-1 text-[10px] px-1.5 py-0.5 rounded bg-black/40 text-white pointer-events-none select-none">
        {fallbackUsed ? 'fallback-width-fit' : showDims ? `${Math.round(scale * 100)}%` : 'waiting-size'}
      </div>
    </div>
  );
};

export default StorePreviewFrame;
