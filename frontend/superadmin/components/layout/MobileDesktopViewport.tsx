'use client';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';

type MobileDesktopViewportProps = {
  children: ReactNode;
  designWidth?: number;
  minScale?: number;
  viewportWidthOverride?: number;
  viewportHeightOverride?: number;
};

/**
 * Scales the full desktop layout down on touch devices so the entire canvas fits the screen.
 * Users can still pinch-zoom for details, matching the legacy reseller portal behaviour.
 */
export default function MobileDesktopViewport({
  children,
  designWidth = 1280,
  minScale = 0.3,
  viewportWidthOverride,
  viewportHeightOverride,
}: MobileDesktopViewportProps) {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [viewport, setViewport] = useState(() => ({ width: designWidth, height: 800 }));
  const [contentSize, setContentSize] = useState(() => ({ width: designWidth, height: 1200 }));

  // Track current viewport (device) size so we can adjust the scale responsively.
  useEffect(() => {
    const updateViewport = () => {
      if (typeof window === 'undefined') return;
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };

    updateViewport();
    window.addEventListener('resize', updateViewport);
    window.addEventListener('orientationchange', updateViewport);
    return () => {
      window.removeEventListener('resize', updateViewport);
      window.removeEventListener('orientationchange', updateViewport);
    };
  }, []);

  // Measure the layout height so scrolling behaves correctly after scaling.
  useEffect(() => {
    if (!contentRef.current || typeof ResizeObserver === 'undefined') return;

    const node = contentRef.current;
    const measure = () => {
      setContentSize({ width: node.scrollWidth || designWidth, height: node.scrollHeight || 1200 });
    };

    // Initial measurement after hydration.
    const id = window.requestAnimationFrame(measure);

    const observer = new ResizeObserver(() => measure());
    observer.observe(node);

    return () => {
      window.cancelAnimationFrame(id);
      observer.disconnect();
    };
  }, [designWidth]);

  const effectiveWidth = viewportWidthOverride ?? viewport.width;
  const effectiveHeight = viewportHeightOverride ?? viewport.height;

  const scale = useMemo(() => {
    const ratio = effectiveWidth / designWidth;
    const clamped = Math.min(1, Math.max(minScale, ratio));
    return Number.isFinite(clamped) ? clamped : 1;
  }, [effectiveWidth, designWidth, minScale]);

  const scaledHeight = Math.max(contentSize.height * scale, effectiveHeight);

  return (
    <div
      className="relative w-full overflow-auto bg-bg-base"
      style={{
        height: effectiveHeight,
        touchAction: 'pan-y pinch-zoom',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {/* Spacer div reserves the scaled layout bounds so native scrolling works. */}
      <div style={{ width: designWidth * scale, height: scaledHeight }} />

      <div
        ref={contentRef}
        className="absolute top-0 right-0 left-auto"
        style={{
          width: designWidth,
          transformOrigin: 'top right',
          transform: `scale(${scale})`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
