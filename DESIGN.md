---
name: FirstSignal
description: Evidence-first venture sourcing & diligence engine — an editorial dark terminal for the $100K decision.
colors:
  accent: "#8fb7ea"
  accent-weak: "#16284a"
  on-accent: "#0a1120"
  fg: "#edf0f6"
  muted: "#a6b1c7"
  faint: "#8592ab"
  bg: "#0a1120"
  bg2: "#101a2f"
  panel: "#131e35"
  line: "#223050"
  good: "#72d1a6"
  good-bg: "#112a20"
  mid: "#e4b866"
  mid-bg: "#2e2514"
  bad: "#f28f86"
  bad-bg: "#351b1c"
  light-accent: "#1d4d8f"
  light-accent-weak: "#e8f0fb"
  light-fg: "#101a2e"
  light-muted: "#56617a"
  light-faint: "#5e6982"
  light-bg: "#f7f8fb"
  light-bg2: "#eef1f6"
  light-panel: "#ffffff"
  light-line: "#e1e6ee"
  light-good: "#127040"
  light-good-bg: "#e6f4ec"
  light-mid: "#8a5108"
  light-mid-bg: "#fbf0dc"
  light-bad: "#b42318"
  light-bad-bg: "#fbeae8"
typography:
  hero:
    fontFamily: "Fraunces, Iowan Old Style, Palatino Linotype, Georgia, serif"
    fontSize: "clamp(2.8rem, 6.4vw, 5.5rem)"
    fontWeight: 300
    lineHeight: 0.98
    letterSpacing: "-0.025em"
    fontVariation: "'opsz' 144"
  verdict:
    fontFamily: "Fraunces, Iowan Old Style, Palatino Linotype, Georgia, serif"
    fontSize: "46px"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "-0.02em"
    fontVariation: "'opsz' 144"
  page-title:
    fontFamily: "Fraunces, Iowan Old Style, Palatino Linotype, Georgia, serif"
    fontSize: "40px"
    fontWeight: 400
    lineHeight: 1.02
    letterSpacing: "-0.015em"
    fontVariation: "'opsz' 144"
  memo-heading:
    fontFamily: "Fraunces, Iowan Old Style, Palatino Linotype, Georgia, serif"
    fontSize: "26px"
    fontWeight: 400
    lineHeight: 1.15
    letterSpacing: "-0.01em"
    fontVariation: "'opsz' 72"
  headline-figure:
    fontFamily: "Fraunces, Iowan Old Style, Palatino Linotype, Georgia, serif"
    fontSize: "21px"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  memo-body:
    fontFamily: "Fraunces, Iowan Old Style, Palatino Linotype, Georgia, serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.72
    letterSpacing: "normal"
  body:
    fontFamily: "DM Sans, -apple-system, BlinkMacSystemFont, Segoe UI, Helvetica Neue, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
  table:
    fontFamily: "DM Sans, -apple-system, BlinkMacSystemFont, Segoe UI, Helvetica Neue, sans-serif"
    fontSize: "13.5px"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
  section-kicker:
    fontFamily: "DM Sans, -apple-system, BlinkMacSystemFont, Segoe UI, Helvetica Neue, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.14em"
  label:
    fontFamily: "DM Sans, -apple-system, BlinkMacSystemFont, Segoe UI, Helvetica Neue, sans-serif"
    fontSize: "10.5px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.12em"
  data:
    fontFamily: "SFMono-Regular, ui-monospace, JetBrains Mono, Menlo, monospace"
    fontSize: "11.5px"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "normal"
rounded:
  chip: "3px"
  control: "4px"
  block: "6px"
spacing:
  base: "8px"
  half: "4px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.control}"
    padding: "6px 12px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.fg}"
    rounded: "{rounded.control}"
    padding: "6px 12px"
  button-ghost-hover:
    backgroundColor: "transparent"
    textColor: "{colors.accent}"
    rounded: "{rounded.control}"
    padding: "6px 12px"
  control:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.fg}"
    rounded: "{rounded.control}"
    padding: "8px 11px"
  input-field:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.fg}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
  tier-corroborated:
    backgroundColor: "{colors.good-bg}"
    textColor: "{colors.good}"
    rounded: "{rounded.chip}"
    padding: "2px 7px"
  tier-single-source:
    backgroundColor: "{colors.mid-bg}"
    textColor: "{colors.mid}"
    rounded: "{rounded.chip}"
    padding: "2px 7px"
  tier-contradicted:
    backgroundColor: "{colors.bad-bg}"
    textColor: "{colors.bad}"
    rounded: "{rounded.chip}"
    padding: "2px 7px"
  tier-self-reported:
    backgroundColor: "{colors.bg2}"
    textColor: "{colors.muted}"
    rounded: "{rounded.chip}"
    padding: "2px 7px"
  citation:
    backgroundColor: "{colors.accent-weak}"
    textColor: "{colors.accent}"
    rounded: "{rounded.chip}"
    padding: "1px 6px"
  decision-badge:
    backgroundColor: "{colors.good-bg}"
    textColor: "{colors.good}"
    rounded: "{rounded.chip}"
    padding: "4px 9px"
  block:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.fg}"
    rounded: "{rounded.block}"
    padding: "14px 16px"
  claim-row:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.fg}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
  claim-row-active:
    backgroundColor: "{colors.accent-weak}"
    textColor: "{colors.fg}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
  nav-item:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    rounded: "{rounded.control}"
    padding: "8px 10px"
  nav-item-active:
    backgroundColor: "{colors.bg2}"
    textColor: "{colors.fg}"
    rounded: "{rounded.control}"
    padding: "8px 10px"
---

# Design System: FirstSignal

## Overview

**Creative North Star: "The Editorial Dark Terminal"**

FirstSignal is the screen an associate reads at 11pm before a 9am investment committee. The page is navy ink, not black: a deep blue-black that has a hue the way paper does, with three tonal steps (bg → bg2 → panel) stacked above it and a single hairline (`line`) doing almost all of the structural work. On that ground the system speaks in two voices. Everything the analyst **reads** — the page title, the verdict, the memo, evidence quotes, and the one number that is the headline of its block — is set in Fraunces, a soft high-contrast serif with an optical-size axis, ranged from a 300-weight hero to a 46px italic verdict. Everything they **scan** — tables, labels, controls, meta — is set in DM Sans, quiet and even, at 14px and below. Mono is reserved for claim ids and citations, where the string being exact is the point. The intended effect is an elegant institutional site rendered in dark mode: a memo that reads authored, over a data layer that never competes with it.

The surface is flattened. Tables are hairline rows on the page itself with no box; the memo is a document at a 68ch measure, not a card; the verdict is a ruled section; channel yields, landing stats, and the four flow stages are ruled ledger rows. Only genuinely contained things — blocks, the evidence rail, the trace panel, forms, popovers — carry a 1px `line` border on a `panel` fill. Dark mode casts no shadow at all; the light fallback allows one soft ambient shadow under panels. One accent, Evidence Blue (a sky blue on the navy), marks citations, current selection, and the primary action, and nothing else. Around it the trust vocabulary — green corroborated, amber single-source, red contradicted, slate self-reported — appears identically on every screen, each hue paired with a text label.

The system rejects consumer-fintech softness (no pill shapes, no pastel rounding, no playful illustration), enterprise-legacy chrome (no toolbars, no heavy borders, no corporate-blue gradients), and generic SaaS/AI-dashboard slop (no purple-blue gradients, no glass stat cards, no big-number KPI grids). Motion is state-only: one 180ms ease for hover and selection, plus the landing page's single entrance rise, both guarded for reduced motion.

**Key Characteristics:**
- Dark is canonical; light is the mirrored fallback with identical token names.
- Two voices: Fraunces for what is read (titles, verdict, memo, quotes, headline figures), DM Sans for what is scanned (UI, tables, labels), mono for machine identifiers.
- Flattened surfaces: hairline rules on the page bg for tables, ledgers and sections; 1px-bordered panels only for contained things; no dark-mode shadow.
- Tight radii: 6px blocks, 4px controls, 3px chips. Nothing is a pill.
- One kicker system (11px, 0.14em, 18px leading rule) and one label tracking (0.12em) across the product.
- One accent (Evidence Blue) for citations, selection, and the primary action; a four-color trust vocabulary that always travels with its text label.

## Colors

A navy-ink dark palette carrying one sky-blue accent and a four-color trust vocabulary, each tier with its own dark tint. Values in the frontmatter without a prefix are the canonical dark theme (`:root[data-theme="dark"]`); the `light-*` keys are the mirrored fallback (`:root`). The `--on-accent` / `--on-mid` tokens flip between the themes because the dark accent and amber fills are light, so text on them must be ink, not white.

### Primary
- **Evidence Blue** (`accent`, light `light-accent`): The single load-bearing accent. A sky blue on the navy ground (a navy on paper in light). It is the color of a citation chip, the active nav numeral, the sidebar wordmark's dot, a selected claim row's border, the primary button fill, the evidence rail's border, the memo's ordered-list numerals, and the "· founder" italic in a page title. It signals "proof or the thing you're acting on"; never decoration.
- **Evidence Blue Wash** (`accent-weak`, light `light-accent-weak`): The tint behind citations, selected/active rows, the sourcing suggestion callout, and thesis chips. Evidence Blue at low volume.
- **On-Accent Ink** (`on-accent`): Text on an accent or amber fill in dark mode (the page bg color); white in light mode.

### Neutral
- **Ink** (`fg`, light `light-fg`): Primary text, the verdict amount, memo prose, headline figures.
- **Muted** (`muted`, light `light-muted`): Secondary text — nav items at rest, page sub-copy, section kickers, table meta, the italic sidebar tagline.
- **Faint** (`faint`, light `light-faint`): Tertiary text — column headers, timestamps, nav numerals at rest, placeholders, the kicker's leading rule. Never body copy.
- **Navy Ink** (`bg`, light `light-bg`): The page and the sidebar. In dark mode it has a visible blue hue; in light it is a cool near-white.
- **Navy Sink** (`bg2`, light `light-bg2`): The recessed layer — the active nav fill, row hover, self-reported chips, axis cells, meter tracks, code/formula wells.
- **Panel** (`panel`, light `light-panel`): The contained surface — blocks, cards, the evidence rail, trace, popovers, inputs, claim rows.
- **Line** (`line`, light `light-line`): Every hairline: table rows, section rules, the page-header rule, panel borders. 1px, always.

### Tertiary (trust + decision vocabulary)
- **Corroborated Green** (`good` on `good-bg`): Corroborated claims, invest verdicts, improving trends, validator passes.
- **Single-Source Amber** (`mid` on `mid-bg`): Single-source claims, conditional verdicts, flagged gaps (the `gap` micro-badge is a solid amber fill with on-mid text), refused answers.
- **Contradiction Red** (`bad` on `bad-bg`): Contradicted claims, pass verdicts, errors, the contradiction spotlight's border and tint. The color that says "read this first."
- **Self-Reported Slate** (`muted` on `bg2`): Unverified/self-reported claims — deliberately colorless because absence of corroboration is the point. Inferred claims are the same slate with a dashed `line` border and no fill.

### Named Rules
**The One Voice Rule.** Evidence Blue is the only accent. It appears on citations, current selection, and the one primary action per view; nothing else. Its rarity is what makes a citation legible as a link to proof.

**The Trust-Vocabulary Rule.** Green/amber/red/slate mean corroborated/single-source/contradicted/self-reported everywhere, without exception. A tier color is never reused for decoration, and it never travels without its text label.

**The Navy-Not-Black Rule.** The dark ground is `bg` (a hued navy ink), never `#000` or a neutral gray. Every dark surface — bg, bg2, panel, line, the tier tints — carries the same blue cast so the page reads as one material.

## Typography

**Reading Font:** Fraunces (variable: `opsz` 9–144, weight 300–600, roman + italic; fallback Iowan Old Style, Palatino Linotype, Georgia, serif)
**Scanning Font:** DM Sans (`opsz` 9–40; loaded at 400 / 500 / 600; fallback -apple-system, Segoe UI, Helvetica Neue, sans-serif)
**Identifier Font:** SFMono-Regular (fallback ui-monospace, JetBrains Mono, Menlo, monospace)

**Character:** A soft, high-contrast serif for reasoning over a quiet, even sans for data. Fraunces is set light (300–400) at display sizes with `opsz` 144 so the hero and verdict feel drawn rather than bold, and its italic carries emphasis (the verdict, the founder name in a title, the sidebar tagline, evidence quotes, the landing hero's key phrase). DM Sans stays at 14px and below and never carries a heading. `font-optical-sizing: auto` is on globally; `font-variant-numeric: tabular-nums` is applied to every figure so numbers align in columns regardless of face.

### Hierarchy
- **Hero** (Fraunces 300, `clamp(2.8rem, 6.4vw, 5.5rem)`, lh 0.98, -0.025em, opsz 144): Landing headline only. Its emphasized phrase is italic in Evidence Blue.
- **Verdict** (Fraunces 400 italic, 46px, lh 1, -0.02em, opsz 144; 38px below 860px): The decision word (invest / pass / conditional), colored by its tier. The largest element on the Decision page.
- **Page Title** (Fraunces 400, 40px, lh 1.02, -0.015em, opsz 144; 32px below 860px): Page headers, balanced, with the founder suffix in italic 300 accent.
- **Landing Section / Method Heading** (Fraunces 300–400, 24–26px range: flow heading `clamp(1.9rem, 3.2vw, 2.6rem)`, memo h2 26px opsz 72, flow-stage title 25px, method h3 24px, compare score 24px): Second-level reading headings.
- **Headline Figure** (Fraunces 300–500, 36px landing stat / 30px flow numeral / 22px verdict amount / 21px channel funnel / 19px axis cell / 18px card score / 16px F-score, tabular): The one number that is the headline of its block. Serif marks it as something to read, not a cell to scan.
- **Memo Heading** (Fraunces 400, 26px, lh 1.15, opsz 72) and **Memo Subheading** (Fraunces 500, 19px): Section heads inside the memo; also the founder-peek headline (19px/500) and outreach subject (17px).
- **Memo Body** (Fraunces 400, 17px, lh 1.72, max 68ch): The memo prose and the "Ask this memo" answer (16.5px). The only long-read surface, set on the page itself.
- **Evidence Prose** (Fraunces, 14.5–15px, lh 1.5–1.55): Claim text in the ledger (14.5px) and evidence rail (15px); source quotes are 15px italic 300.
- **Brand** (Fraunces 500, 23px, -0.01em): Sidebar wordmark and landing wordmark; the trailing dot is accent. Tagline is Fraunces italic 300 13px muted.
- **Body** (DM Sans 400, 14px, lh 1.55): Default UI, page sub-copy (measure carved to 640px), flow-stage descriptions.
- **Table / Control** (DM Sans 400–500, 13.5px table cells, 13.5px nav, 13px controls, 12.5px ghost buttons and dense rows, 12px meta): The scan layer.
- **Section Kicker** (DM Sans 600, 11px, uppercase, 0.14em, preceded by an 18px × 1px `faint` rule): `.section-h h2`; the same 11px/0.14em applies to the contradiction-spotlight heading and the provenance summary.
- **Label** (DM Sans 600, 10–10.5px, uppercase, 0.12em): Column headers, block titles, channel names, tier headers, form labels, meter keys, evidence labels, flow-stage `in/does/out`. One tracking value everywhere.
- **Data / Citation** (SFMono 500–700, 11–12px, tabular): Claim ids (`.cr-id`, `.ev-id`), inline citations (11.5px), tier chips (11px), domain chips (11px), formulas, provenance node labels.

### Named Rules
**The Two-Voice Rule.** Fraunces sets what the analyst reads: titles, the verdict, the memo and its headings, evidence and quotes, the wordmark, and the single headline figure of a block. DM Sans sets what they scan: body UI, tables, labels, controls. Never set a memo or a title in the sans; never set a table cell, a label, or a control in the serif. Mono is reserved for claim ids and citations.

**The Light-Display Rule.** Serif display sizes are set light (300 hero and landing, 400 titles and verdict) with `opsz` 144. Weight is never the hierarchy device in the serif; size, optical size, italic, and color are.

**The One-Kicker Rule.** There is one kicker in the system: the `.section-h` label, 11px uppercase 0.14em with its 18px leading rule. All other small labels share 0.12em tracking at 600 weight. Do not invent eyebrow variants.

## Layout

A fixed 236px left rail (page bg, 1px right rule, sticky full-height, 30px/18px padding) and a main column capped at 1180px with 40px/56px padding and a 100px bottom. The rail mirrors the pipeline (Sourcing → Screening → Diligence → Memo & Decision → Thesis → Compare → Network → Methodology) with serif numerals. Page headers close with a 1px rule (22px below, 34px before content). Spacing runs on an 8px base with 4px halves: 6–8px between rows and chips, 10–14px inside dense blocks, 14–20px between blocks and grid cells, 28–36px between ruled sections, 18–20px panel padding.

Reading surfaces carve their own measure: memo 68ch, page sub-copy 640px, landing sub 50ch, landing flow sub 62ch, landing foot 58ch. Grids: the sourcing two-column is 3fr/2fr (collapses at 980px); Decision's sub-grid is 1fr/1fr (collapses at 820px); the network page is 3fr/2fr (collapses at 900px); application cards are `auto-fill, minmax(340px, 1fr)`. The memo row is a flex pair — memo plus a 330px evidence rail or 360px trace, sticky at 24px — that reverses to a column at 860px, where the rail also becomes full width and static. Below 860px the sidebar flattens to a wrapping horizontal bar and hides its tagline and numerals; the main padding drops to 24px/16px; page titles fall to 32px and the verdict to 38px. Wide tables live in `.tablewrap` (`overflow-x: auto`, table min-width 560px) so the page body never scrolls sideways. The landing uses its own fluid padding (`clamp(24px, 5vw, 52px)` / `clamp(20px, 5vw, 64px)`) at the same 1180px cap, and collapses stats and flow rows at 560px.

## Elevation & Depth

Flat and tonal. Depth is three stacked navy tones (bg → bg2 → panel) and a hairline; dark mode declares `--shadow: none` and nothing lifts. The light fallback keeps one soft ambient shadow under contained panels (blocks, cards, evidence rail, popovers, provenance and network panels) so white panels separate from the cool paper. Inputs and tables cast nothing in either theme. Interaction is signaled by border-color and background (a row hover to bg2, a claim row's border and wash to accent), never by shadow or lift.

### Shadow Vocabulary
- **Ambient panel, light only** (`box-shadow: 0 1px 2px rgba(16,24,40,.05), 0 10px 30px -14px rgba(16,24,40,.18)`): Applied through `var(--shadow)` to `.block`, `.card`, `.evidence`, `.outreach-card`, `.peek-pop`, `.infotip-pop`, `details.provwrap`, `.net-graph`. Resolves to `none` in dark mode.

### Named Rules
**The Flat-Terminal Rule.** Surfaces are flat. Depth is tonal, not cast. If a component seems to need a shadow to separate from its background, the wrong tone is in use: reach for panel over bg, or a hairline rule, instead.

**The Ruled-Not-Boxed Rule.** Anything that is a sequence or a ledger — table rows, channel yields, landing stats, flow stages, the verdict section, the "Ask this memo" block, the latency footer — is separated by 1px `line` rules on the page bg, not enclosed in a card. A panel border is reserved for things that are genuinely contained: blocks, the evidence rail, the trace, forms, popovers, claim rows.

## Shapes

Tight, near-square corners on a hairline structure. Three radii only: 6px (`--r`) for blocks, cards, panels, popovers, and the evidence rail; 4px (`--r-sm`) for buttons, controls, inputs, nav items, claim rows, axis cells, callouts, and the focus ring's corner; 3px for chips, badges, citations, tier chips, source tags, and status flags. There are no pills: the `.pill` class and every badge use 3px. Bars (axis 7px, meter 4px) round to half their height. Borders are 1px `line`; the only colored full borders are the evidence rail, popovers, the outreach card and the active claim/thesis row (accent), the contradiction spotlight (red), and the inferred tier chip (dashed `line`). The single left-border in the system is the 2px `line` rail on a trace signal quote; color stripes as accents are absent. Landing `flow-kind` tags are 3px with a 40%-alpha tier-colored border and no fill.

## Components

Components are quiet at rest and decisive on interaction: a 1px `line` border or no border at all, then a shift of border and text to Evidence Blue on hover. Every transition uses the single motion token (`--ease: 180ms cubic-bezier(0.2, 0.7, 0.2, 1)`) and conveys state only. One focus ring for everything: `2px solid accent`, 2px offset, 3px radius.

### Buttons
- **Shape:** 4px (`{rounded.control}`).
- **Ghost** (`.minibtn`, the default): Transparent, `fg` text, 1px `line` border, 6px 12px, DM Sans 500 12.5px. Hover shifts border and text to accent. The destructive variant (`.th-del`) is muted at rest and shifts to red only on hover.
- **Primary** (`.minibtn.primary`): Accent fill and border, `on-accent` text (navy ink in dark, white in light); hover brightens 8%. One per view (Submit application, Ask, Export IC memo — the memo export runs larger at 13px, 7px 14px).
- **Control** (`.control`): Panel fill, 1px `line`, 8px 11px, 13px; hover border to `faint`. Used for the sidebar's thesis select and theme toggle.
- **Landing CTA** (`.landing-cta`): The one inverted button — ink fill on the navy landing, ink-colored bg text, 13px uppercase 0.1em, 15px 26px, 4px radius; hover goes white and slides the arrow 4px.
- **Disabled:** 55% opacity, default cursor.

### Chips (trust tiers, badges, citations, tags)
- **Trust-tier chip** (`.tierchip`): Mono 600 11px, tabular, 3px, 2px 7px, tier color on its tint. Always carries the tier's text label plus the trust value. Inferred: no fill, dashed `line` border.
- **Decision badge** (`.badge`): DM Sans 600 10.5px uppercase 0.1em, 4px 9px, 3px; invest→good, pass→bad, conditional and invest-conditional→mid, none→muted on bg2.
- **Citation** (`.cite`): Mono 11.5px, accent on accent-weak, 3px, 1px 6px; a real button that opens the evidence rail. Hover dims 5% and underlines.
- **Source tag** (`.src`) / thesis chip (`.chip`) / cold-start and new flags: 3px, 10–12px; slate on bg2, accent on wash, or tier color on tint. The `gap` micro-badge is the one solid fill: 9.5px 700 uppercase on `mid` with `on-mid` text.

### Cards / Containers
- **Block** (`.block`, `.card`): Panel fill, 1px `line`, 6px, 14px 16px (cards 18px 20px), ambient shadow in light only. Block titles are 10.5px 0.12em labels in muted. Nested cards are forbidden; rows inside a tinted container (the spotlight) sit on its tint with a translucent border, never in a second box.
- **Ruled section** (`.rec-card`, `.chan`, `.landing-stat`, `.flow-stage`, `.ask`, `.lat-foot`): No fill, no radius; a 1px `line` above or below, 12–28px of vertical padding.
- **Callout** (`.suggestion`, `.err`, `.ask-refused`, `.gaps li.gap`): 4px, 8–10px by 12–14px, a tint (wash, bad-bg, mid-bg) with no border.

### Inputs / Fields
- **Style** (`.filter`): Panel fill, 1px `line`, 4px, 10px 12px, DM Sans 13.5px, no shadow. Textareas resize vertically and inherit the sans.
- **Hover / Focus:** Border to `faint` on hover, to accent on focus (outline suppressed in favour of the border). Placeholder is `faint`.
- **Labels:** 10.5px uppercase 0.12em muted, stacked above the field in a 1fr/1fr grid.

### Navigation
- **Rail** (`.side`): 236px, page bg (no panel fill), 1px right rule, sticky. Wordmark Fraunces 500 23px with an accent dot that scales on hover; tagline Fraunces italic 300 13px muted with 30px below.
- **Item** (`.nav`): DM Sans 500 13.5px muted, 8px 10px, 4px radius, 12px gap to a right-aligned 14px-wide numeral in Fraunces 400 12px `faint`. Hover and active both fill bg2 and lift text to `fg`; the active numeral turns accent. That accent numeral is the only accent in the rail besides the dot.
- **Foot:** Thesis select and theme toggle as `.control`s, pushed to the bottom.
- **Mobile (≤860px):** Rail becomes a wrapping horizontal bar; tagline and numerals hide; the foot moves to the right.

### Section Header (signature)
`.section-h`: a flex row whose `h2` is the system's one kicker — DM Sans 600 11px uppercase 0.14em muted, preceded by an 18px × 1px `faint` rule via `::before` — with an optional tabular 12px `faint` count beside it and, on the thesis page, an add button pushed right. 14px below it.

### Verdict Block (signature)
`.rec-card`: a ruled section, not a card. The verdict word leads in Fraunces italic 46px, colored by tier; beside it the check amount (serif 500 22px in `fg`) and the append-only F-Score sparkline (accent line, `faint` baseline). Below: the Signal / Coverage meters (two 4px tracks, accent and faint, never one number), the "what would change our mind" line, and the claim ids the decision turns on as citation chips.

### Memo + Evidence Rail (signature)
The memo (`.memo`) is a document on the page: Fraunces 17px/1.72 at 68ch, headings at 26px opsz 72 and 19px/500, ordered-list numerals in accent 500 tabular, inline mono citations. It closes with a ruled `.memo-actions` row carrying the primary export button and a `faint` 11.5px note. Clicking a citation opens the evidence rail or trace (`.evidence`, `.trace`) — the one panel bound by a full accent border: sticky, 330/360px, panel fill, 6px, 18px 20px, with the mono claim id in accent 700, the tier line in its color, the claim text in Fraunces 15px, and the source card (`.srccard`: bg2, 1px line, 4px) holding a mono domain chip, tabular date, and an italic serif quote at 300.

### Ledger Row (signature)
Tables (`table.funnel`) have no box: a 1px `line` top rule, 10.5px 0.12em `faint` column headers with a bottom rule, 13.5px cells on 13px 12px padding, each row ruled below, row hover to bg2. Names are 600; the click target is the `.rowlink` button in one cell, not the row. Channel yields (`.chan`), landing stats, and flow stages are the same idea: a top rule, a 10.5px label, a serif headline figure (21px / 36px / 30px) and an 11.5px `faint` rate line.

## Do's and Don'ts

### Do:
- **Do** build on the dark tokens first (`bg` #0a1120, `panel` #131e35, `line` #223050, `fg` #edf0f6) and check the light mirror second; dark is canonical (The Navy-Not-Black Rule).
- **Do** reserve Evidence Blue (`#8fb7ea` dark / `#1d4d8f` light) for citations, current selection, the active nav numeral, and the one primary action per view (The One Voice Rule).
- **Do** keep green/amber/red/slate meaning corroborated/single-source/contradicted/self-reported on every screen, and always pair a tier color with its text label (WCAG-AA + colorblind-safe, per PRODUCT.md).
- **Do** set titles, the verdict, memo prose and headings, evidence quotes, the wordmark, and a block's single headline figure in Fraunces; set body UI, tables, labels, and controls in DM Sans; set claim ids and citations in mono (The Two-Voice Rule).
- **Do** keep serif display light: 300 for the hero and landing headings, 400 for page titles and the verdict, `opsz` 144 at display sizes and 72 for memo headings (The Light-Display Rule).
- **Do** use the one kicker (`.section-h h2`: 11px, 0.14em, 18px leading rule) for section labels and 10.5px / 0.12em / 600 for every other small label (The One-Kicker Rule).
- **Do** separate sequences and ledgers with 1px `line` rules on the page bg — tables, channel yields, stats, flow stages, the verdict section — and give a panel border only to things that are contained (The Ruled-Not-Boxed Rule).
- **Do** use the three radii only: 6px blocks, 4px controls, 3px chips.
- **Do** keep `--shadow: none` in dark mode and the single ambient shadow in light; convey interaction with border and background shifts on the 180ms `--ease` token.
- **Do** show the three screening axes and the Signal/Coverage split as separate values, never averaged into one number.
- **Do** render gaps and contradictions with weight — the amber `gap` micro-badge, the red-bordered contradiction spotlight — in the brief's own words, never filled.
- **Do** guard every animation (`l-rise`, `pulse`, `dilig-spin`) with `@media (prefers-reduced-motion: reduce)`; reduced motion is a PRODUCT.md commitment.
- **Do** apply `tabular-nums` to every figure regardless of face.

### Don't:
- **Don't** use pure black or neutral gray for a dark surface; every dark tone carries the navy cast.
- **Don't** use pill radii or anything above 6px on a UI element (bars excepted). The old 8/12/20px scale is gone.
- **Don't** put the memo, a table, a stat row, or the verdict inside a card; don't nest cards; don't box a ledger.
- **Don't** set a table cell, label, control, or nav item in Fraunces, and don't set a title, the verdict, or memo prose in DM Sans.
- **Don't** set serif display at 500–600 to make it "heavier"; use size, italic, optical size, or color instead.
- **Don't** invent a second kicker or eyebrow style; there is one `.section-h` kicker and one label tracking.
- **Don't** cast shadows in dark mode, use glassmorphism, gradient text, or `border-left`/`border-right` color stripes as accents (the 2px trace-signal rail is a quote mark, not an accent).
- **Don't** introduce a second accent hue, reuse a trust-tier color for decoration, or put white text on the dark accent fill (use `on-accent`).
- **Don't** look like consumer fintech (pastel rounding, playful illustration), enterprise legacy (toolbars, heavy chrome, corporate blues), or generic SaaS/AI dashboards (purple-blue gradients, glass stat cards, big-number KPI grids).
- **Don't** let a wide table scroll the page body; wrap it in `.tablewrap`.
