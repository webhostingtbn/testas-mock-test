# Exam & Practice UI Style Guide

Single source of truth for the TestAS exam / practice interface.
Follow this on every exam-related change. It supersedes `DESIGN.md` for
anything inside the exam and practice views (`DESIGN.md` still governs the
marketing/dashboard surfaces).

## 1. Core principles ("anti-slop" rules)

1. **Whitespace over borders.** Group with padding and `gap`. Only
   interactive elements (options, inputs, tiles) get borders. Never put a
   bordered card around a whole pane or the whole view.
2. **Elevation zero.** No `shadow-md/lg`, no `ring-*` glows, no scale-on-select,
   no glassmorphism (`backdrop-blur`) in exam views. Structure comes from a
   flat canvas shift plus 1px hairlines.
3. **Single accent.** ~95% monochrome (white, soft grays, deep slate). One warm
   accent (`#EA580C`) reserved strictly for active states, radios, and review
   flags. Exception: difficulty-rating colors (emerald/amber/rose) and
   test-content fidelity (e.g. black figure-sequence matrix borders).
4. **No cluttered pagination in practice.** No horizontal `1 2 3 … 39` chains.
   One compact `Question X of Y ▾` pill opening a status grid. (The timed
   **exam** view keeps its number chain — see §7.)
5. **Flat markdown.** Markdown content must always render with `prose` styling
   (Tailwind preflight strips all heading/list/bold hierarchy otherwise).

## 2. Color tokens

| Token            | Value       | Usage                                                        |
| ---------------- | ----------- | ------------------------------------------------------------ |
| `bg-canvas`      | `#F4F4F5`   | Timer pill, navigator pill, answered badges, display rows    |
| `bg-surface`     | `#FFFFFF`   | Panes, option cards, keypad keys                             |
| `bg-hover`       | `#FAFAFA`   | Hover state for options/tiles/keys                           |
| `border-subtle`  | `#E5E7EB`   | All 1px hairlines, unselected borders                        |
| `border-hover`   | `#D1D5DB`   | Hover border                                                 |
| `text-primary`   | `#18181B`   | Headings, questions, option text, primary button fill        |
| `text-secondary` | `#71717A`   | Labels, instructions, metadata, muted icons                  |
| `text-faint`     | `#9CA3AF`   | Chevron icons, em-dashes, placeholder glyphs                 |
| `accent-primary` | `#EA580C`   | Selected radios, active tiles, focus rings, review flags     |
| `accent-subtle`  | `#FFF7ED`   | Selected-option wash (use at `/60` opacity or lighter)       |

Button fills: primary action = `#18181B` bg + white text; neutral = white bg +
`#E5E7EB` border + `#18181B` text. Radius `10px`, height `40px` (`h-10 px-5/6`).

## 3. Typography

Font stack: system default (Geist where loaded). Markdown slots use
`prose prose-zinc` (never `prose-orange`), see §6.

| Element              | Style                                                        |
| -------------------- | ------------------------------------------------------------ |
| View / module title  | `18px` semibold `text-primary`                               |
| Pane label           | `13px` medium `text-secondary` ("Select the right option")   |
| Passage instruction  | `13px` italic `text-secondary`                               |
| Passage / question   | `15px` normal, `leading-[1.65]`, `text-primary`              |
| Option text          | `14px` (`prose-sm`), `leading-[1.5]`, tight `prose-p:my-0`   |
| Metadata / hints     | `13px` medium `text-secondary`                               |

## 4. Practice session shell

`src/components/dashboard/PracticeSession.tsx`. Flat view, **no outer card**:
no `rounded-2xl`, no border, no background fill — it sits directly on the page.
Header/footer hairlines (`border-gray-100`) provide the structure.

- **Header** `h-16 px-4 sm:px-8 border-b`: title block only (18px title +
  13px `Folder: {x} • {a}/{n} answered`). No exit button — the dashboard
  shell's back navigation ("Back to Folders") is the single exit path.
- **Timer pill**: `bg-[#F3F4F6] rounded-full pl-4 pr-2 py-1.5`, mono tabular
  numerals + eye toggle (`Eye`/`EyeOff`) that masks the time as `••:••`.
- **Workspace**: `flex-1 min-h-0 overflow-hidden`; the question component
  scrolls internally (`overflow-y-auto custom-scrollbar`).
- **Bottom dock** `min-h-16 border-t flex justify-between flex-wrap`:
  left = Help circle (decorative) + `Rate:` + difficulty pills;
  center = navigator pill; right = `Back` (neutral) / `Next|Finish` (dark).

### Navigator pill + rating pills

- Pill: `bg-[#F4F4F5] rounded-full px-4 py-2 text-[13px] font-medium`,
  `Question {i} of {n}` + rotating `ChevronDown`. Dropdown: absolute panel
  above the dock, `border-[#E5E7EB] rounded-xl`, legend
  (dark dot = answered, hollow = todo), `grid-cols-7` buttons —
  current `bg-[#18181B] text-white`, answered `bg-[#F4F4F5]`, todo white.
  Closes on select, outside click, or Escape.
- Rating pills (practice): `text-xs px-2.5 py-1.5 rounded-lg border` with
  `Smile/Meh/Frown` icons; inactive white/hairline/muted, active dark fill.
  Disabled at `timeRemaining <= 0`. Rating sync failures log only.

## 5. Question components

All live in `src/components/question-types/`. Shared shell pattern:

```tsx
<div className="flex flex-col h-full min-h-0">
  <div className="flex-none px-6 sm:px-8 pt-6 sm:pt-8 pb-4">
    <p className="text-[13px] font-medium text-[#71717A]">{label}</p>
  </div>
  {/* panes: flex-col lg:flex-row + lg:divide-x lg:divide-[#E5E7EB] */}
</div>
```

### ModuleMCQ (`ModuleMCQ.tsx`)

Split pane: passage left, questions right, hairline divider on desktop.
Passage header is plain 18px title + collapse pill on mobile only.

- **Accordion is required** (compactness in test mode): header row = number
  badge + `Question {n}` + optional answered pill + chevron. Badge states:
  answered `bg-[#18181B] text-white`; open `bg-[#FFF7ED] text-[#EA580C]
  border-orange-200`; default `bg-[#F4F4F5] text-secondary`. Body (`pt-3`)
  renders only when open. First question opens by default; parents remount
  per passage via `key={passage.id}`. Do not remove the accordion.
- **Options** (radio-inside-card, single element, `role="radio"` +
  keyboard Enter/Space):
  `flex items-center gap-3 rounded-[10px] border px-[18px] py-[14px]
  min-h-[48px] text-[14px]` — unselected white/hairline with hover,
  selected `border-[#EA580C]/40 bg-[#FFF7ED]/60`. Inside: 18px radio circle
  (8px accent dot when selected), semibold letter, faint em-dash, text.
- Empty passage body renders a muted placeholder line, never a blank pane.

### LatinSquare (`LatinSquare.tsx`)

Left puzzle pane + fixed `lg:w-[300px]` options pane. Puzzle uses the shared
`CanvasImage` viewer in a fixed slot (`h-[320px] sm:h-[400px] lg:h-[440px]`).
Letter tiles: `h-12 md:h-14 rounded-[10px] border text-xl font-semibold`,
`grid-cols-5 lg:grid-cols-2`; selected = accent border tint + wash + orange
letter (never solid-orange fill, scale, or ring). A–E fallback when content
has no options.

### MathEquation (`MathEquation.tsx`) + VirtualKeyboard (`VirtualKeyboard.tsx`)

Three panes: equations (display rows `bg-[#F4F4F5] rounded-[10px]`, dark mono)
| answers | keypad (`lg:w-[280px]`). Variable rows use the option-card language;
active = accent tint + orange variable + `#EA580C` caret, answered reads from
the entered value (empty shows a muted dash — no green fills). Keypad keys:
`h-12 rounded-[10px]` bordered white, flat hover/active; Delete is neutral
monochrome with icon. Entry logic (2-digit limit, Backspace, Tab cycling,
physical keyboard) must not change.

### FigureSequence (`FigureSequence.tsx`)

Fidelity exception: the thick **black** matrix borders, Image 1/2 header
boxes, and arrows are authentic TestAS format — keep them exactly. De-slop
only the chrome: no outer card, muted 13px label, selection = accent border
at the same `border-[3px]` width (no layout shift) + flat check dot, no
`ring-4`/scale/shadows. Keep the unified 3-column grid and bare `<img>`
tiles (no zoom viewer — pixel alignment matters).

## 6. Content rendering rules (load-bearing)

1. **Always wrap `RichMarkdown` in `prose prose-zinc`** (passages/questions:
   `text-[15px]`, headings semibold primary, `prose-p:leading-[1.65]`;
   options: `prose-sm prose-p:my-0`). Without `prose`, output looks like
   flat unstyled text.
2. **Images via `CanvasImage`** (zoom/pan + controls) except figure-sequence
   tiles. **Fixed-height slots only** (`h-[320px] sm:h-[380px]` passage,
   `h-[280px] sm:h-[320px]` question) — never `flex-1` + `overflow-hidden`
   wrappers, which clip the canvas controls.
3. **Strict TypeScript, no `any`.** Use `unknown` + `isRecord` guards and
   explicit interfaces (`ModuleMCQ.tsx` is the reference example).
4. **Renderer contract** (`src/lib/exam/renderer.tsx`): `toModulePassage`
   must forward `resolved_image_url` for passages, child questions, and the
   single-question fallback — dropping it silently empties images.

## 7. Exam view (timed, `/exam`) — what differs

`src/components/exam/ExamTopBar.tsx` + `ExamBottomBar.tsx`. The exam view is
intentionally not identical to practice:

- Header keeps timer + section title + **number-chain** `QuestionPagination`
  **left-aligned** (`justify-start`). No font-size toggle (removed; the store
  field is dormant, nothing reads it).
- Rating pills copy the practice shape but keep difficulty colors
  (emerald/amber/rose active fills) and icons, with a `Rate to proceed:`
  hint. Navigation gates on the **local** rating; server sync runs in the
  background with a retry banner — never block nav on sync.

## 8. Do / Don't

Do: hairlines over boxes · one accent · flat selections with tint washes ·
`prose-zinc` markdown · fixed image slots · `type="button"` + `aria-pressed`
+ `focus-visible:ring-[#EA580C]/40` on all option controls · `custom-scrollbar`
on scroll panes.

Don't: add outer/bordered cards around panes or views · solid-orange selected
fills · rings, glows, scale-on-select, or colored shadows · green/red status
fills (except rating colors + figure-sequence black) · `any` types · new
header exit buttons (dashboard owns back nav) · touch answer/rating/timer
logic during a visual pass (`tsc --noEmit` + `eslint` must stay clean).
