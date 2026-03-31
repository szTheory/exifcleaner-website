# ExifCleaner Brand Guidelines

## Brand Positioning

ExifCleaner is a **precision tool** -- confident, crafted, communicating quality and open-source credibility. Not a privacy guardian (too heavy), not a generic utility (too bland). Think: the kind of tool a professional would trust and recommend.

**Reference category:** Premium macOS utility apps (Transmit, CleanShot, IINA, Numi, ImageOptim).

## Headline

**Metadata, removed.**

Two words, a comma, a period. Total confidence.

## Typography

| Role | Font | Size | Weight | Line Height | Letter Spacing |
|------|------|------|--------|-------------|----------------|
| Display | Inter | 56px (desktop) / 40px (mobile) | 700 Bold | 1.1 | -0.02em |
| Heading | Inter | 24px | 600 Semibold | 1.3 | -0.01em |
| Body | Inter | 18px | 400 Regular | 1.6 | 0 |
| Label | Inter | 14px | 500 Medium | 1.4 | 0 |

- **Website:** Inter (self-hosted variable WOFF2)
- **App:** system-ui (platform native)
- **Fallback stack:** Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif

## Color Palette

### Primary Accent: Teal

| Token | Hex | Usage |
|-------|-----|-------|
| Accent | #0D9488 | CTA buttons, links, step indicators, icon highlights |
| Accent hover | #0F766E | Hover/active states |
| Accent light | #CCFBF1 | Badge backgrounds, subtle highlights |

### Neutrals

| Token | Hex | Usage |
|-------|-----|-------|
| Text primary | #0F172A | Headings, body text |
| Text secondary | #64748B | Subheadings, descriptions |
| Text tertiary | #94A3B8 | Captions, footer text |
| Background primary | #FFFFFF | Page background |
| Background secondary | #F8FAFB | Alternating section backgrounds |
| Border | #E2E8F0 | Dividers, card borders |
| CTA dark | #0F172A | Final CTA section background |

### Usage Rules

- Accent color used sparingly: CTA buttons, text links, step numbers, icon accents, occasional highlights
- No brand-colored backgrounds (accent is never a section background)
- 60/30/10 rule: 60% white, 30% secondary gray, 10% teal accent

## Voice

### Attributes

- **Confident:** States what it does, doesn't over-explain
- **Direct:** Short sentences, no filler, respects reader's time
- **Quietly technical:** Knows the domain, doesn't show off

### Copy Patterns

| Context | Pattern | Example |
|---------|---------|---------|
| Hero | Declarative, brief | "Metadata, removed." |
| Features | Benefit-first | "See exactly what was stripped." |
| Privacy | Matter-of-fact | "No network access. No telemetry. Verify it yourself." |
| Open source | Proud, not begging | "Open source -- verify our privacy claims yourself." |

### What We Avoid

- "FREE" in caps (reads desperate)
- Fear-based privacy messaging ("protect yourself from hackers")
- Overexplaining what metadata is
- Self-deprecating open-source tone ("just a hobby project")
- "Star us on GitHub" or any star-begging language
- Exclamation points in headlines

## Imagery

### Screenshots

- Real product screenshots, automated via Playwright (reproducible, not manually captured)
- All screenshots wrapped in minimal macOS window chrome (title bar with traffic light dots)
- App states to capture: light mode processed, dark mode processed, settings open, metadata diff, language switching

### Decorative Graphics

- Subtle geometric shapes and gradient elements between sections
- No stock photography, no lifestyle imagery, no placeholder avatars
- Abstract decorations complement the product screenshots without competing for attention

### Cross-Platform

- macOS, Windows, and Linux screenshots displayed together
- Fanned/overlapping layout with macOS in front (largest)
- Demonstrates availability without requiring a carousel

## Spacing

Multiples of 4px. Generous whitespace between sections signals premium quality.

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Inline gaps |
| sm | 8px | Tight spacing |
| md | 16px | Default spacing |
| lg | 24px | Card padding |
| xl | 32px | Between grouped elements |
| 2xl | 64px | Section padding (mobile) |
| 3xl | 96px | Section padding (desktop) |
| 4xl | 128px | Hero padding (desktop) |

Max content width: 1120px.
