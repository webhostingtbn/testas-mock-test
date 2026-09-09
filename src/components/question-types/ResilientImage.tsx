'use client';

import { useState, type ImgHTMLAttributes, type Ref, type SyntheticEvent } from 'react';
import { refreshSignedUrl } from '@/lib/services/image-service';

interface ResilientImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  src?: string;
  /** Forwarded ref (e.g. CanvasImage reads naturalWidth for auto-fit). */
  imgRef?: Ref<HTMLImageElement>;
}

/**
 * Drop-in <img> replacement that self-heals expired storage signatures.
 * If the image fails to load (e.g. the signed URL expired while the page
 * sat open for hours), it re-signs once and retries automatically. The
 * retry is keyed to the failing src, so a later src change is never
 * polluted by a previous retry.
 */
export function ResilientImage({ src, imgRef, onError, ...rest }: ResilientImageProps) {
  const [retry, setRetry] = useState<{ forSrc: string; url: string } | null>(null);
  const normalizedSrc = src ?? '';
  const currentSrc = retry !== null && retry.forSrc === normalizedSrc ? retry.url : normalizedSrc;

  const handleError = (event: SyntheticEvent<HTMLImageElement, Event>) => {
    onError?.(event);
    if (retry !== null && retry.forSrc === normalizedSrc) return;
    const failedSrc = currentSrc;
    void refreshSignedUrl(failedSrc).then((freshUrl) => {
      if (freshUrl && freshUrl !== failedSrc) {
        setRetry({ forSrc: normalizedSrc, url: freshUrl });
      }
    });
  };

  // eslint-disable-next-line @next/next/no-img-element
  return <img alt="" {...rest} ref={imgRef} src={currentSrc} onError={handleError} />;
}
