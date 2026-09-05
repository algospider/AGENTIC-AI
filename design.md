# Design System — Portfolio Health Advisor (web)

A clean, brand-neutral SaaS interface: **white canvas → strong typography →
near-black actions → soft-gray cards → dark closing footer.** Engineered,
mature, trustworthy — never decorative, never obviously AI-generated.

Product identity comes from the real interface, real numbers, and one
restrained blue — not from decoration.

## 1. Themes

- **Light (default canvas):** white page, ink text, near-black `#111` primary
  buttons, hairline `#e5e7eb` borders, soft-gray cards.
- **Dark (quiet ledger):** `#101010` page, `#1a1a1a` panels, white primary
  buttons. Same geometry, same restraint.
- Toggle in the header, remembered in `localStorage`, applied before paint
  (no flash). Footer stays dark in both themes — it is the visual endpoint.

## 2. Tokens (implement as CSS vars — never hardcode)

| Token | Light | Dark | Use |
|---|---|---|---|
| `bg` | `#ffffff` | `#101010` | Page canvas |
| `panel` | `#ffffff` | `#1a1a1a` | Cards (white card + hairline border) |
| `well` | `#f8f9fa` | `#222222` | Table rows, wells, hovers |
| `field` | `#ffffff` | `#1a1a1a` | Inputs, selects |
| `track` | `#e5e7eb` | `#2a2a2a` | Chips, gauge tracks, skeletons |
| `edge` | `#e5e7eb` | `#2e2e2e` | Borders, dividers |
| `text` | `#111111` | `#f5f5f5` | Primary text |
| `muted` | `#374151` | `#a1a1aa` | Secondary text |
| `faint` | `#6b7280` | `#737373` | Placeholders, disabled |
| `accent` (action) | `#111111` / white text | `#ededed` / `#111` text | Primary buttons, active tab |
| `signal` (blue) | `#2563eb` | `#60a5fa` | Links, focus, active indicators — sparingly |
| `up` | `#059669` | `#10b981` | Gains, success |
| `warn` | `#b45309` | `#f59e0b` | Warnings |
| `down` | `#dc2626` | `#ef4444` | Losses, critical |
| `vio` | `#7c3aed` | `#8b5cf6` | Secondary accents |
| `mid` | `#71770f` | `#a8a029` | In-between bands |

Near-black actions — never blue gradient buttons. One obvious primary action
per section. Blue appears only for links, chart lead, active indicators.

## 3. Typography

Inter-grade geometric sans throughout (Geist). Display: weight 600, tight
tracking (−0.5 to −2px by size), large sizes, short lines. Never compensate
with 700/800 weights — go larger + tighter + more whitespace instead.
Hero figures (stat values, health score) set in a warm serif for a printed,
human feel. Tickers/hashes/file names in mono. Tabular numerals for money.

Voice: plain, second person, warm but never jokey about money.
"Trim SEMI by ~4 shares" beats "Consider optimizing your position."

## 4. Shape, elevation, rhythm

- Radius: 8px buttons/inputs · 12px cards · 16px hero/product containers · pills for badges, filters, avatars.
- Elevation order: flat → hairline border → surface contrast → subtle shadow
  (`0 1px 2px rgba(0,0,0,.05)`). No glow, glass, or floating cards.
- Max width 1200px (7xl), sections breathe. Page rhythm: white → light gray →
  white → product → light gray → white → **dark footer**.
- Motion: 150–250ms ease-out, hover shifts background only, no scaling or
  parallax. Skeletons shimmer while loading; toasts slide up, auto-dismiss.
  `prefers-reduced-motion` disables all of it.

## 5. Components (this product's kit)

- **Card**: white/ink panel, hairline border, 12px radius, `p-5`; title = small
  accent dot + uppercase gray label. One accent per card.
- **Stat**: tiny uppercase label, big serif tabular figure, one-line gray subtext.
- **Table**: uppercase 12px gray header, 60%-opacity row dividers, hover tint,
  right-aligned tabular numerals, signed colored P&L (never color alone).
- **Health gauge**: bar + `score/100` + grade chip, bands 80/65/50.
- **Alerts**: severity chip + one plain sentence, critical first.
- **Agent timeline**: rail with check dots, name + summary + ms, pipeline total.
- **Chat**: user right (soft bubble), advisor left (bordered panel), suggestion
  chips, `…` typing state — never a frozen screen.
- **Modal**: scrim + 12px panel, title + ✕, validated form, inline errors, Cancel + one primary action.
- **Icons**: one hand-drawn 24px/2px-stroke SVG family (`components/icons.tsx`).
  Never emoji, never text glyphs (◆ ▶ ✓ ☀) as iconography — bullets and
  ellipsis in prose are fine.
- **Footer**: pinned to the viewport bottom on short views (`flex-1` main),
  always dark, colophon + disclaimer.
- **Live badge**: pulsing dot + "LIVE · N prices · time", one-click revert.
- **Empty states**: one calm sentence + the exact next action.
- **Footer**: always `#101010` / `#a1a1aa`, 4→2→1 columns, colophon + disclaimer.

## 6. Data-viz rules

Blue-led categoricals, semantic green/red for gain/loss, axes in faint gray,
dark rounded tooltips. Every chart keeps a text twin (table/caption) — nothing
lives only in pixels.

## 7. Anti-AI-generated rules (non-negotiable)

No gradient blobs, no purple-blue washes, no glassmorphism, no glowing or
floating cards, no repetitive icon-grids, no abstract illustrations, no emoji,
no "revolutionize" copy, no fake testimonials, no centered-everything.
Instead: real data, real interface states, asymmetry where useful, editorial
whitespace, typography over decoration. **Clarity over decoration. Product
over illustration. Typography over gradients. Whitespace over clutter.
Consistency over novelty.**
