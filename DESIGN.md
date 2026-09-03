# Design System Inspired by Dream Motion

> Auto-extracted from `https://dreammotion.framer.website/` on 2026-09-03

## 1. Visual Theme & Atmosphere

Refined dark mode with muted tones — cinematic and premium.

The hero section leads with "DreamMotion turns prompts into cinematic visuals".

**Key Characteristics:**

- Instrument Serif as the heading font (custom web font loaded via @font-face)
- sans-serif as the body font for all running text
- Heading weight 400, letter-spacing -0.58px
- Dark background (#0a0a0a) as the primary canvas
- Primary accent `#00ffff` used for CTAs and brand highlights
- 6 shadow level(s) detected — tinted shadows
- Rounded corners (24px+) creating a friendly, approachable feel
- Tags: dark, rounded, accented, serif

## 2. Color Palette & Roles

### Primary

- **Primary Accent** (`#00ffff`) · `--color-primary`: Brand color, CTA backgrounds, link text, interactive highlights.
- **Background** (`#0a0a0a`) · `--color-bg`: Page background, primary canvas.
- **Background Secondary** (`#000000`) · `--color-bg-secondary`: Cards, surfaces, alternating sections.

### Text

- **Text Primary** (`#000000`) · `--color-text`: Headings and body text.
- **Text Secondary** (`#999999`) · `--color-text-secondary`: Muted text, captions, placeholders.

### Borders & Surfaces

- **Border** (`#121212`) · `--color-border`: Dividers, outlines, input borders.

### Full Extracted Palette

| # | Hex | CSS Variable | Role | Area | Contrast |
| --- | --- | --- | --- | --- | --- |
| 1 | `#121212` | `--palette-1` | section | large | text-light |
| 2 | `#000000` | `--palette-2` | block | large | text-light |
| 3 | `#0a0a0a` | `--palette-3` | block | large | text-light |
| 4 | `#ffffff` | `--palette-4` | button | large | text-dark |
| 5 | `#0000ee` | `--palette-5` | text-accent | small | text-light |
| 6 | `#00ffff` | `--palette-6` | badge | small | text-dark |

## 3. Typography Rules

- **Heading Font:** `Instrument Serif` (web font)
- **Body Font:** `sans-serif`, sans-serif

### Type Hierarchy

| Role | Font | Size | Weight | Line Height | Letter Spacing |
| --- | --- | --- | --- | --- | --- |
| H1 | Instrument Serif | 58px | 400 | 58px | -0.58px |
| H2 | Instrument Serif | 22px | 400 | 24.2px | 0.22px |
| Body | Satoshi | 16px | 400 | 19.2px | normal |

### Type Scale

| Token | Size | Suggested Usage |
| --- | --- | --- |
| Display | `58px` | headings |
| H1 | `42px` | headings |
| H2 | `24px` | headings |
| H3 | `22.5px` | headings |
| H4 | `22px` | headings |
| Body L | `20px` | body / supporting text |
| Body | `18px` | body / supporting text |
| Small | `16px` | body / supporting text |
| XS | `15px` | body / supporting text |
| Caption | `14px` | body / supporting text |

## 4. Component Stylings

### Primary Button

```css
.btn-primary {
  background: #ffffff;
  color: #000000;
  border-radius: 40px;
  padding: 0px 0px;
  font-size: 12px;
  font-weight: 400;
  border: none;
  cursor: pointer;
}
```

### Card

```css
.card {
  background: #000000;
  border-radius: 40px;
  padding: 96px;
}
```

## 5. Layout Principles

- **Base spacing unit:** `24px` — use multiples (48px, 72px, 96px, etc.)

### Spacing Scale (extracted from real elements)

| Token | Value | Role |
| --- | --- | --- |
| spacing-1 | `24px` | card |
| spacing-2 | `8px` | element |
| spacing-3 | `16px` | element |
| spacing-4 | `96px` | section |
| spacing-5 | `10px` | element |
| spacing-6 | `28px` | card |
| spacing-7 | `12px` | element |
| spacing-8 | `48px` | card |

### Border Radius Scale

| Token | Value | Element |
| --- | --- | --- |
| radius-card | `24px` | card |
| radius-card | `40px` | card |
| radius-card | `20px` | card |
| radius-card | `30px` | card |
| radius-card | `99px` | card |
| radius-button | `8px` | button |

## 6. Depth & Elevation

| Level | Shadow | Usage |
| --- | --- | --- |
| Deep | `rgba(255, 255, 255, 0) 0px 0px 46px 0px inset` | Hero sections, deep layers |
| Low | `rgba(255, 255, 255, 0.2) 0px 0px 0px 0px` | Cards, subtle elevation |
| Low | `rgba(0, 0, 0, 0.24) 0px 4.13px 24px 0px` | Cards, subtle elevation |
| Low | `rgba(0, 0, 0, 0.15) 0px 2px 2px 0px` | Cards, subtle elevation |
| Low | `rgb(0, 0, 0) 0px 0px 0px 1px inset` | Cards, subtle elevation |

## 7. Do's and Don'ts

### Do

- Use `#0a0a0a` as the primary background color
- Use `Instrument Serif` for all headings and `sans-serif` for body text
- Use `#00ffff` as the single dominant accent/CTA color
- Maintain `24px` as the base spacing unit — all gaps should be multiples
- Keep the overall feel dark — use dark surfaces throughout
- Use rounded corners (`24px`+) consistently for all interactive elements
- Use serif fonts for headlines to maintain editorial authority
- Apply the shadow system for elevation — use the extracted shadow values
- Use weight 400 for headings to match the brand's typographic voice

### Don't

- Don't use colors outside the extracted palette without justification
- Don't substitute Instrument Serif/sans-serif with generic alternatives
- Don't use irregular spacing — stick to 24px grid
- Don't introduce bright white surfaces — they break the dark palette
- Don't use sharp corners — they feel hostile in this rounded design language
- Don't mix in geometric sans-serif headlines — it breaks the editorial tone
- Don't use pure black (#000000) for text — use `#000000` instead
- Don't add decorative elements not present in the original design — no badges, ribbons, banners, or ornaments unless the source site uses them
- Don't invent UI patterns the source site doesn't have — if the original has no NEW badge, don't add one just because a red is in the palette

## 8. Responsive Behavior

| Breakpoint | Width | Notes |
| --- | --- | --- |
| Mobile | < 640px | Single column, stack sections, reduce font sizes ~80% |
| Tablet | 640–1024px | 2-column where appropriate, maintain spacing ratios |
| Desktop | 1024–1440px | Full layout as designed |
| Wide | > 1440px | Max-width container, center content |

- Touch targets: minimum 44×44px on mobile
- Maintain 24px base unit across breakpoints — only scale multipliers

## 9. Agent Prompt Guide

### Quick Color Reference

```
Background:  #0a0a0a
Text:        #000000
Accent:      #00ffff
Border:      #121212
```

### Example Prompts

1. "Build a hero section with a `#0a0a0a` background, `Instrument Serif` heading in `#000000`, and a `#00ffff` CTA button with 40px radius."
2. "Create a pricing card using background `#000000`, border `#121212`, `sans-serif` for text, and 72px padding."
3. "Design a navigation bar — `#0a0a0a` background, `#000000` links, `#00ffff` for active state."
4. "Build a feature grid with 3 columns, 72px gap, each card using the card component style."
5. "Create a footer with `#000000` background, `#000000` text, and 48px padding."

### Iteration Guide

1. Start with layout structure (sections, grid, spacing)
2. Apply colors from the palette — background first, then text, then accents
3. Set typography — font families, sizes from the type scale, weights
4. Add components — buttons, cards, inputs using the specs above
5. Apply border-radius consistently across all elements
6. Add shadows for depth — use the extracted shadow values, not defaults
7. Check responsive behavior — test mobile and tablet layouts
8. Final pass — verify all colors match, spacing is consistent, fonts are correct
