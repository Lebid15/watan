// Gestures: pinch (multi-pointer), double-tap (toggle zoom then drag/pan), ctrl+wheel (desktop trackpad pinch)
// Reference consulted only (no imports): frontend/znet-ref/ — purely as conceptual guidance.
"use client";
import React, { useRef, useEffect, useState } from 'react';

interface MobileZoomFrameProps {
  children: React.ReactNode;
  width?: number; // logical device width
  minScale?: number;
  maxScale?: number;
  className?: string;
}

// Lightweight pinch + double-tap + drag zoom frame (no external libs)
export default function MobileZoomFrame({
  children,
  width = 390,
  minScale = 0.8,
  maxScale = 3,
  className = '',
}: MobileZoomFrameProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  const stateRef = useRef({
    scale: 1,
    translateX: 0,
    translateY: 0,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    originDragX: 0,
    originDragY: 0,
    pointers: new Map<number, { x: number; y: number }>(),
    initialPinchDistance: 0,
    initialPinchScale: 1,
    lastTapTime: 0,
  });

  const [, forceRender] = useState(0); // just to trigger style updates after transforms

  function applyTransform() {
    const { scale, translateX, translateY } = stateRef.current;
    if (contentRef.current) {
      contentRef.current.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    }
  }

  function clampTranslations() {
    const st = stateRef.current;
    const scaledExtra = (st.scale - 1) * width; // approximate horizontal overflow
    const maxX = scaledExtra / 2;
    const minX = -maxX;
    const contentEl = contentRef.current;
    const h = contentEl ? contentEl.getBoundingClientRect().height / st.scale : 800;
    const scaledExtraY = (st.scale - 1) * h;
    const maxY = scaledExtraY / 2;
    const minY = -maxY;
    if (st.translateX > maxX) st.translateX = maxX;
    if (st.translateX < minX) st.translateX = minX;
    if (st.translateY > maxY) st.translateY = maxY;
    if (st.translateY < minY) st.translateY = minY;
  }

  function pointerDown(e: PointerEvent) {
    const st = stateRef.current;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    st.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Double-tap detection (touch / pen)
    const now = Date.now();
    if (e.pointerType !== 'mouse') {
      if (now - st.lastTapTime < 300) {
        // toggle zoom in / reset
        const rect = contentRef.current?.getBoundingClientRect();
        if (rect) {
          const oldScale = st.scale;
          const newScale = oldScale < 1.4 ? Math.min(oldScale * 1.5, maxScale) : 1;
          const cx = e.clientX - rect.left - st.translateX;
          const cy = e.clientY - rect.top - st.translateY;
          // keep point (cx,cy) stable
          st.translateX -= cx * (newScale / oldScale - 1);
          st.translateY -= cy * (newScale / oldScale - 1);
          st.scale = newScale;
          clampTranslations();
          applyTransform();
          forceRender(n => n + 1);
        }
        st.lastTapTime = 0; // reset
        return;
      }
      st.lastTapTime = now;
    }

    if (st.pointers.size === 1) {
      st.isDragging = true;
      st.dragStartX = e.clientX;
      st.dragStartY = e.clientY;
      st.originDragX = st.translateX;
      st.originDragY = st.translateY;
    } else if (st.pointers.size === 2) {
      // pinch start
      const pts = Array.from(st.pointers.values());
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      st.initialPinchDistance = Math.hypot(dx, dy);
      st.initialPinchScale = st.scale;
    }
  }

  function pointerMove(e: PointerEvent) {
    const st = stateRef.current;
    if (!st.pointers.has(e.pointerId)) return;
    st.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (st.pointers.size === 2) {
      const pts = Array.from(st.pointers.values());
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      const dist = Math.hypot(dx, dy);
      if (st.initialPinchDistance > 0) {
        let newScale = st.initialPinchScale * (dist / st.initialPinchDistance);
        newScale = Math.max(minScale, Math.min(maxScale, newScale));
        // keep center stable
        const centerX = (pts[0].x + pts[1].x) / 2;
        const centerY = (pts[0].y + pts[1].y) / 2;
        const rect = contentRef.current?.getBoundingClientRect();
        if (rect) {
          const preX = (centerX - rect.left - st.translateX) / st.scale;
          const preY = (centerY - rect.top - st.translateY) / st.scale;
          st.scale = newScale;
          st.translateX = centerX - rect.left - preX * st.scale;
          st.translateY = centerY - rect.top - preY * st.scale;
          clampTranslations();
          applyTransform();
          forceRender(n => n + 1);
        }
      }
    } else if (st.isDragging && st.scale > 1 && st.pointers.size === 1) {
      const deltaX = e.clientX - st.dragStartX;
      const deltaY = e.clientY - st.dragStartY;
      st.translateX = st.originDragX + deltaX;
      st.translateY = st.originDragY + deltaY;
      clampTranslations();
      applyTransform();
    }
  }

  function pointerUp(e: PointerEvent) {
    const st = stateRef.current;
    st.pointers.delete(e.pointerId);
    if (st.pointers.size < 2) {
      st.initialPinchDistance = 0;
    }
    if (st.pointers.size !== 1) {
      st.isDragging = false;
    }
  }

  function wheel(e: WheelEvent) {
    if (!e.ctrlKey) return; // pinch-zoom gestures on trackpads set ctrlKey
    e.preventDefault();
    const st = stateRef.current;
    const rect = contentRef.current?.getBoundingClientRect();
    if (!rect) return;
    const delta = -e.deltaY * 0.0015; // sensitivity
    const oldScale = st.scale;
    let newScale = oldScale * (1 + delta);
    newScale = Math.max(minScale, Math.min(maxScale, newScale));
    if (newScale === oldScale) return;
    const cx = e.clientX - rect.left - st.translateX;
    const cy = e.clientY - rect.top - st.translateY;
    st.translateX -= cx * (newScale / oldScale - 1);
    st.translateY -= cy * (newScale / oldScale - 1);
    st.scale = newScale;
    clampTranslations();
    applyTransform();
  }

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('pointerdown', pointerDown);
    el.addEventListener('pointermove', pointerMove);
    el.addEventListener('pointerup', pointerUp);
    el.addEventListener('pointercancel', pointerUp);
    el.addEventListener('wheel', wheel, { passive: false });
    return () => {
      el.removeEventListener('pointerdown', pointerDown);
      el.removeEventListener('pointermove', pointerMove);
      el.removeEventListener('pointerup', pointerUp);
      el.removeEventListener('pointercancel', pointerUp);
      el.removeEventListener('wheel', wheel);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={[
        'relative mx-auto border border-border/40 rounded-xl shadow-sm bg-bg-base overflow-hidden touch-pan-y select-none',
        className,
      ].join(' ')}
      style={{ width, height: 'calc(100vh - 2rem)' }}
    >
      <div
        ref={contentRef}
        style={{ width, transformOrigin: '0 0', minHeight: '100%', willChange: 'transform' }}
        className="relative"
      >
        {children}
      </div>
      <div className="absolute bottom-2 right-2 text-[10px] px-2 py-1 bg-black/40 text-white rounded-full pointer-events-none">
        pinch / double-tap
      </div>
    </div>
  );
}
