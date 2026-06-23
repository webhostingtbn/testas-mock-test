'use client';

import React, { useState } from 'react';

interface ZoomableImageProps {
  src: string;
  alt?: string;
  scaleDirection?: 'width' | 'height';
}

export function ZoomableImage({ src, alt = 'Graphic', scaleDirection = 'width' }: ZoomableImageProps) {
  const [imageScale, setImageScale] = useState(100);
  const isHeight = scaleDirection === 'height';

  return (
    <div 
      className={`
        flex flex-col relative items-center justify-start gap-1 bg-gray-50/50 rounded-xl border border-gray-100 w-full overflow-hidden
        ${isHeight ? 'h-full min-h-0 flex-1' : ''}
      `}
    >
      <div 
        className={`
          w-full overflow-auto flex border border-gray-200 rounded-lg bg-white pb-14
          ${isHeight ? 'flex-1 min-h-0' : 'min-h-[150px]'}
        `}
      >
        <img
          src={src}
          alt={alt}
          style={
            isHeight
              ? { height: `${imageScale}%`, width: 'auto', maxWidth: 'none', maxHeight: 'none', margin: 'auto' }
              : { width: `${imageScale}%`, height: 'auto', maxWidth: 'none', maxHeight: 'none', margin: 'auto' }
          }
          className="rounded object-contain transition-all duration-75"
        />
      </div>
      <div className="w-full absolute bottom-2 max-w-sm flex items-center gap-3 px-4 py-1 bg-white rounded-full border border-gray-200 shadow-sm mt-2 z-10">
        <span className="text-xs text-gray-500 font-medium">Zoom</span>
        <input
          type="range"
          min="10"
          max="300"
          value={imageScale}
          onChange={(e) => setImageScale(Number(e.target.value))}
          className="flex-1 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-500"
        />
        <span className="text-xs text-gray-500 font-medium w-10 text-right">
          {imageScale}%
        </span>
      </div>
    </div>
  );
}
