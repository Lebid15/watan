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
  src: string;                            // URL of the store (subdomain or root)
  className?: string;                     // Optional container classes
  debounceMs?: number;                    // Debounce resize/orientation recalculation (default 100)
  fallbackTimeoutMs?: number;             // Time to wait before fallback (default 2000)
  background?: string;                    // Container background (default transparent)
  border?: boolean;                       // Show a subtle border
  /**
   * Strategy for fitting:
   *  - 'contain': scale = min(widthFit, heightFit) (default behavior)
   *  - 'height': scale = viewH / scrollHeight
   *  - 'width': scale = viewW / scrollWidth
   *  - 'once': first like 'contain' then lock (no upscale later). Downscale allowed if content grows.
   */
  fitStrategy?: 'contain' | 'height' | 'width' | 'once';
  /** Lock first computed scale (acts like 'once' if true). */
  lockInitialScale?: boolean;
  /** Ignore minor dimension changes below this delta (px) to avoid flicker. Default 8. */
  dimensionChangeTolerance?: number;
  /** Cap maximum scale (default 1 so we don't upscale beyond natural size). */
  maxScaleCap?: number;
  /** Persist the first (or reduced) baseline scale across remounts for same host (sessionStorage). */
  persistBaseline?: boolean;
  /** Optional custom storage key (else derived from host). */
  baselineStorageKey?: string;
  /**
   * Optional override to decide if an origin is allowed (testing / staging extension)
   * Default logic: https protocol AND (host endsWith .wtn4.com OR host === wtn4.com) AND host !== api.wtn4.com
   */
  allowOriginPredicate?: (origin: string, url: URL) => boolean;
}

interface DimensionsMsg {
  type: string;
  scrollWidth?: number;
  scrollHeight?: number;
}

const isPositiveFinite = (n: unknown): n is number => typeof n === 'number' && isFinite(n) && n > 0;

export const StorePreviewFrame: React.FC<StorePreviewFrameProps> = ({
  src,
  className = "",
  debounceMs = 100,
  fallbackTimeoutMs = 2000,
  background = "transparent",
  border = true,
  fitStrategy = 'contain',
  lockInitialScale = false,
  dimensionChangeTolerance = 8,
  maxScaleCap = 1,
  persistBaseline = false,
  baselineStorageKey,
  allowOriginPredicate,
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
  const baselineScaleRef = useRef<number | null>(null); // locked initial scale
  const baselineLoadedRef = useRef(false);

  // Debounce util using window.setTimeout so we can clear it
  const debounce = useCallback((fn: () => void, delay: number) => {
    if (pendingRecalcRef.current) window.clearTimeout(pendingRecalcRef.current);
    pendingRecalcRef.current = window.setTimeout(() => {
      pendingRecalcRef.current = null;
      fn();
    }, delay);
  }, []);

  const computeFit = useCallback((viewW: number, viewH: number, contentW: number, contentH: number) => {
    if (fitStrategy === 'height') return viewH / contentH;
    if (fitStrategy === 'width') return viewW / contentW;
    // 'contain' and 'once' behave initially the same
    return Math.min(viewW / contentW, viewH / contentH);
  }, [fitStrategy]);

  const recalcScale = useCallback(() => {
    if (!containerRef.current) return;
    if (!isPositiveFinite(storeW) || !isPositiveFinite(storeH)) return;
    const rect = containerRef.current.getBoundingClientRect();
    const viewW = rect.width;
    const viewH = rect.height;
    if (viewW <= 0 || viewH <= 0) return;

    // Attempt to load existing baseline once before first calculation
    if (persistBaseline && !baselineLoadedRef.current && baselineScaleRef.current == null) {
      try {
        const host = new URL(src).hostname;
        const key = baselineStorageKey || `spf:baseline:${host}`;
        const val = sessionStorage.getItem(key);
        if (val) {
          const parsed = parseFloat(val);
            if (isFinite(parsed) && parsed > 0 && parsed < 5) {
              baselineScaleRef.current = parsed;
            }
        }
      } catch {}
      baselineLoadedRef.current = true;
    }
    let newScale = computeFit(viewW, viewH, storeW, storeH);
    if (maxScaleCap > 0 && newScale > maxScaleCap) newScale = maxScaleCap;

    if (baselineScaleRef.current == null) {
      // first time establishing baseline
      baselineScaleRef.current = newScale;
      if (persistBaseline) {
        try {
          const host = new URL(src).hostname;
          const key = baselineStorageKey || `spf:baseline:${host}`;
          sessionStorage.setItem(key, String(baselineScaleRef.current));
        } catch {}
      }
    } else {
      const lock = lockInitialScale || fitStrategy === 'once';
      if (lock) {
        // allow only downscale if content grew (newScale smaller). Never upscale above baseline.
        if (newScale < baselineScaleRef.current) {
          baselineScaleRef.current = newScale; // content got larger -> accept smaller scale to keep full fit
          if (persistBaseline) {
            try {
              const host = new URL(src).hostname;
              const key = baselineStorageKey || `spf:baseline:${host}`;
              sessionStorage.setItem(key, String(baselineScaleRef.current));
            } catch {}
          }
        }
        newScale = Math.min(newScale, baselineScaleRef.current);
      }
    }
    if (newScale <= 0 || !isFinite(newScale)) return;
    if (Math.abs(newScale - scale) < 0.0005) return; // negligible diff
    setScale(newScale);
  }, [storeW, storeH, computeFit, lockInitialScale, fitStrategy, maxScaleCap, scale]);

  // Default predicate for wtn4 domains
  const defaultAllow = useCallback((origin: string) => {
    try {
      const url = new URL(origin);
      if (url.protocol !== 'https:') return false;
      const host = url.hostname.toLowerCase();
      if (host === 'api.wtn4.com') return false; // explicit exclusion
      if (host === 'wtn4.com') return true; // root allowed
      if (host.endsWith('.wtn4.com')) return true; // any subdomain
      // Staging pattern (e.g., wtn4-stg.com or stg.wtn4.com) can be extended here if needed
      return false;
    } catch {
      return false;
    }
  }, []);

  const isAllowed = useCallback((origin: string) => {
    try {
      const url = new URL(origin);
      if (allowOriginPredicate) return allowOriginPredicate(origin, url);
    } catch {
      return false;
    }
    return defaultAllow(origin);
  }, [allowOriginPredicate, defaultAllow]);

  // Handle messages from store frame
  useEffect(() => {
    function onMessage(ev: MessageEvent) {
      const origin = ev.origin;
      if (!isAllowed(origin)) return; // dynamic security filter
      const data: DimensionsMsg = ev.data;
      if (!data || data.type !== 'storeDimensions') return;
      if (!isPositiveFinite(data.scrollWidth) || !isPositiveFinite(data.scrollHeight)) return;
      const dw = Math.abs(lastDimsRef.current.w - data.scrollWidth!);
      const dh = Math.abs(lastDimsRef.current.h - data.scrollHeight!);
      if (dw < dimensionChangeTolerance && dh < dimensionChangeTolerance) {
        // ignore tiny noise changes
        return;
      }
      lastDimsRef.current = { w: data.scrollWidth!, h: data.scrollHeight! };
      setStoreW(data.scrollWidth!);
      setStoreH(data.scrollHeight!);
      if (fallbackTimerRef.current) {
        window.clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
      setFallbackUsed(false);
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [isAllowed, dimensionChangeTolerance]);

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
      <div className="absolute bottom-1 left-1 text-[10px] px-1.5 py-0.5 rounded bg-black/50 text-white pointer-events-none select-none font-mono">
        {fallbackUsed ? 'fallback-width-fit' : showDims ? `${Math.round(scale * 100)}%${(fitStrategy==='once'||lockInitialScale)?'*':''}` : 'waiting-size'}
      </div>
    </div>
  );
};

export default StorePreviewFrame;
