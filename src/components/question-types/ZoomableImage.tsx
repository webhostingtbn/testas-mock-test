'use client';

import React, { useState } from 'react';

interface ZoomableImageProps {
  src: string;
  alt?: string;
}

export function ZoomableImage({ src, alt = 'Graphic' }: ZoomableImageProps) {
  const [imageScale, setImageScale] = useState(100);

  return (
    <div className="flex flex-col relative items-center justify-start gap-1 bg-gray-50/50 rounded-xl border border-gray-100 w-full overflow-hidden">
      <div className="w-full overflow-auto flex justify-center border border-gray-200 rounded-lg bg-white min-h-[150px]">
        <img
          src={src}
          alt={alt}
          style={{ width: `${imageScale}%`, maxWidth: 'none' }}
          className="rounded object-contain transition-all duration-75 m-0! mb-10!"
        />
      </div>
      <div className="w-full absolute bottom-2 max-w-sm flex items-center gap-3 px-4 py-1 bg-white rounded-full border border-gray-200 shadow-sm mt-2">
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
