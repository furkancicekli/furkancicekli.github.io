# Phase 4 — Public UI Revision (logo system + animated sections + E2E)

Branch: `feature/cloudflare-foundation` (continues; same branch as Phase 1).
Base for this phase: `cb504e0`.
Execution: subagent-driven-development. Per task: implement (frontend-architect, sonnet) → review
(quality-engineer, sonnet) → fix loop → append "P4-N: complete" to .superpowers/sdd/progress.md.

## Global constraints (from docs/superpowers/specs/2026-06-26-cloudflare-foundation-design.md §4/§5 + user)
- **Logo preserved:** keep `public/FURKANLOGO.png`; never replace. It is a single transparent
  black silhouette (2030×3960, alpha). Recolor via CSS `mask`, not by adding new asset files.
- **Aesthetic:** light = minimal-mono, dark = editorial. Token system is grayscale (no chroma).
  Effects must stay tasteful and mono-friendly (glow/shimmer/motion, not rainbow).
- **i18n:** tr (default) / en / ar (RTL). Every new user-facing string gets all 3 locales.
- **Stack:** shadcn + Tailwind v3 + framer-motion (installed). Reference registries (cult-ui,
  chamaac, aicanvas, animate-ui) are inspiration — build ORIGINAL components on this stack
  (docs say copy-paste + verify license/CSP; originals avoid both risks).
- **Typography:** DEFER the font decision (docs §5 → user picks later). Keep Inter/Playfair;
  fontFamily is already a single-variable swap (tailwind `fontFamily` + globals @import). No task.
- **Hover video player ref:** SKIP — no video asset exists (docs §4 "if video exists").
- **Verification bar:** `npm run build` green + manual/visual check in BOTH themes; formal E2E in P4-7.

---

## P4-1: Logo component + navbar/footer theming
**Files:** Create `src/components/ui/Logo.tsx`; modify `Header.tsx`, `Footer.tsx`, `src/components/ui/index.ts`, `i18n/locales/{tr,en,ar}.json`.
**Interface:** `<Logo className?, decorative?: boolean />` — renders FURKANLOGO.png as a `mask-image`
on a `span`, `background-color: currentColor`, `mask-size: contain`, no-repeat, center. Color comes
from the element's text color (Tailwind `text-*`). Default `aria-label` from i18n `a11y.logo`
("Furkan Çiçekli logosu"); `decorative` → `aria-hidden` + no label (for the loader/hero where text
already labels the brand). Inline style uses both `maskImage` and `WebkitMaskImage`.
- Header.tsx:56-60 → `<Logo className="h-10 md:h-12 w-10 text-foreground" />` (mask needs a width;
  set an explicit aspect-correct box ~ h:w ≈ 1.95, e.g. `h-10 w-[21px] md:h-12 md:w-[25px]`, or use
  `aspect-[2030/3960]` with a height). Keep the serif name span.
- Footer.tsx:20-24 → remove `invert`; `<Logo className="h-10 ... text-neutral-content" />` (same
  token as adjacent footer text → contrasts with footer bg in both themes).
- Add i18n `a11y.logo` to all 3 locales.
**Acceptance:** build green; logo visible & correctly colored in navbar AND footer in BOTH light
and dark themes (no invert bug, no invisible logo).

## P4-2: Logo loading screen
**Files:** Create `src/components/ui/LoadingScreen.tsx`; modify `src/App.tsx`, `index.html`.
**Behavior:** Full-screen overlay (`fixed inset-0 z-[100] bg-background grid place-items-center`),
centered animated `<Logo decorative className="h-24 w-auto text-foreground" />` (subtle pulse/scale
via framer-motion). Shown on first app mount; fades out (framer-motion `AnimatePresence`) after a
min display of ~700ms AND `window` load. Implement in App as a `mounted/visible` state + effect; do
NOT block route rendering after fade. Add a **pre-React inline fallback** in `index.html` `<body>`:
a `#app-loader` div with the logo as a mask (inline `<style>` + theme-aware via the existing `.dark`
mechanism on `<html>`) so the brand shows before JS hydrates; remove/hide it once React mounts (React
overlay covers then fades, then the inline node is hidden). Keep it simple — no route spinners.
**Acceptance:** build green; on load, logo loader appears then fades to content, no flash of wrong
theme, no permanent overlay; works light+dark.

## P4-3: Hero — logo instead of photo, tasteful effect
**Files:** modify `src/components/sections/Hero.tsx`.
**Change:** Replace the right-column photo (`/images/hero/1.jpeg`, lines 79-86) with a brand-mark
presentation of `<Logo decorative className="... text-foreground" />`. Drop the photo "card"
framing; place the logo centered over a soft mono radial-gradient/glow backdrop with a gentle
framer-motion float/scale-in (mono-friendly shimmer OK — e.g. an animated radial-gradient sheen
behind the mask). Keep 2-column layout, keep the left column text + CTAs. NOTE: the inline stats
block in Hero (lines 34-52) MOVES to P4-4's Stats section — coordinate: P4-4 removes it from Hero.
For P4-3, leave the stats block in place (P4-4 owns its removal) to avoid a merge gap.
**Acceptance:** build green; hero shows the logo (not the person photo) attractively in both themes;
heavy WebGL is explicitly out of scope (this is the tasteful baseline; a shader upgrade is future).

## P4-4: Stats cards section
**Files:** Create `src/components/sections/Stats.tsx`; modify `src/components/sections/index.ts`,
`src/pages/HomePage` (add `<Stats/>`), `Hero.tsx` (remove the inline stats block), `i18n` (add
`stats.sectionTitle`/`stats.sectionSubtitle` if a heading is used).
**Component:** A responsive grid of animated stat cards built from `stats` (config) + `stats.*` i18n
labels, with a count-up animation on `whileInView` (framer-motion + a small useCountUp using
`animate`/`useMotionValue`, or a simple effect). shadcn card styling (`bg-card border rounded-xl`).
Mono aesthetic. Adapt to the 3 existing stats (6 yıl, 100+, 2 yıl Kuveyt).
**Acceptance:** build green; Stats section renders on home with count-up; Hero no longer duplicates
the inline stats; both themes OK; RTL OK.

## P4-5: Interactive card-stack craft showcase
**Files:** Create `src/components/sections/CraftStack.tsx`; modify `sections/index.ts`, `HomePage`,
`i18n` (`craftStack.title`/`craftStack.subtitle`).
**Component:** An interactive stacked-cards showcase of selected gallery images
(`/images/gallery/craft-1.jpg`..`craft-6.jpg` from `public/`), framer-motion: cards fan/stack;
advance via drag or prev/next buttons (keyboard accessible, `aria-label`s). Reuse existing image
paths (still served from /public this phase). Lazy-load images. Mono framing.
**Acceptance:** build green; section renders, advancing works via buttons (and drag), accessible
labels present; both themes; RTL: controls mirror correctly.

## P4-6: Dancing-letters animated heading
**Files:** Create `src/components/ui/DancingLetters.tsx`; apply to one prominent section title
(About title or CraftStack title); modify `src/components/ui/index.ts`.
**Component:** Splits a string into per-letter `motion.span` with a staggered wave/dance on
`whileInView` (respect `prefers-reduced-motion` → render static). Preserves spaces & is screen-reader
friendly (wrap whole text in an `aria-label`, mark letters `aria-hidden`). Works with TR/AR
characters; for RTL, do not reverse logical order (CSS handles direction).
**Acceptance:** build green; the chosen heading animates letter-by-letter on scroll-in; readable by
SR; reduced-motion respected; both themes; AR text intact.

## P4-7: Playwright E2E + visual smoke tests
**Files:** install `@playwright/test`; create `playwright.config.ts`, `tests/e2e/home.spec.ts`;
modify `package.json` (`test:e2e` script), `.gitignore` (playwright-report/, test-results/).
**Tests:** against the built preview server (`vite preview` or the existing dev) —
  1. home `/` loads, `<title>` correct, no console errors.
  2. theme toggle: clicking ThemeSwitch toggles `.dark` on `<html>` and persists (localStorage `theme`).
  3. logo present & visible in navbar AND footer in BOTH themes (assert the Logo elements render).
  4. loading screen disappears (content visible, overlay gone) shortly after load.
  5. new sections render: Stats (count values present), CraftStack (controls present).
**Browser install:** run `npx playwright install --with-deps chromium` (or just chromium). If the
environment cannot download browsers, KEEP the config + specs (CI-runnable) and report the install
failure honestly — do not delete tests; do not fake a pass.
**Acceptance:** config + specs committed; `test:e2e` script present; report the actual run result
(passes, or the precise browser-install limitation if it can't run locally).

---

## Sequencing notes
- P4-3 and P4-4 touch Hero — run P4-3 first (logo treatment), then P4-4 (removes Hero inline stats).
- P4-7 last (tests the finished UI).
- After P4-7: final whole-branch review (opus) over the full Phase-1+Phase-4 range, then
  finishing-a-development-branch.
- USER ACTION still pending from Phase 1 (unchanged): GitHub secrets CLOUDFLARE_API_TOKEN +
  CLOUDFLARE_ACCOUNT_ID; first-deploy verify after merge.
