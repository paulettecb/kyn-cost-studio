# KYN — Design System

> Handmade, premium dog-walk accessories made from original **biothane** and **solid brass** — strong, durable, fully waterproof gear for dog owners who want the good stuff.

This project is the source of truth for KYN's brand: colors, type, fonts, spacing, and the rules that keep it feeling **premium with a spark of whimsy** (never cluttered or childish).

---

## The big idea — "premium-whimsy"

KYN sells premium gear to people who love their dogs. The brand has to feel **refined and trustworthy** first, **playful and warm** second. The rule:

**90% premium backbone · 10% whimsy spark.**

- **The 90% (premium):** Hanken sans for everything structural, warm neutrals, lots of white space, restrained periwinkle, soft shadows, generous rounding.
- **The 10% (whimsy):** *one* spark per view — a Friendship marker word, a Farmhouse signature flourish, the hand-drawn heart, a single pastel fill, a charm/sticker. Delight, not noise.

When in doubt: remove a spark, add space.

---

## CONTENT FUNDAMENTALS

**Voice:** warm, confident, a little playful — like a friend who happens to make beautiful, tough gear. Premium but never stiff.

- **Person:** speak to "you" and "your dog." The brand is "we."
- **Casing:** Sentence case for body and most headlines. ALL-CAPS reserved for small eyebrows/labels (with wide tracking). Avoid Title Case Everywhere.
- **Sentence length:** short, punchy headlines; benefit-first product lines. e.g. *"Gear up for the good walks."* / *"Strong, durable, waterproof."*
- **Emoji:** essentially none in running copy. The **heart ♥** is a brand mark, not an emoji — use the drawn heart, sparingly.
- **What we talk about:** materials (biothane, solid brass), durability, waterproofing, handmade/small-batch craft, the bond between dog + human.
- **Tone examples:**
  - Eyebrow: `HANDMADE · BIOTHANE & BRASS`
  - Headline: *Made by hand, built to last.*
  - Body: *Strong, waterproof, and made to look as good as it lasts.*
  - CTA: `Shop the collection` · `Build a set`

---

## VISUAL FOUNDATIONS

**Color**
- **Base:** periwinkle `#8795D2` (`--periwinkle-500`) is the brand + primary action color. A full 50–900 scale is available.
- **Neutrals:** warm, lightly periwinkle-tilted — `--paper` (#FBFAF7) pages, `--oat` (#F4F0E8) sections, `--ink-900` (#2A2933) text. These carry most surfaces.
- **Pastels** (blush, peach, butter, mint, sky, lilac): whimsy accents only — soft fills behind product, tags, illustration. Never the dominant color of a layout.
- **The pop:** magenta `#E85DA0` (from the logo heart) — one small highlight per view (a badge, a heart, a sale tag). Never an action color.

**Type** (see `tokens/typography.css`)
- `--font-sans` / `--font-heading` **Hanken Grotesk** — the workhorse. Headlines (700–800, tight tracking), subheads, product names, prices, body, and UI. Premium = clean + readable.
- `--font-accent` (`--font-serif`) **Farmhouse** — a **signature script**, **rare special accents only**: monograms, a date/edition flourish, a signature-style name. Swash alternates live in the PUA (alt1 = U+F001…F01A, alt2 = U+F01B…F034; e.g. `n.alt1`=U+F00E, `w.alt2`=U+F031). Low-legibility — never body or running headlines.
- `--font-display` **Friendship** — hand-drawn marker. Logo + at most one spark word per view. Never body.

**Backgrounds:** mostly flat warm neutrals. Soft organic "blob" shapes in a single pastel behind product imagery add whimsy. No busy gradients, no heavy textures.

**Imagery:** bright, clean product-on-light photography; lifestyle shots of dogs + people outdoors, warm and natural. (Specimens use striped placeholders with monospace labels where real photos go.)

**Shape & depth:** generous rounding (`--radius-md`/`lg`/`pill`). Shadows are **soft, low, periwinkle-tinted** (`--shadow-sm/md/lg`) — never harsh black. Pills for buttons & tags.

**Borders:** hairline, low-contrast (`--border-subtle` on paper, `--border-on-oat` on oat).

**Motion:** gentle and restrained — `--ease-out` for entrances, 140–360ms. Small hover lifts and fades; no bouncy/loud animation.

**States:** hover = slightly darker periwinkle (`-600`) or a soft shadow lift; press = subtle scale-down; focus = `--shadow-focus` periwinkle ring.

---

## ICONOGRAPHY

KYN's signature mark is the **hand-drawn heart** (magenta), paired with the Friendship wordmark — keep it loose and imperfect, never a geometric/filled heart.

For UI icons, no custom set exists yet. Recommendation: a **rounded, medium-stroke** line set (e.g. Lucide / Phosphor) to match the friendly-premium tone — rounded caps, ~1.75px stroke, `--ink-700`. **Flag:** confirm or provide an icon preference before building UI kits. No emoji as icons.

Assets live in `assets/` (`logo/kyn-logo.png`, `fonts/`).

---

## INDEX / manifest

- `styles.css` — global entry (import this). Pulls in all tokens + fonts.
- `tokens/` — `fonts.css`, `colors.css`, `typography.css`, `spacing.css`, `effects.css`
- `assets/` — `logo/kyn-logo.png`, `fonts/Friendship-Medium.otf`, `fonts/Farmhouse.otf` (signature script, CFF, with PUA swashes)
- `guidelines/` — foundation specimen cards (Colors, Type, Spacing, Brand) shown in the Design System tab
- `components/components.css` — token-driven component styles (shipped via styles.css)
- `components/` — React primitives + specimen cards:
  - `buttons/` — **Button** (primary/secondary/ghost/pop · sm/md/lg), **IconButton**
  - `forms/` — **Input** (label/hint/error), **Checkbox**
  - `feedback/` — **Badge** (pop/brand/soft/pastels/outline)
  - `surfaces/` — **Card**, **ProductCard** (signature commerce tile)
- `SKILL.md` — makes this usable as a downloadable Claude skill

**Source materials given by KYN:** primary color `#8795D2`; logo PNG; fonts *Friendship-Medium* (OTF marker) & *Farmhouse* (OTF signature script with PUA swash alternates); aesthetic reference: springlandpets.com.

---

## DECISIONS LOCKED

- **Body sans = Hanken Grotesk** ✅ (KYN-approved) — now also carries **headlines & product names**.
- **Farmhouse = signature script, rare accent only** ✅ (`assets/fonts/Farmhouse.otf`) — monograms, edition marks, name signatures, swashes. Not a serif; not for body/headlines.
- **Icons = Lucide**, rounded line set, ~1.75px stroke, `--ink-700` ✅
- **First build = core components** ✅ (this set) → marketing landing page next, reusing them.

## OPEN ITEMS

1. **Farmhouse swashes** — alternates are in the PUA. `alt1` (leading swash) = U+F001–F01A for a–z; `alt2` (trailing swash) = U+F01B–F034 for a–z. See the *Farmhouse swash library* card. ⚠️ html-to-image screenshots only resolve the font via a **local `@font-face` + literal family name** (not `var()`), so Farmhouse-displaying cards declare a local `FarmhouseLocal` face.
2. **Drop-caps use Friendship** (user preference). Monograms, edition marks & name signatures use Farmhouse script.
3. Confirm component set coverage — add **Select / Radio / Switch / Tabs / Quantity stepper / Toast** if the landing page or dashboard needs them.
4. Provide real product photography (specimens use striped placeholders).
