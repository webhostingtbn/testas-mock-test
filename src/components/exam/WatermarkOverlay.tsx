'use client';

import { useMemo } from 'react';

interface WatermarkOverlayProps {
  email: string;
  fullName?: string | null;
}

export default function WatermarkOverlay({ email, fullName }: WatermarkOverlayProps) {
  const backgroundImage = useMemo(() => {
    if (!email) return '';

    const dateStr = new Date().toLocaleDateString();
    const displayName = fullName ? `${fullName} - ` : '';
    const text = `${displayName}${email} (${dateStr})`;

    // Generate SVG string with rotated watermark text
    const svgString = `
      <svg xmlns="http://www.w3.org/2000/svg" width="350" height="250" viewBox="0 0 350 250">
        <text x="50%" y="50%" fill="#64748b" font-size="11" font-family="monospace" font-weight="bold" transform="rotate(-20 175 125)" text-anchor="middle" opacity="0.06">
          ${text}
        </text>
      </svg>
    `;

    // Convert to base64 safely
    const base64Svg = typeof btoa !== 'undefined' 
      ? btoa(unescape(encodeURIComponent(svgString))) 
      : '';

    return `url("data:image/svg+xml;base64,${base64Svg}")`;
  }, [email, fullName]);

  if (!email) return null;

  return (
    <div 
      className="fixed inset-0 pointer-events-none select-none z-[4]"
      style={{ backgroundImage }}
    />
  );
}
