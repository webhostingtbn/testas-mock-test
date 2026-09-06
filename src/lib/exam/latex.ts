/**
 * Shared LaTeX/markdown normalization for question rendering.
 *
 * Content authors mix several conventions:
 * - `\(...\)` / `\[...\]` (LaTeX delimiters)
 * - `$...$` / `$$...$$` (already fine for remark-math)
 * - `\ce{...}` chemistry (mhchem) inside plain `(...)` or `[...]`
 *
 * This normalizes everything to `$...$` / `$$...$$` before remark-math sees it.
 * KaTeX itself learns `\ce` via `katex/contrib/mhchem` (imported once in
 * `RichMarkdown`). Chemistry patterns run FIRST so already-converted `$...$`
 * spans are never re-processed.
 */

// Long display equations are unreadable when shrunk to fit, so they are
// broken across lines at top-level `+` / `->` (reaction arrows always start
// a new line). Short ones stay single-line and use font-fit instead.
const DISPLAY_SPLIT_MIN_LENGTH = 55;
const DISPLAY_LINE_BUDGET = 42;

function splitChemChunks(inner: string): string[] {
  // Splits on top-level `->` and spaced ` + ` / ` - ` operators only.
  // `^+` / `^-` charges, `{...}` groups and unspaced `+` (e.g. `Th+`)
  // are part of the formula and never split.
  const chunks: string[] = [];
  let pendingOp: string | null = null;
  let buffer = '';
  const flush = () => {
    const term = buffer.trim();
    buffer = '';
    if (!term) return;
    chunks.push(pendingOp ? `${pendingOp} ${term}` : term);
    pendingOp = null;
  };
  const prevChar = () => buffer[buffer.length - 1] ?? '';
  for (let i = 0; i < inner.length; ) {
    const ch = inner[i];
    if (ch === '{') {
      // Copy the whole group (may nest) so inner +/- never split.
      let depth = 0;
      let j = i;
      while (j < inner.length) {
        if (inner[j] === '{') depth += 1;
        else if (inner[j] === '}') {
          depth -= 1;
          if (depth === 0) {
            j += 1;
            break;
          }
        }
        j += 1;
      }
      buffer += inner.slice(i, Math.max(j, i + 1));
      i = Math.max(j, i + 1);
    } else if ((ch === '^' || ch === '_') && i + 1 < inner.length) {
      // Charge/isotope script atom: `^+`, `^-`, `_i`, `_{90}` — atomic.
      if (inner[i + 1] === '{') {
        let depth = 0;
        let j = i + 1;
        while (j < inner.length) {
          if (inner[j] === '{') depth += 1;
          else if (inner[j] === '}') {
            depth -= 1;
            if (depth === 0) {
              j += 1;
              break;
            }
          }
          j += 1;
        }
        buffer += inner.slice(i, Math.max(j, i + 2));
        i = Math.max(j, i + 2);
      } else {
        buffer += inner.slice(i, i + 2);
        i += 2;
      }
    } else if (inner.startsWith('->', i)) {
      flush();
      pendingOp = '->';
      i += 2;
    } else if ((ch === '+' || ch === '-') && /[\s]/.test(prevChar())) {
      // Spaced operator: separator. Unspaced `+` (e.g. trailing `Th+`)
      // is a charge and stays literal.
      flush();
      pendingOp = ch;
      i += 1;
    } else {
      buffer += ch;
      i += 1;
    }
  }
  flush();
  return chunks;
}

function toDisplayChem(inner: string): string {
  const chunks = splitChemChunks(inner);
  if (inner.length <= DISPLAY_SPLIT_MIN_LENGTH || chunks.length <= 1) {
    return `$$\\ce{${inner}}$$`;
  }
  const lines: string[] = [];
  let line = chunks[0];
  for (let c = 1; c < chunks.length; c += 1) {
    const chunk = chunks[c];
    // Reaction arrows always start a fresh line.
    if (chunk.startsWith('->') || `${line} ${chunk}`.length > DISPLAY_LINE_BUDGET) {
      lines.push(line);
      line = chunk;
    } else {
      line = `${line} ${chunk}`;
    }
  }
  lines.push(line);
  // NOTE: each line is its own single-line `$$` block separated by blank
  // lines. `\begin{aligned}` environments cannot pass through remark-math:
  // it strips the opener but keeps `\end{aligned}`, which KaTeX rejects.
  return lines.map((l) => `$$\\ce{${l}}$$`).join('\n\n');
}

// Matches `[\ce{...}]` (optional inner whitespace) — display chemistry.
// Handed to toDisplayChem, which keeps short equations single-line and
// breaks long ones across aligned lines.
const DISPLAY_CHEM_PATTERN = /\[\s*(\\ce\{(?:[^{}]|\{[^{}]*\})*\})\s*\]/g;

// Matches `(\ce{...})` (optional inner whitespace) — inline chemistry in prose
// parens, e.g. "The ammonium ion ( \ce{NH4^+} ) is ...".
const INLINE_CHEM_PARENS_PATTERN = /\(\s*(\\ce\{(?:[^{}]|\{[^{}]*\})*\})\s*\)/g;

function chemInner(command: string): string {
  return command.startsWith('\\ce{') && command.endsWith('}') ? command.slice(4, -1) : command;
}

export function prepareLatex(text: unknown): string {
  if (typeof text !== 'string') return '';
  return (
    text
      // Display chemistry `[\ce{...}]` -> single-line `$$` or aligned lines
      .replace(DISPLAY_CHEM_PATTERN, (_match: string, chem: string) => toDisplayChem(chemInner(chem)))
      // Inline chemistry `(\ce{...})` -> `($\ce{...}$)`, outer parens preserved
      .replace(INLINE_CHEM_PARENS_PATTERN, (_match: string, chem: string) => `($${chem}$)`)
      // LaTeX block delimiters `\[...\]` -> `$$...$$`
      .replace(/\\\[([\s\S]*?)\\\]/g, (_match: string, body: string) => `$$${body}$$`)
      // LaTeX inline delimiters `\(...\)` -> `$...$`
      .replace(/\\\(([\s\S]*?)\\\)/g, (_match: string, body: string) => `$${body}$`)
  );
}
