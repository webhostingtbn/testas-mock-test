'use client';

import React, { useState, useRef, useEffect } from 'react';

interface CanvasImageProps {
  src: string;
  alt?: string;
  minZoom?: number;
  maxZoom?: number;
  initialZoom?: number;
}

export function CanvasImage({
  src,
  alt = 'Graphic',
  minZoom = 0.1,
  maxZoom = 2,
  initialZoom = 1
}: CanvasImageProps) {
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [startPosition, setStartPosition] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Auto-fit image to container on load using natural dimensions
  useEffect(() => {
    const fitImageToContainer = () => {
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
    };

    window.addEventListener('resize', fitImageToContainer);
    fitImageToContainer();

    return () => window.removeEventListener('resize', fitImageToContainer);
  }, []);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();

    const zoomSensitivity = 0.002;
    const delta = -e.deltaY * zoomSensitivity;
    const newZoom = Math.min(Math.max(zoom + delta, minZoom), maxZoom);

    setZoom(newZoom);
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
        y: e.clientY - startPosition.y
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
        y: e.touches[0].clientY - startPosition.y
      });
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const resetView = () => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  };

  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: e.clientX - startPosition.x,
          y: e.clientY - startPosition.y
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
          y: e.touches[0].clientY - startPosition.y
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
        relative w-full h-full overflow-hidden bg-gray-50/50 rounded-xl border border-gray-200
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
    >
      <div
        className="absolute top-0 left-0 w-full h-full flex items-center justify-center"
        style={{ transform: `translate(${position.x}px, ${position.y}px)`, pointerEvents: 'none' }}
      >
        <img
          ref={imageRef}
          src={src}
          alt={alt}
          className="max-w-none object-contain pointer-events-none transition-transform duration-75 ease-out"
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: 'center center'
          }}
          onLoad={() => setImageLoaded(true)}
        />
      </div>

      {/* Zoom controls */}
      <div className="absolute bottom-4 right-4 flex items-center gap-2 bg-white/90 backdrop-blur-sm rounded-lg border border-gray-200 shadow-lg px-3 py-2">
        <button 
          onClick={() => setZoom(Math.max(minZoom, zoom - 0.1))}
          disabled={zoom <= minZoom}
          className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-gray-600"
        >
          <span className="text-xl font-bold">−</span>
        </button>
        
        <span className="text-xs font-medium w-12 text-center text-gray-700">
          {Math.round(zoom * 100)}%
        </span>
        
        <button 
          onClick={() => setZoom(Math.min(maxZoom, zoom + 0.1))}
          disabled={zoom >= maxZoom}
          className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-gray-600"
        >
          <span className="text-xl font-bold">+</span>
        </button>
        
        <div className="w-px h-4 bg-gray-300 mx-1" />
        
        <button 
          onClick={resetView}
          className="text-xs font-medium text-orange-600 hover:text-orange-700 px-2 py-1 rounded hover:bg-orange-50"
        >
          Reset
        </button>
      </div>

      {/* Zoom indicator if using mouse wheel */}
      {zoom !== initialZoom && (
        <div className="absolute top-4 right-4 bg-black/50 text-white text-xs px-2 py-1 rounded backdrop-blur-sm">
          Scroll to zoom
        </div>
      )}
    </div>
  );
}