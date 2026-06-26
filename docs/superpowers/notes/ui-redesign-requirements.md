# UI/Redesign Phase — Requirements & Notes (captured 2026-06-26)

Source: user message at branch-finish checkpoint. Cloudflare foundation (Phase 1, branch
`feature/cloudflare-foundation`) is functionally complete but the user does not consider the
site "done" — this phase covers the visual/UX redesign before going live.

## Concrete, well-defined tasks
1. **Homepage hero image = LOGO, not the person's photo.** Currently the homepage shows the
   person's photo; it must show the logo image instead.
2. **Loading screen using the logo** while the page loads (logo-based splash/loader).
3. **Playwright tests** — set up E2E/visual tests (was always planned).
4. **Dark-mode logo bug** — in dark mode there is a "logo karmaşası" (logo mess/contrast issue)
   in BOTH the footer and the navbar. Needs fixing (likely a light-on-light or dark-on-dark
   logo asset / variant problem).

## Design inspiration / candidate sections (exploratory — need brainstorming + evaluation)
- **Interactive card stack** — https://aicanvas.me/components/interactive-card-stack
  - Idea: a section showcasing some of the tesbih (prayer-bead) images as a card stack.
- **animate-ui** — https://animate-ui.com/docs
  - Minimal, clean components for general animations site-wide.
- **Dancing letters (text animation)** — https://www.chamaac.com/components/text-animations/dancing-letters
  - Idea: a nice text-animation section.
- **Interactive grid background** — https://www.chamaac.com/components/backgrounds/interactive-grid
  - Optional but nice background.
- **Stats cards** — https://www.chamaac.com/components/sections/stats-cards
  - Card structure to adapt to the customer (e.g. craftsmanship stats / numbers).
- **Hero heatmap** — https://www.cult-ui.com/docs/components/hero-heatmap
  **OR Hero liquid metal** — https://www.cult-ui.com/docs/components/hero-liquid-metal
  - Idea: replace the animation's shape with the user's LOGO, with the related effects applied
    to the logo. Use only if the logo can carry the effect well.
- **Hover video player** — https://www.cult-ui.com/docs/components/hover-video-player
  - Idea: if we add a video, use this. Primary idea is a video; this is the fallback/alternative
    treatment for it.

## Open questions to resolve in brainstorming
- Scope/branching: do these go on the current `feature/cloudflare-foundation` branch, or a new
  `feature/ui-redesign` branch (merging the infra first)?
- Which inspiration sections are in-scope for THIS round vs. later? (card stack, stats, hero
  treatment, text animation, video) — prioritize.
- Logo assets: do we have light + dark variants of the logo? Where do they live? (drives #1, #2, #4)
- Component libraries: these references (cult-ui, chamaac, animate-ui, aicanvas) — are they
  installable packages, copy-paste components, or inspiration only? Constraint: must fit the
  shadcn + Tailwind + framer-motion stack already in place, and the artifact CSP / build.
- Logo constraint from earlier phase docs: there was a "logo preservation" constraint — verify.
