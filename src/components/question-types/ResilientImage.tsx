'use client';

import { useState, type ImgHTMLAttributes, type Ref, type SyntheticEvent } from 'react';
import { ImageOff } from 'lucide-react';
import { refreshSignedUrl } from '@/lib/services/image-service';

interface ResilientImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  src?: string;
  /** Forwarded ref (e.g. CanvasImage reads naturalWidth for auto-fit). */
  imgRef?: Ref<HTMLImageElement>;
  /** Short label shown in the fallback tile when the image cannot be loaded. */
  fallbackLabel?: string;
}

/**
 * Drop-in <img> replacement that self-heals expired storage signatures.
 * If the image fails to load (e.g. the signed URL expired while the page
 * sat open for hours), it re-signs once and retries automatically. The
 * retry is keyed to the failing src, so a later src change is never
 * polluted by a previous retry.
 *
 * When loading fails terminally (no fresh signature available, or the
 * retried URL fails too — e.g. a 404), it renders a small "image
 * unavailable" tile in place of the image so the UI shows loading is over
 * instead of a blank box or an eternal loader. Callers are still notified
 * of every failure via onError.
 */
export function ResilientImage({ src, imgRef, onError, fallbackLabel, className, alt, ...rest }: ResilientImageProps) {
  const [retry, setRetry] = useState<{ forSrc: string; url: string } | null>(null);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const normalizedSrc = src ?? '';
  const currentSrc = retry !== null && retry.forSrc === normalizedSrc ? retry.url : normalizedSrc;
  const isFailed = failedSrc !== null && failedSrc === normalizedSrc;

  const handleError = (event: SyntheticEvent<HTMLImageElement, Event>) => {
    if (retry !== null && retry.forSrc === normalizedSrc) {
      // The retried URL failed as well — loading is over.
      setFailedSrc(normalizedSrc);
      onError?.(event);
      return;
    }
    const failedUrl = currentSrc;
    void refreshSignedUrl(failedUrl).then((freshUrl) => {
      if (freshUrl && freshUrl !== failedUrl) {
        setRetry({ forSrc: normalizedSrc, url: freshUrl });
      } else {
        setFailedSrc(normalizedSrc);
        onError?.(event);
      }
    });
  };

  if (isFailed) {
    return (
      <div
        className={`flex items-center justify-center gap-1.5 bg-slate-50 p-2 text-center ${className ?? ''}`}
        style={rest.style}
        role="img"
        aria-label={typeof alt === 'string' && alt ? alt : 'Image unavailable'}
      >
        <ImageOff className="size-3.5 shrink-0 text-slate-400" aria-hidden="true" />
        <span className="text-[10px] font-medium leading-tight text-slate-400">
          {fallbackLabel ?? 'Image unavailable'}
        </span>
      </div>
    );
  }

  if (!normalizedSrc) {
    return null;
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img {...rest} className={className} alt={alt} ref={imgRef} src={currentSrc} onError={handleError} />;
}
