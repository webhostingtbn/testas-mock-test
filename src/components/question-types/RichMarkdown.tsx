'use client';

import 'katex/dist/katex.min.css';
// Registers \ce / \pu chemistry macros on the shared KaTeX instance.
import 'katex/contrib/mhchem';
import { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import { prepareLatex } from '@/lib/exam/latex';

interface RichMarkdownProps {
  content: unknown;
}

// KaTeX sizes everything in em, so shrinking the display block's font-size
// scales the whole equation proportionally (and reflows layout, unlike
// transform: scale). Floor keeps text readable; CSS scroll is the backstop.
const MIN_DISPLAY_SCALE = 0.4;

function fitDisplayMath(root: HTMLElement): void {
  const displays = root.querySelectorAll('.katex-display');
  displays.forEach((display) => {
    const block = display as HTMLElement;
    const inner = block.querySelector('.katex') as HTMLElement | null;
    if (!inner) return;
    block.style.fontSize = '';
    const available = block.clientWidth;
    const natural = inner.offsetWidth;
    if (available <= 0 || natural <= 0 || natural <= available) return;
    const scale = Math.max(MIN_DISPLAY_SCALE, available / natural);
    if (scale < 1) block.style.fontSize = `${scale * 100}%`;
  });
}

/**
 * Single markdown renderer for all question/passage text: LaTeX + chemistry
 * normalization, math (KaTeX, non-throwing) and GFM tables.
 *
 * The wrapper keeps wide display equations from clipping: `.katex-display`
 * scrolls horizontally (see globals.css) instead of overflowing the pane.
 */
export function RichMarkdown({ content }: RichMarkdownProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    fitDisplayMath(root);
    // KaTeX webfonts load async and shift metrics — refit once ready.
    let cancelled = false;
    if (typeof document !== 'undefined' && document.fonts) {
      document.fonts.ready
        .then(() => {
          if (!cancelled) fitDisplayMath(root);
        })
        .catch(() => undefined);
    }
    const observer = new ResizeObserver(() => fitDisplayMath(root));
    observer.observe(root);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [content]);

  return (
    <div ref={rootRef} className="rich-markdown min-w-0 max-w-full">
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]}
      >
        {prepareLatex(content)}
      </ReactMarkdown>
    </div>
  );
}
