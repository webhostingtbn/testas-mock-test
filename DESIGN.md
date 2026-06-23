---
name: TestAS Prep Platform
description: Visual design specification for the TestAS exam preparation dashboard and testing interface
colors:
  primary: "#ea580c"
  secondary: "#f97316"
  accent: "#f59e0b"
  neutral-bg: "#fff7ed"
  neutral-ink: "#0f172a"
  border: "#ffedd5"
typography:
  display:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "clamp(1.5rem, 4vw, 2rem)"
    fontWeight: 700
    lineHeight: 1.2
  body:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  card:
    backgroundColor: "rgba(255, 255, 255, 0.8)"
    textColor: "{colors.neutral-ink}"
    rounded: "{rounded.lg}"
    padding: "16px"
---

# Design System: TestAS Prep Platform

## 1. Overview

**Creative North Star: "The Editorial Sanctuary"**

This visual system is designed to transform the high-stress experience of TestAS exam preparation into a clean, focused, and structured environment. The layout mirrors a premium academic publication or professional testing client. The interface uses generous white space, clear semantic hierarchies, and a restrained palette to maintain structured clarity.

We reject SaaS dashboard clichés, generic gray layouts, and heavy cartoonish elements. Spacing is rhythmic and strict to ensure absolute legibility, particularly under timed pressure.

**Key Characteristics:**
- Restrained brand colors utilizing warm-tinted orange/amber accents.
- Soft borders paired with high-contrast, clean typography.
- Glassmorphism confined strictly to elevated floating shells (sidebar/header/cards) with solid page backdrops.

## 2. Colors

The palette is warm-toned and editorial, grounding the interface in a scholarly environment.

### Primary
- **Scholarly Orange** (#ea580c / oklch(60.8% 0.22 35.8)): Used for primary actions, success steps, and branding landmarks.

### Secondary
- **Vibrant Amber** (#f97316 / oklch(64.7% 0.22 38.3)): Used for intermediate interactive accents, progress bars, and hover highlights.

### Accent
- **Warm Yellow** (#f59e0b / oklch(76.2% 0.17 76)): Accent highlighting, warning states, and pending status indications.

### Neutral
- **Slate Ink** (#0f172a / oklch(14.5% 0 0)): Primary typography and structural shadows.
- **Orange Linen** (#fff7ed / oklch(97.8% 0.01 70)): Screen base background.
- **Orange Border** (#ffedd5 / oklch(94.2% 0.02 70)): Subtle boundaries on containers.

### Named Rules
**The 10% Accent Rule.** The primary orange accent must occupy no more than 10% of any given screen area. It should draw focus to landmarks, not act as decorative noise.

## 3. Typography

**Display Font:** Geist, system-ui, sans-serif
**Body Font:** Geist, system-ui, sans-serif

The font stack provides crisp, geometric legibility for quantitative questions, mathematical equations, and long-form readings.

### Hierarchy
- **Display** (Bold (700), clamp(1.5rem, 4vw, 2rem), 1.2): Section highlights and welcoming banners.
- **Headline** (Bold (700), 1.25rem (20px), 1.3): Major container headings.
- **Title** (Bold (700), 1rem (16px), 1.4): Card and list component titles.
- **Body** (Regular (400), 0.875rem (14px), 1.5): Reading passages, question texts, and general labels. Cap prose width at 75ch.
- **Label** (Semi-Bold (600), 0.75rem (12px), normal): Technical tags, badges, and metadata headers.

## 4. Elevation

The system is flat-by-default, utilizing layered glass surfaces (`backdrop-blur-sm` and `bg-white/80`) to establish a clear hierarchy against the radial background gradient.

### Shadow Vocabulary
- **Ambient Low** (`box-shadow: 0 4px 6px -1px rgba(234, 88, 12, 0.05), 0 2px 4px -2px rgba(234, 88, 12, 0.05)`): Standard card rests.
- **Interactive Elevated** (`box-shadow: 0 10px 15px -3px rgba(234, 88, 12, 0.1), 0 4px 6px -4px rgba(234, 88, 12, 0.1)`): Buttons and active cards on hover.

### Named Rules
**The Slate Shadows Proximity.** Do not pair stark black shadows with orange borders. Use amber/orange-tinted shadows to match the warm paper backdrop.

## 5. Components

### Buttons
- **Shape:** Soft square (12px border radius).
- **Primary:** Scholarly Orange background, white text. Transitions smoothly to hover orange-500.
- **Secondary:** White background with orange-200 border, dark slate text. Transitions to orange-50 bg on hover.

### Cards / Containers
- **Corner Style:** Rounded (16px border radius).
- **Background:** White with 80% opacity, backdropped with a light blur (`backdrop-blur-sm`).
- **Border:** Subtle orange-100/60 border.

### Inputs / Fields
- **Style:** Clean solid white background, orange-200 border, 12px corner radius.
- **Focus:** 2px ring in orange-500 with matching border expansion.

### Navigation
- **Sidebar & Header:** Blurred white glass pane (`bg-white/80 backdrop-blur-xl`), slate-500 text, orange gradient indicator backgrounds for active views.

## 6. Do's and Don'ts

### Do:
- **Do** maintain a strict 75ch line length limit on interpretive readings to ensure readable tracking.
- **Do** use OKLCH color definitions in CSS styling for precise color saturation control.
- **Do** keep cards at a uniform 16px corner radius (`rounded-2xl`) and buttons/inputs at 12px (`rounded-xl`).

### Don't:
- **Don't** use generic stark gray card outlines. Always use tinted borders (`border-orange-100`).
- **Don't** use nested cards. Use dividers or visual grouping blocks instead.
- **Don't** use diagonal stripes or heavy grid outlines as decorative backdrops. Keep background gradients smooth and ambient.
