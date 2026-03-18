# UI Color Pass: Cool Neutral + Muted Blue

## Context

The current color palette uses warm brown/amber oklch tones across both light and dark modes. In dark mode this produces muddy backgrounds, sepia-tinted panels, and a tan/gold accent that looks dated. The radial gradient background overlay compounds the issue. Users perceive the UI as unprofessional for a legal reference tool.

**Goal:** Shift the entire color system to cool neutral grays with a muted blue accent, making the UI feel minimal, clean, and professional. Both light and dark modes are updated for consistency.

## Design Decisions

- **Dark mode direction:** Soft Graphite — slightly softened dark grays with a subtle blue undertone (#16181d range). Not pure black. Think Notion dark / Tailwind docs.
- **Light mode direction:** Cool Gray — subtle off-white background (#f8f9fb range) with white panels. Softer than pure white, better for long reading sessions.
- **Accent color:** Muted blue replacing tan/gold. Professional, high contrast on both light and dark backgrounds.
- **Surface treatment:** Flat backgrounds replacing the current radial gradient overlay. Flat primary buttons replacing gradient buttons.

## Color Token Changes

### Light Mode (`:root`)

| Token | Old (oklch) | New (oklch) | Intent |
|-------|-------------|-------------|--------|
| `--color-bg` | `0.975 0.015 85` | `0.97 0.005 260` | Cool gray page background |
| `--color-panel` | `0.99 0.012 85` | `0.995 0.002 260` | Near-white panel surfaces |
| `--color-panel-strong` | `0.94 0.02 80` | `0.94 0.006 260` | Elevated panel surfaces |
| `--color-paper-edge` | `0.9 0.03 80` | `0.9 0.008 260` | Subtle depth edge |
| `--color-text` | `0.28 0.03 55` | `0.15 0.01 260` | Primary text |
| `--color-muted` | `0.52 0.025 55` | `0.46 0.015 260` | Secondary text |
| `--color-border` | `0.83 0.02 75` | `0.88 0.008 260` | Panel borders |
| `--color-accent` | `0.56 0.11 48` | `0.55 0.15 260` | Primary accent (buttons, links) |
| `--color-accent-strong` | `0.48 0.13 39` | `0.45 0.18 260` | Hover/strong accent |
| `--color-accent-soft` | `0.9 0.04 50` | `0.94 0.03 260` | Tinted backgrounds (chips, hints) |

### Dark Mode (`:root[data-theme="dark"]`)

| Token | Old (oklch) | New (oklch) | Intent |
|-------|-------------|-------------|--------|
| `--color-bg` | `0.19 0.018 60` | `0.16 0.01 260` | Dark graphite page background |
| `--color-panel` | `0.235 0.018 58` | `0.2 0.012 260` | Panel surfaces |
| `--color-panel-strong` | `0.275 0.022 58` | `0.24 0.012 260` | Elevated surfaces |
| `--color-paper-edge` | `0.36 0.02 62` | `0.32 0.01 260` | Subtle depth edge |
| `--color-text` | `0.93 0.014 82` | `0.93 0.006 260` | Primary text |
| `--color-muted` | `0.76 0.02 78` | `0.65 0.015 260` | Secondary text |
| `--color-border` | `0.39 0.018 62` | `0.3 0.012 260` | Panel borders |
| `--color-accent` | `0.72 0.12 70` | `0.68 0.12 260` | Primary accent |
| `--color-accent-strong` | `0.81 0.08 78` | `0.78 0.1 260` | Hover/strong accent |
| `--color-accent-soft` | `0.32 0.05 62` | `0.25 0.04 260` | Tinted backgrounds |

### Shadow

| Mode | Old | New |
|------|-----|-----|
| Light | `color-mix(in oklab, var(--color-text) 10%, transparent)` | `color-mix(in oklab, var(--color-text) 6%, transparent)` |
| Dark | `color-mix(in oklab, black 42%, transparent)` | `color-mix(in oklab, black 35%, transparent)` |

## Surface Treatment Changes

### Background

Replace the `html` radial gradient + linear gradient with a flat color:

```css
/* Before */
html {
  background: radial-gradient(...accent-soft...), linear-gradient(...bg...panel...);
}

/* After */
html {
  background: var(--color-bg);
}
```

### color-mix with white

Throughout `globals.css`, many declarations use `color-mix(in oklab, <token> <pct>%, white)`. With the cool palette, these should use `transparent` instead of `white` to avoid washing out the neutral tones. Rules using `linear-gradient` with `color-mix(...white)` keep their gradients but switch to `transparent`. Affected rules:

- `.site-header` background
- Shared panel rule (`.hero-panel`, `.instrument-card`, `.reader-surface`, `.margin-rail`, `.toc-rail`, `.empty-state`, etc.) background and border
- `.theme-toggle` and children (including `.theme-toggle__track`, `.theme-toggle__thumb`)
- `.hero-panel__meta div` background and border (keeps `linear-gradient`, uses `transparent`)
- `.search-form__query input` and `.search-form__filters select` borders
- `.button--secondary` border and background
- `.chip` background
- `.status-pill` background
- `.segment-term-list .term-disclosure` background
- `.reader-surface` gap-background
- `.reader-segment--scope` background
- `.reader-segment--annotation` etc. backgrounds
- `.reader-table-wrap` border and background
- `.reader-table thead th` background
- `.reader-table th, .reader-table td` border-top
- `.reader-table tbody tr:nth-child(even)` background
- `.reader-block--note` border-left
- `.margin-rail__heading` background and border (keeps `linear-gradient`, uses `transparent`)
- `.margin-rail__section` (no change needed — uses tokens directly)
- `.stack-list li` border
- `.toc-list__item a:hover` background
- `.onboarding-hint` background and border
- `.onboarding-hint__dismiss` hover background
- `.feature-card` border

### Primary Button

Replace gradient with flat:

```css
/* Before */
.button--primary {
  background: linear-gradient(120deg, var(--color-accent) 0%, var(--color-accent-strong) 100%);
}

/* After */
.button--primary {
  background: var(--color-accent);
}
```

## Scope

### Changes

- `app/globals.css` — all color token values, html background, color-mix expressions, button gradient

### No Changes

- Layout, spacing, typography, border radii, responsive breakpoints
- Font choices (Newsreader + Public Sans)
- Component architecture — no new or modified components
- Animations and transitions
- Theme toggle mechanism
- Onboarding components and content

## Verification

1. `npm run build` — passes cleanly
2. Landing page — cool gray background in light mode, soft graphite in dark mode; blue accent on buttons and chips
3. Reader page — panels, TOC, margin rail all use neutral tones; no warm brown remnants
4. Search page — chips, filters, empty state all themed consistently
5. Toggle between light/dark — both feel like the same product
6. Check onboarding hints — blue-tinted accent-soft background instead of warm
7. Mobile breakpoint — verify no issues at 760px and 1100px
