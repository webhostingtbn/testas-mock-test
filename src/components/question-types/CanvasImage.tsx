'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Move, X, ZoomIn, ZoomOut } from 'lucide-react';
import { ResilientImage } from './ResilientImage';
import { useLanguage } from '@/components/i18n/LanguageProvider';

export type ZoomControlPlacement = 'bottom-right' | 'bottom-left' | 'top-left' | 'top-right';

interface CanvasImageProps {
  src: string;
  alt?: string;
  minZoom?: number;
  maxZoom?: number;
  initialZoom?: number;
  defaultPlacement?: ZoomControlPlacement;
  defaultControlsOpen?: boolean;
}

const PLACEMENT_CLASSES: Record<ZoomControlPlacement, string> = {
  'bottom-right': 'bottom-3 right-3',
  'bottom-left': 'bottom-3 left-3',
  'top-left': 'top-3 left-3',
  'top-right': 'top-3 right-3',
};

const PLACEMENT_CYCLE: Record<ZoomControlPlacement, ZoomControlPlacement> = {
  'bottom-right': 'bottom-left',
  'bottom-left': 'top-left',
  'top-left': 'top-right',
  'top-right': 'bottom-right',
};

function computeQuadrant(clientX: number, clientY: number, containerRect: DOMRect): ZoomControlPlacement {
  const midX = containerRect.left + containerRect.width / 2;
  const midY = containerRect.top + containerRect.height / 2;
  const isLeft = clientX < midX;
  const isTop = clientY < midY;
  if (isTop && isLeft) return 'top-left';
  if (isTop && !isLeft) return 'top-right';
  if (!isTop && isLeft) return 'bottom-left';
  return 'bottom-right';
}

export function CanvasImage({
  src,
  alt,
  minZoom = 0.1,
  maxZoom = 2,
  initialZoom = 1,
  defaultPlacement = 'bottom-right',
  defaultControlsOpen = true,
}: CanvasImageProps) {
  const { t } = useLanguage();
  const resolvedAlt = alt ?? t('common.graphic');
  const [zoom, setZoom] = useState(initialZoom);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [startPosition, setStartPosition] = useState({ x: 0, y: 0 });
  const [placement, setPlacement] = useState<ZoomControlPlacement>(defaultPlacement);
  const [isControlsOpen, setIsControlsOpen] = useState(defaultControlsOpen);
  const [isDraggingControls, setIsDraggingControls] = useState(false);
  const [showWheelHint, setShowWheelHint] = useState(false);
  const wheelHintTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragStartRef = useRef<{ x: number; y: number; moved: boolean } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  // Set once the user zooms/pans manually — auto-fit must not fight them.
  const userAdjustedRef = useRef(false);

  // Auto-fit image to container using natural dimensions. Re-runs when the
  // image source or container size changes (e.g. accordion opens, question
  // switches), but never after the user has adjusted the view themselves.
  const fitImageToContainer = useCallback(() => {
    if (userAdjustedRef.current) return;
    if (containerRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      // Use natural dimensions if available, otherwise fallback to container
      const naturalWidth = imageRef.current?.naturalWidth || containerRect.width;
      const naturalHeight = imageRef.current?.naturalHeight || containerRect.height;

      if (naturalWidth > 0 && naturalHeight > 0) {
        const scaleX = containerRect.width / naturalWidth;
        const scaleY = containerRect.height / naturalHeight;
        const fitScale = Math.min(scaleX, scaleY, 1);

        setZoom(fitScale);
        setPosition({ x: 0, y: 0 });
      }
    }
  }, []);

  useEffect(() => {
    // Fresh image: reset the view so the previous question's zoom never leaks.
    userAdjustedRef.current = false;
    fitImageToContainer();

    const container = containerRef.current;
    let observer: ResizeObserver | null = null;
    if (container && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(fitImageToContainer);
      observer.observe(container);
    }
    window.addEventListener('resize', fitImageToContainer);

    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', fitImageToContainer);
      if (wheelHintTimeoutRef.current) {
        clearTimeout(wheelHintTimeoutRef.current);
      }
    };
  }, [src, fitImageToContainer]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    userAdjustedRef.current = true;

    const zoomSensitivity = 0.002;
    const delta = -e.deltaY * zoomSensitivity;
    const newZoom = Math.min(Math.max(zoom + delta, minZoom), maxZoom);

    setZoom(newZoom);

    setShowWheelHint(true);
    if (wheelHintTimeoutRef.current) {
      clearTimeout(wheelHintTimeoutRef.current);
    }
    wheelHintTimeoutRef.current = setTimeout(() => {
      setShowWheelHint(false);
    }, 1500);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom > 1.1) { // Only drag when significantly zoomed
      setIsDragging(true);
      setStartPosition({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - startPosition.x,
        y: e.clientY - startPosition.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (zoom > 1.1 && e.touches.length === 1) {
      setIsDragging(true);
      setStartPosition({ x: e.touches[0].clientX - position.x, y: e.touches[0].clientY - position.y });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDragging && e.touches.length === 1) {
      e.preventDefault();
      setPosition({
        x: e.touches[0].clientX - startPosition.x,
        y: e.touches[0].clientY - startPosition.y,
      });
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const resetView = () => {
    userAdjustedRef.current = false;
    fitImageToContainer();
  };

  const handleMovePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStartRef.current = { x: e.clientX, y: e.clientY, moved: false };
  };

  const handleMovePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragStartRef.current) return;
    const dx = Math.abs(e.clientX - dragStartRef.current.x);
    const dy = Math.abs(e.clientY - dragStartRef.current.y);
    if (dx > 5 || dy > 5) {
      dragStartRef.current.moved = true;
      setIsDraggingControls(true);
    }
  };

  const handleMovePointerCancel = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture was already released
    }
    dragStartRef.current = null;
    setIsDraggingControls(false);
  };

  const handleMovePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture was already released
    }
    const wasMoved = dragStartRef.current?.moved ?? false;
    dragStartRef.current = null;
    setIsDraggingControls(false);

    if (wasMoved && containerRef.current) {
      setPlacement(computeQuadrant(e.clientX, e.clientY, containerRef.current.getBoundingClientRect()));
    } else {
      setPlacement((prev) => PLACEMENT_CYCLE[prev]);
    }
  };

  const handleCollapsedPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStartRef.current = { x: e.clientX, y: e.clientY, moved: false };
  };

  const handleCollapsedPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragStartRef.current) return;
    const dx = Math.abs(e.clientX - dragStartRef.current.x);
    const dy = Math.abs(e.clientY - dragStartRef.current.y);
    if (dx > 5 || dy > 5) {
      dragStartRef.current.moved = true;
      setIsDraggingControls(true);
    }
  };

  const handleCollapsedPointerCancel = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture was already released
    }
    dragStartRef.current = null;
    setIsDraggingControls(false);
  };

  const handleCollapsedPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture was already released
    }
    const wasMoved = dragStartRef.current?.moved ?? false;
    dragStartRef.current = null;
    setIsDraggingControls(false);

    if (wasMoved && containerRef.current) {
      setPlacement(computeQuadrant(e.clientX, e.clientY, containerRef.current.getBoundingClientRect()));
    } else {
      setIsControlsOpen(true);
    }
  };

  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: e.clientX - startPosition.x,
          y: e.clientY - startPosition.y,
        });
      }
    };

    const handleGlobalMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDragging, startPosition]);

  useEffect(() => {
    const handleGlobalTouchMove = (e: TouchEvent) => {
      if (isDragging && e.touches.length === 1) {
        setPosition({
          x: e.touches[0].clientX - startPosition.x,
          y: e.touches[0].clientY - startPosition.y,
        });
      }
    };

    const handleGlobalTouchEnd = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('touchmove', handleGlobalTouchMove, { passive: false });
      document.addEventListener('touchend', handleGlobalTouchEnd);
    }

    return () => {
      document.removeEventListener('touchmove', handleGlobalTouchMove);
      document.removeEventListener('touchend', handleGlobalTouchEnd);
    };
  }, [isDragging, startPosition]);

  return (
    <div 
      ref={containerRef}
      className={`
        relative w-full h-full min-h-[240px] overflow-hidden bg-gray-50/50 rounded-xl border border-gray-200 select-none
        ${zoom > 1.1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}
      `}
      style={{ touchAction: 'none' }}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onDoubleClick={resetView}
    >
      <div
        className="absolute top-0 left-0 w-full h-full flex items-center justify-center"
        style={{ transform: `translate(${position.x}px, ${position.y}px)`, pointerEvents: 'none' }}
      >
        <ResilientImage
          imgRef={imageRef}
          src={src}
          alt={resolvedAlt}
          className="max-w-none object-contain pointer-events-none transition-transform duration-75 ease-out"
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: 'center center',
          }}
          onLoad={fitImageToContainer}
        />
      </div>

      {/* Zoom controls */}
      {isControlsOpen ? (
        <div
          className={`absolute ${PLACEMENT_CLASSES[placement]} z-10 flex items-center gap-1.5 bg-white border border-[#E5E7EB] shadow-xs rounded-lg px-2 py-1.5`}
          onMouseDown={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <button 
            type="button"
            onClick={() => {
              userAdjustedRef.current = true;
              setZoom(Math.max(minZoom, zoom - 0.1));
            }}
            disabled={zoom <= minZoom}
            className="w-7 h-7 flex items-center justify-center rounded text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors focus-visible:ring-2 focus-visible:ring-[#EA580C]/40 outline-none"
            title={t('common.zoomOut')}
            aria-label={t('common.zoomOut')}
          >
            <ZoomOut className="size-3.5" aria-hidden="true" />
          </button>
          
          <span className="text-xs font-medium w-11 text-center tabular-nums text-zinc-700">
            {Math.round(zoom * 100)}%
          </span>
          
          <button 
            type="button"
            onClick={() => {
              userAdjustedRef.current = true;
              setZoom(Math.min(maxZoom, zoom + 0.1));
            }}
            disabled={zoom >= maxZoom}
            className="w-7 h-7 flex items-center justify-center rounded text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors focus-visible:ring-2 focus-visible:ring-[#EA580C]/40 outline-none"
            title={t('common.zoomIn')}
            aria-label={t('common.zoomIn')}
          >
            <ZoomIn className="size-3.5" aria-hidden="true" />
          </button>
          
          <div className="w-px h-4 bg-[#E5E7EB] mx-0.5" />
          
          <button 
            type="button"
            onClick={resetView}
            className="text-xs font-medium text-[#EA580C] hover:text-[#C2410C] px-1.5 py-1 rounded hover:bg-[#FFF7ED] transition-colors focus-visible:ring-2 focus-visible:ring-[#EA580C]/40 outline-none"
            title={t('common.reset')}
          >
            {t('common.reset')}
          </button>

          <div className="w-px h-4 bg-[#E5E7EB] mx-0.5" />

          <button
            type="button"
            onPointerDown={handleMovePointerDown}
            onPointerMove={handleMovePointerMove}
            onPointerUp={handleMovePointerUp}
            onPointerCancel={handleMovePointerCancel}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setPlacement((prev) => PLACEMENT_CYCLE[prev]);
              }
            }}
            className={`w-7 h-7 flex items-center justify-center rounded text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors touch-none focus-visible:ring-2 focus-visible:ring-[#EA580C]/40 outline-none ${
              isDraggingControls ? 'cursor-grabbing bg-zinc-100' : 'cursor-grab'
            }`}
            title={t('common.changePlacement')}
            aria-label={t('common.changePlacement')}
          >
            <Move className="size-3.5" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => setIsControlsOpen(false)}
            className="w-7 h-7 flex items-center justify-center rounded text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors focus-visible:ring-2 focus-visible:ring-[#EA580C]/40 outline-none"
            title={t('common.close')}
            aria-label={t('common.close')}
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onPointerDown={handleCollapsedPointerDown}
          onPointerMove={handleCollapsedPointerMove}
          onPointerUp={handleCollapsedPointerUp}
          onPointerCancel={handleCollapsedPointerCancel}
          onMouseDown={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setIsControlsOpen(true);
            }
          }}
          className={`absolute ${PLACEMENT_CLASSES[placement]} z-10 w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-[#E5E7EB] shadow-xs text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 transition-colors touch-none focus-visible:ring-2 focus-visible:ring-[#EA580C]/40 outline-none ${
            isDraggingControls ? 'cursor-grabbing bg-zinc-100' : 'cursor-pointer'
          }`}
          title={t('common.zoom')}
          aria-label={t('common.zoom')}
        >
          <ZoomIn className="size-4 text-zinc-600" aria-hidden="true" />
        </button>
      )}

      {/* Zoom indicator when using mouse wheel */}
      {showWheelHint && (
        <div
          className={`absolute ${
            placement === 'top-right' ? 'top-3 left-3' : 'top-3 right-3'
          } bg-black/60 text-white text-[11px] font-medium px-2 py-1 rounded pointer-events-none transition-all z-10`}
        >
          {t('common.scrollToZoom')}
        </div>
      )}
    </div>
  );
}
