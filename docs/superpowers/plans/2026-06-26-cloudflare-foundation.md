# Cloudflare Foundation (Faz 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the broken install, replace daisyUI with a shadcn-based design system, and stand up a Cloudflare Workers full-stack foundation (Hono API + D1 + R2) with automated GitHub Actions deploy — without breaking the existing site visually.

**Architecture:** A single Cloudflare Worker serves the React 19 SPA via the static-assets binding and handles `/api/*` via Hono (`run_worker_first`). D1 holds relational data (schema seeded now, CRUD later), R2 holds media. The frontend keeps its current structure; daisyUI is removed and its semantic color classes are remapped to shadcn CSS variables so existing markup keeps working with the new light(minimal-mono)/dark(editorial) themes.

**Tech Stack:** React 19, Vite 7, TypeScript, Tailwind v3, shadcn/ui, framer-motion, Hono, Cloudflare Workers/D1/R2, `@cloudflare/vite-plugin`, wrangler v4, vitest, npm.

## Global Constraints

- **React 19** — use native document metadata (`<title>`/`<meta>` rendered in components), NOT react-helmet.
- **Package manager: npm only** — `package-lock.json` is the single lockfile; no pnpm files.
- **No daisyUI** — package, plugin, and themes fully removed.
- **shadcn + Tailwind v3** — `darkMode: 'class'`; theming via CSS variables; do NOT upgrade to Tailwind v4.
- **Logo preserved** — `public/FURKANLOGO.png` stays and is reused; never deleted/renamed.
- **Wrangler v4.20+ and @cloudflare/vite-plugin v1.7+** (required for `run_worker_first` array form).
- **`compatibility_date`: "2026-06-25"** in `wrangler.jsonc`.
- **Deploy trigger: push to `main`** (existing default branch). Keep `master` in trigger list as fallback.
- **Resource names:** Worker `furkancicekli`, D1 `furkancicekli`, R2 bucket `furkancicekli-media`.
- **Site must not visually break** — colors may change to the new theme; layout/markup must remain intact. Full redesign is a later phase, out of scope here.
- **Path alias:** `@/*` → `src/*` (already configured in `vite.config.ts` and `tsconfig.app.json`).

---

### Task 1: Fix install — React 19 native metadata, drop react-helmet & pnpm

**Files:**
- Modify: `src/components/SEO.tsx` (rewrite — remove Helmet)
- Modify: `src/App.tsx` (remove HelmetProvider)
- Modify: `package.json` (remove `react-helmet-async` dependency)
- Delete: `pnpm-lock.yaml`, `pnpm-workspace.yaml`

**Interfaces:**
- Produces: `SEO` React component (same props: `title?`, `description?`, `image?`, `url?`, `type?`, `noindex?`) rendering plain metadata tags.

- [ ] **Step 1: Rewrite `src/components/SEO.tsx`** (React 19 hoists these tags into `<head>`; `<html lang/dir>` is handled via effect since React does not hoist `<html>` attributes)

```tsx
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { siteConfig } from '@/content/config'

interface SEOProps {
  title?: string
  description?: string
  image?: string
  url?: string
  type?: 'website' | 'article'
  noindex?: boolean
}

export function SEO({
  title,
  description,
  image = '/images/hero/1.jpeg',
  url,
  type = 'website',
  noindex = false,
}: SEOProps) {
  const { t, i18n } = useTranslation()

  const seoTitle = title || t('meta.title')
  const seoDescription = description || t('meta.description')
  const seoUrl = url || siteConfig.url
  const seoImage = image.startsWith('http') ? image : `${siteConfig.url}${image}`

  // React does not hoist <html> attributes; set lang/dir imperatively.
  useEffect(() => {
    document.documentElement.lang = i18n.language
    document.documentElement.dir = i18n.language === 'ar' ? 'rtl' : 'ltr'
  }, [i18n.language])

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: siteConfig.name,
    url: siteConfig.url,
    email: siteConfig.email,
    telephone: siteConfig.phone,
    jobTitle: t('hero.title'),
    description: seoDescription,
    image: seoImage,
    sameAs: [siteConfig.social.instagram, siteConfig.social.whatsapp].filter(Boolean),
  }

  return (
    <>
      <title>{seoTitle}</title>
      <meta name="description" content={seoDescription} />
      <meta name="keywords" content={t('meta.keywords')} />
      <link rel="canonical" href={seoUrl} />
      {noindex && <meta name="robots" content="noindex,nofollow" />}

      <meta property="og:type" content={type} />
      <meta property="og:title" content={seoTitle} />
      <meta property="og:description" content={seoDescription} />
      <meta property="og:image" content={seoImage} />
      <meta property="og:url" content={seoUrl} />
      <meta property="og:site_name" content={siteConfig.name} />
      <meta property="og:locale" content={i18n.language} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={seoTitle} />
      <meta name="twitter:description" content={seoDescription} />
      <meta name="twitter:image" content={seoImage} />

      <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
    </>
  )
}
```

- [ ] **Step 2: Update `src/App.tsx`** — remove HelmetProvider import and wrapper

```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from '@/components/layout'
import { HomePage, GalleryPage } from '@/pages'
import '@/i18n'

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/gallery" element={<GalleryPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}

export default App
```

- [ ] **Step 3: Remove the dependency and delete pnpm files**

```bash
npm pkg delete dependencies.react-helmet-async
rm -f pnpm-lock.yaml pnpm-workspace.yaml
rm -rf node_modules package-lock.json
npm install
```
Expected: install completes with NO `ERESOLVE`/react-helmet error; `package-lock.json` regenerated.

- [ ] **Step 4: Verify no references remain and build passes**

Run:
```bash
grep -rn "react-helmet\|HelmetProvider\|Helmet" src/ ; echo "exit:$?"
npm run build
```
Expected: grep prints nothing (exit:1 from grep = no matches); `npm run build` succeeds.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "fix: replace react-helmet-async with React 19 native metadata; drop pnpm lockfiles"
```

---

### Task 2: Remove daisyUI, install shadcn base + theme tokens

**Files:**
- Modify: `package.json` (remove `daisyui`; add `class-variance-authority`, `clsx`, `tailwind-merge`, `tailwindcss-animate`)
- Modify: `tailwind.config.js` (remove daisyUI; add `darkMode: 'class'`, CSS-variable colors incl. daisyUI-compat aliases, animate plugin)
- Modify: `src/styles/globals.css` (add `:root` + `.dark` CSS variables; base layer)
- Create: `components.json` (shadcn config)
- Create: `src/lib/utils.ts` (`cn` helper)
- Create: `src/components/ui/button.tsx` (shadcn Button)

**Interfaces:**
- Produces: `cn(...inputs)` from `@/lib/utils`; `Button` + `buttonVariants` from `@/components/ui/button` (variants: `default|destructive|outline|secondary|ghost|link`; sizes: `default|sm|lg|icon`).
- Produces: Tailwind color tokens — shadcn names (`background`, `foreground`, `card`, `primary`, `muted`, `border`, `ring`, …) AND daisyUI-compat aliases (`base-100`, `base-200`, `base-300`, `base-content`, `primary-content`, `secondary`, `accent`, `neutral`) all backed by CSS variables and alpha-aware.

- [ ] **Step 1: Swap dependencies**

```bash
npm uninstall daisyui
npm install class-variance-authority clsx tailwind-merge tailwindcss-animate
```

- [ ] **Step 2: Create `src/lib/utils.ts`**

```ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

- [ ] **Step 3: Replace `tailwind.config.js`**

```js
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['Playfair Display', 'Georgia', 'serif'],
        arabic: ['Noto Sans Arabic', 'system-ui', 'sans-serif'],
      },
      colors: {
        border: 'hsl(var(--border) / <alpha-value>)',
        input: 'hsl(var(--input) / <alpha-value>)',
        ring: 'hsl(var(--ring) / <alpha-value>)',
        background: 'hsl(var(--background) / <alpha-value>)',
        foreground: 'hsl(var(--foreground) / <alpha-value>)',
        primary: {
          DEFAULT: 'hsl(var(--primary) / <alpha-value>)',
          foreground: 'hsl(var(--primary-foreground) / <alpha-value>)',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary) / <alpha-value>)',
          foreground: 'hsl(var(--secondary-foreground) / <alpha-value>)',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted) / <alpha-value>)',
          foreground: 'hsl(var(--muted-foreground) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent) / <alpha-value>)',
          foreground: 'hsl(var(--accent-foreground) / <alpha-value>)',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive) / <alpha-value>)',
          foreground: 'hsl(var(--destructive-foreground) / <alpha-value>)',
        },
        card: {
          DEFAULT: 'hsl(var(--card) / <alpha-value>)',
          foreground: 'hsl(var(--card-foreground) / <alpha-value>)',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover) / <alpha-value>)',
          foreground: 'hsl(var(--popover-foreground) / <alpha-value>)',
        },
        // daisyUI-compat aliases so existing markup keeps working
        'base-100': 'hsl(var(--background) / <alpha-value>)',
        'base-200': 'hsl(var(--muted) / <alpha-value>)',
        'base-300': 'hsl(var(--border) / <alpha-value>)',
        'base-content': 'hsl(var(--foreground) / <alpha-value>)',
        'primary-content': 'hsl(var(--primary-foreground) / <alpha-value>)',
        'secondary-content': 'hsl(var(--secondary-foreground) / <alpha-value>)',
        'accent-content': 'hsl(var(--accent-foreground) / <alpha-value>)',
        neutral: 'hsl(var(--foreground) / <alpha-value>)',
        'neutral-content': 'hsl(var(--background) / <alpha-value>)',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
        'accordion-up': { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('@tailwindcss/typography'), require('tailwindcss-animate')],
}
```

- [ ] **Step 4: Replace the top of `src/styles/globals.css`** — keep the existing `@import` font line and the `@layer components` (`.container-custom`, `.section-padding`) and RTL rules; replace the `@tailwind` + base layer block with the version below (defines theme variables). After editing, the file's `@layer components` block from the original stays as-is.

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:wght@400;500;600;700&family=Noto+Sans+Arabic:wght@300;400;500;600;700&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 0 0% 9%;
    --card: 0 0% 100%;
    --card-foreground: 0 0% 9%;
    --popover: 0 0% 100%;
    --popover-foreground: 0 0% 9%;
    --primary: 0 0% 9%;
    --primary-foreground: 0 0% 98%;
    --secondary: 0 0% 96%;
    --secondary-foreground: 0 0% 9%;
    --muted: 0 0% 96%;
    --muted-foreground: 0 0% 40%;
    --accent: 0 0% 94%;
    --accent-foreground: 0 0% 9%;
    --destructive: 0 72% 51%;
    --destructive-foreground: 0 0% 98%;
    --border: 0 0% 89%;
    --input: 0 0% 89%;
    --ring: 0 0% 9%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 0 0% 4%;
    --foreground: 0 0% 96%;
    --card: 0 0% 6%;
    --card-foreground: 0 0% 96%;
    --popover: 0 0% 6%;
    --popover-foreground: 0 0% 96%;
    --primary: 0 0% 96%;
    --primary-foreground: 0 0% 9%;
    --secondary: 0 0% 14%;
    --secondary-foreground: 0 0% 96%;
    --muted: 0 0% 14%;
    --muted-foreground: 0 0% 64%;
    --accent: 0 0% 18%;
    --accent-foreground: 0 0% 96%;
    --destructive: 0 62% 45%;
    --destructive-foreground: 0 0% 98%;
    --border: 0 0% 16%;
    --input: 0 0% 16%;
    --ring: 0 0% 83%;
  }

  * {
    @apply border-border;
  }

  html {
    scroll-behavior: smooth;
  }

  body {
    @apply font-sans antialiased bg-background text-foreground;
  }

  [dir='rtl'] {
    font-family: 'Noto Sans Arabic', system-ui, sans-serif;
  }

  [dir='rtl'] .font-serif {
    font-family: 'Noto Sans Arabic', Georgia, serif;
  }
}

@layer components {
  .container-custom {
    @apply max-w-7xl mx-auto px-4 sm:px-6 lg:px-8;
  }

  .section-padding {
    @apply py-16 md:py-24;
  }
}
```

- [ ] **Step 5: Create `components.json`**

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.js",
    "css": "src/styles/globals.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
}
```

- [ ] **Step 6: Create `src/components/ui/button.tsx`** (shadcn Button)

```tsx
import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  },
)
Button.displayName = 'Button'

export { Button, buttonVariants }
```

- [ ] **Step 7: Install Radix Slot (Button dependency)**

```bash
npm install @radix-ui/react-slot
```

- [ ] **Step 8: Verify build passes**

Run:
```bash
grep -rn "daisyui\|data-theme" tailwind.config.js src/styles/globals.css ; echo "exit:$?"
npm run build
```
Expected: grep finds nothing (exit:1); build succeeds. (Component `btn`/`card-body` classes still in markup are handled in Task 3 — they currently render as no-ops, which is acceptable mid-task; the build does not fail.)

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: remove daisyUI, add shadcn base (tokens, cn, Button) with light/dark themes"
```

---

### Task 3: Convert daisyUI component classes to shadcn Button / Tailwind

**Files (modify):**
- `src/components/ui/ThemeSwitch.tsx`, `src/components/layout/Header.tsx`, `src/components/layout/Footer.tsx`, `src/components/sections/Hero.tsx`, `src/components/sections/GalleryPreview.tsx`, `src/components/sections/CraftSlider.tsx`, `src/components/sections/Testimonials.tsx`, `src/pages/GalleryPage.tsx`

**Interfaces:**
- Consumes: `Button` / `buttonVariants` from `@/components/ui/button`; `cn` from `@/lib/utils`.

Mapping rules (apply consistently):
- `btn btn-primary` (link/button) → `<Button asChild>` wrapping the `<Link>`/`<a>`, or `<Button>` for buttons.
- `btn btn-ghost btn-sm btn-square` / `btn btn-ghost btn-square` (icon button) → `<Button variant="ghost" size="icon">`.
- `btn btn-circle btn-primary` (slider arrows) → `<button className={cn(buttonVariants({ size: 'icon' }), 'rounded-full shadow-lg', <existing positioning classes>)}>` (keep positioning/`craft-slider-prev` hook classes).
- `btn btn-sm` + conditional `btn-primary`/`btn-ghost` (gallery filters) → `buttonVariants({ variant: active ? 'default' : 'ghost', size: 'sm' })`.
- `card-body` → `<div className="p-6">`.
- Hero secondary CTA `btn btn-ghost border-2 border-primary text-primary hover:bg-primary hover:text-white` → `<Button asChild variant="outline">`.

- [ ] **Step 1: ThemeSwitch buttons** — in `src/components/ui/ThemeSwitch.tsx`, import `Button` and replace both `<button className="btn btn-ghost btn-sm btn-square" ...>` occurrences with `<Button variant="ghost" size="icon" ...>` (keep `onClick`, `aria-label`, and icon children). (Theme logic itself is rewritten in Task 4 — only swap the button element here.)

- [ ] **Step 2: Header** — `src/components/layout/Header.tsx`:
  - line ~85 `className="btn btn-primary btn-sm"` (desktop CTA, a `<Link>`) → wrap with `<Button asChild size="sm"><Link ...>…</Link></Button>`.
  - line ~93 `className="md:hidden btn btn-ghost btn-square"` (menu toggle button) → `<Button variant="ghost" size="icon" className="md:hidden" ...>`.
  - line ~132 `className="btn btn-primary w-full"` (mobile CTA Link) → `<Button asChild className="w-full"><Link ...>…</Link></Button>`.
  Add `import { Button } from '@/components/ui/button'`.

- [ ] **Step 3: Footer** — `src/components/layout/Footer.tsx`: two social icon links `className="btn btn-ghost btn-sm btn-square"` → `<Button asChild variant="ghost" size="icon"><a ...>…</a></Button>`. Add Button import.

- [ ] **Step 4: Hero** — `src/components/sections/Hero.tsx`:
  - line ~54 `<Link to="/gallery" className="btn btn-primary">` → `<Button asChild><Link to="/gallery">…</Link></Button>`.
  - line ~62 `className="btn btn-ghost border-2 border-primary text-primary hover:bg-primary hover:text-white"` (a `<Link>`) → `<Button asChild variant="outline"><Link ...>…</Link></Button>`.
  Add Button import.

- [ ] **Step 5: GalleryPreview** — `src/components/sections/GalleryPreview.tsx` line ~51 `<Link to="/gallery" className="btn btn-primary">` → `<Button asChild><Link to="/gallery">…</Link></Button>`. Add Button import.

- [ ] **Step 6: CraftSlider arrows** — `src/components/sections/CraftSlider.tsx` lines ~94/~100: replace `className="craft-slider-prev absolute … btn btn-circle btn-primary shadow-lg"` with `className={cn(buttonVariants({ size: 'icon' }), 'craft-slider-prev absolute left-2 md:left-8 top-1/2 -translate-y-1/2 z-10 rounded-full shadow-lg')}` (and `craft-slider-next … right-2 md:right-8 …` for the next button). Add `import { buttonVariants } from '@/components/ui/button'` and `import { cn } from '@/lib/utils'`. Keep the `craft-slider-prev`/`craft-slider-next` classes (Swiper navigation hooks).

- [ ] **Step 7: Testimonials** — `src/components/sections/Testimonials.tsx` line ~39 `<div className="card-body">` → `<div className="p-6">`.

- [ ] **Step 8: GalleryPage filters** — `src/pages/GalleryPage.tsx` lines ~51-54: the filter buttons use `` `btn btn-sm ${active ? 'btn-primary' : 'btn-ghost'}` ``. Replace with `className={buttonVariants({ variant: cat === activeCategory ? 'default' : 'ghost', size: 'sm' })}` (use the existing active-category condition variable name from the file). Add `import { buttonVariants } from '@/components/ui/button'`.

- [ ] **Step 9: Verify no daisyUI component classes remain + build**

Run:
```bash
grep -rEn "\b(btn|btn-[a-z]+|card-body|card-title|badge|badge-[a-z]+)\b" src/ ; echo "exit:$?"
npm run build
```
Expected: grep finds nothing (exit:1); build succeeds.

- [ ] **Step 10: Manual visual check**

Run `npm run dev`, open the site. Confirm: buttons render (shadcn style), header/footer/hero/gallery/craft slider/testimonials all intact, no unstyled/broken controls.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "refactor: replace daisyUI btn/card classes with shadcn Button"
```

---

### Task 4: Class-based dark mode (light/dark toggle)

**Files:**
- Modify: `index.html` (inline pre-paint script: set `.dark` class from stored preference; remove `data-theme`)
- Modify: `src/components/ui/ThemeSwitch.tsx` (toggle `.dark`, store `'light'|'dark'`)

**Interfaces:**
- Produces: theme stored in `localStorage` under key `theme` with value `'light' | 'dark'`; `document.documentElement.classList` toggles `dark`.

- [ ] **Step 1: Update the inline script in `index.html`** — replace the existing IIFE that sets `data-theme` with:

```html
<script>
  (function () {
    try {
      var stored = localStorage.getItem('theme')
      var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      var theme = stored || (prefersDark ? 'dark' : 'light')
      if (theme === 'dark') document.documentElement.classList.add('dark')
    } catch (e) {}
  })()
</script>
```
Also remove `data-theme` from `<html ...>` if present (keep `lang="tr"`).

- [ ] **Step 2: Rewrite `src/components/ui/ThemeSwitch.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { Sun, Moon } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Theme = 'light' | 'dark'

export function ThemeSwitch() {
  const [theme, setTheme] = useState<Theme>('light')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const isDark = document.documentElement.classList.contains('dark')
    setTheme(isDark ? 'dark' : 'light')
    setMounted(true)
  }, [])

  const toggleTheme = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.classList.toggle('dark', next === 'dark')
    localStorage.setItem('theme', next)
  }

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" aria-label="Toggle theme">
        <Moon className="w-5 h-5" />
      </Button>
    )
  }

  return (
    <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
      {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
    </Button>
  )
}
```

- [ ] **Step 3: Verify build + manual toggle**

Run `npm run build` (expect success), then `npm run dev`: clicking the theme switch toggles light/editorial-dark; reload preserves choice; no flash of wrong theme on load.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: class-based light/dark theme toggle (replaces daisyUI data-theme)"
```

---

### Task 5: Cloudflare Vite plugin + Hono Worker + /api/health (TDD)

**Files:**
- Modify: `package.json` (add deps + scripts)
- Modify: `vite.config.ts` (add Cloudflare plugin)
- Create: `wrangler.jsonc` (assets binding + worker entry)
- Create: `src/worker/index.ts` (Hono app)
- Create: `src/worker/index.test.ts` (vitest)
- Create: `vitest.config.ts`
- Create: `tsconfig.worker.json`
- Modify: `tsconfig.json` (add worker project reference)

**Interfaces:**
- Produces: Hono `app` (default export) with `GET /api/health` → `200 {"status":"ok"}`; `Bindings` type `{ ASSETS: Fetcher; DB: D1Database; MEDIA: R2Bucket }` (DB/MEDIA wired in Tasks 6/7).

- [ ] **Step 1: Install dependencies**

```bash
npm install hono
npm install -D @cloudflare/vite-plugin wrangler @cloudflare/workers-types vitest
```
Note: ensure `wrangler` >= 4.20 and `@cloudflare/vite-plugin` >= 1.7 (`npm ls wrangler @cloudflare/vite-plugin`).

- [ ] **Step 2: Create `src/worker/index.ts`**

```ts
import { Hono } from 'hono'

export type Bindings = {
  ASSETS: Fetcher
  // DB and MEDIA are added in later tasks:
  // DB: D1Database
  // MEDIA: R2Bucket
}

const app = new Hono<{ Bindings: Bindings }>()

app.get('/api/health', (c) => c.json({ status: 'ok' }))

export default app
```

- [ ] **Step 3: Write the failing test `src/worker/index.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import app from './index'

describe('worker', () => {
  it('GET /api/health returns ok', async () => {
    const res = await app.request('/api/health')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'ok' })
  })
})
```

- [ ] **Step 4: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})
```

- [ ] **Step 5: Add the test script to `package.json`**

```bash
npm pkg set scripts.test="vitest run"
```

- [ ] **Step 6: Run the test to verify it passes** (the app already exists, so this confirms wiring)

Run: `npm test`
Expected: 1 passed (`GET /api/health returns ok`).

- [ ] **Step 7: Create `wrangler.jsonc`**

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "furkancicekli",
  "compatibility_date": "2026-06-25",
  "main": "./src/worker/index.ts",
  "assets": {
    "directory": "./dist/client",
    "binding": "ASSETS",
    "not_found_handling": "single-page-application",
    "run_worker_first": ["/api/*"]
  },
  "observability": { "enabled": true }
}
```

- [ ] **Step 8: Add the Cloudflare plugin to `vite.config.ts`** (place AFTER react; remove the manual `build.outDir` since the plugin manages output)

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import mdx from '@mdx-js/rollup'
import { cloudflare } from '@cloudflare/vite-plugin'
import path from 'path'

export default defineConfig({
  plugins: [
    { enforce: 'pre', ...mdx() },
    react({ include: /\.(jsx|js|mdx|md|tsx|ts)$/ }),
    cloudflare(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@content': path.resolve(__dirname, './src/content'),
      '@i18n': path.resolve(__dirname, './src/i18n'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@utils': path.resolve(__dirname, './src/utils'),
    },
  },
})
```

- [ ] **Step 9: Create `tsconfig.worker.json`** (worker types for tsc -b)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "types": ["@cloudflare/workers-types"],
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src/worker"]
}
```

- [ ] **Step 10: Reference the worker tsconfig in `tsconfig.json`** — add `{ "path": "./tsconfig.worker.json" }` to the `references` array (alongside the existing app/node references). If `tsconfig.json` only has `files: []` + references, append the new reference.

- [ ] **Step 11: Generate Cloudflare types**

```bash
npx wrangler types
```
Expected: creates `worker-configuration.d.ts`. Add it to `.gitignore` (it is regenerated).

- [ ] **Step 12: Verify build + dev server + health route**

Run:
```bash
npm run build
```
Expected: build succeeds AND produces `dist/client/` (the assets dir referenced in `wrangler.jsonc`). If the client output path differs, set `wrangler.jsonc` `assets.directory` to the actual path printed by the build.

Then run `npm run dev` and in another shell:
```bash
curl -s localhost:5173/api/health
```
Expected: `{"status":"ok"}`. Also confirm the SPA still loads in the browser at `/`.

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "feat: add Cloudflare Vite plugin + Hono worker with /api/health"
```

---

### Task 6: D1 database + initial schema migration

**Files:**
- Modify: `wrangler.jsonc` (add `d1_databases`)
- Modify: `src/worker/index.ts` (add `DB` to `Bindings`)
- Create: `migrations/0001_init.sql`
- Modify: `package.json` (db migrate scripts)

**Interfaces:**
- Produces: D1 binding `DB`; tables `admin_users`, `sessions`, `products`, `product_translations`, `product_media`, `process_steps`, `process_step_translations`, `faqs`, `faq_translations`, `certificates`, `settings`.

- [ ] **Step 1: USER ACTION — authenticate and create the D1 database**

Run (interactive; the user runs these or authorizes them):
```bash
npx wrangler login
npx wrangler d1 create furkancicekli
```
Copy the printed `database_id`.

- [ ] **Step 2: Add the D1 binding to `wrangler.jsonc`** (insert into the top-level object)

```jsonc
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "furkancicekli",
      "database_id": "PASTE_DATABASE_ID_HERE",
      "migrations_dir": "./migrations"
    }
  ],
```

- [ ] **Step 3: Create `migrations/0001_init.sql`**

```sql
-- Admin users (auth implemented in a later phase)
CREATE TABLE admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  serial_no TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','sold')),
  material TEXT,
  size TEXT,
  price INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE product_translations (
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  lang TEXT NOT NULL CHECK (lang IN ('tr','en','ar')),
  name TEXT,
  description TEXT,
  story TEXT,
  PRIMARY KEY (product_id, lang)
);

CREATE TABLE product_media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('image','video')),
  r2_key TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'gallery' CHECK (kind IN ('gallery','raw_material','process')),
  sort INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE process_steps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sort INTEGER NOT NULL DEFAULT 0,
  image_r2_key TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE process_step_translations (
  step_id INTEGER NOT NULL REFERENCES process_steps(id) ON DELETE CASCADE,
  lang TEXT NOT NULL CHECK (lang IN ('tr','en','ar')),
  text TEXT,
  PRIMARY KEY (step_id, lang)
);

CREATE TABLE faqs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sort INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE faq_translations (
  faq_id INTEGER NOT NULL REFERENCES faqs(id) ON DELETE CASCADE,
  lang TEXT NOT NULL CHECK (lang IN ('tr','en','ar')),
  question TEXT,
  answer TEXT,
  PRIMARY KEY (faq_id, lang)
);

CREATE TABLE certificates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  serial_no TEXT NOT NULL,
  qr_token TEXT NOT NULL UNIQUE,
  buyer_name TEXT,
  issued_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_product_media_product ON product_media(product_id);
CREATE INDEX idx_certificates_qr ON certificates(qr_token);
```

- [ ] **Step 4: Add the `DB` binding type** in `src/worker/index.ts` — uncomment/add `DB: D1Database` in the `Bindings` type.

- [ ] **Step 5: Add migrate scripts to `package.json`**

```bash
npm pkg set scripts.db:migrate:local="wrangler d1 migrations apply furkancicekli --local"
npm pkg set scripts.db:migrate="wrangler d1 migrations apply furkancicekli --remote"
```

- [ ] **Step 6: Apply migrations locally and verify**

Run:
```bash
npm run db:migrate:local
npx wrangler d1 execute furkancicekli --local --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
```
Expected: migration applies; the SELECT lists all 11 tables.

- [ ] **Step 7: Apply migrations to remote D1** (USER ACTION / authorized)

```bash
npm run db:migrate
```
Expected: remote migration applied.

- [ ] **Step 8: Verify worker still builds/tests**

Run: `npm test && npm run build`
Expected: pass.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: add D1 database binding and initial schema migration"
```

---

### Task 7: R2 bucket + seed existing images

**Files:**
- Modify: `wrangler.jsonc` (add `r2_buckets`)
- Modify: `src/worker/index.ts` (add `MEDIA` to `Bindings`)
- Create: `scripts/seed-r2.sh`

**Interfaces:**
- Produces: R2 binding `MEDIA`; bucket `furkancicekli-media` seeded with existing content images under keys `gallery/*`, `about/*`, `hero/*`, `misc/*`.

- [ ] **Step 1: USER ACTION — create the R2 bucket**

```bash
npx wrangler r2 bucket create furkancicekli-media
```

- [ ] **Step 2: Add the R2 binding to `wrangler.jsonc`**

```jsonc
  "r2_buckets": [
    { "binding": "MEDIA", "bucket_name": "furkancicekli-media" }
  ],
```

- [ ] **Step 3: Add `MEDIA: R2Bucket`** to the `Bindings` type in `src/worker/index.ts`.

- [ ] **Step 4: Create `scripts/seed-r2.sh`** (uploads content images; keeps the originals in `public/` untouched)

```bash
#!/usr/bin/env bash
set -euo pipefail
BUCKET="furkancicekli-media"

put() {
  local file="$1" key="$2"
  echo "→ $key"
  npx wrangler r2 object put "$BUCKET/$key" --file "$file" --remote
}

# Gallery
for f in public/images/gallery/*.jpg; do
  [ -e "$f" ] || continue
  put "$f" "gallery/$(basename "$f")"
done

# About
for f in public/images/about/*.jpeg; do
  [ -e "$f" ] || continue
  put "$f" "about/$(basename "$f")"
done

# Hero
for f in public/images/hero/*.jpeg; do
  [ -e "$f" ] || continue
  put "$f" "hero/$(basename "$f")"
done

# Misc (profile + example)
for f in public/images/pp1.jpeg public/images/pp2.jpeg public/images/example.jpeg; do
  [ -e "$f" ] || continue
  put "$f" "misc/$(basename "$f")"
done

echo "Seed complete."
```

- [ ] **Step 5: Make executable and add a script entry**

```bash
chmod +x scripts/seed-r2.sh
npm pkg set scripts.seed:r2="bash scripts/seed-r2.sh"
```

- [ ] **Step 6: USER ACTION — run the seed and verify**

```bash
npm run seed:r2
npx wrangler r2 object get "furkancicekli-media/gallery/craft-1.jpg" --remote --pipe > /dev/null && echo "OK gallery/craft-1.jpg"
```
Expected: uploads succeed; the verify line prints `OK gallery/craft-1.jpg`. (README.md files inside image folders are intentionally skipped by the `*.jpg`/`*.jpeg` globs.)

- [ ] **Step 7: Verify worker still builds/tests**

Run: `npm test && npm run build`
Expected: pass.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add R2 media bucket binding and image seed script"
```

---

### Task 8: GitHub Actions deploy to Cloudflare (replace gh-pages)

**Files:**
- Replace: `.github/workflows/deploy.yml`
- Modify: `package.json` (scripts: `deploy` → wrangler; remove `predeploy`; remove `gh-pages` devDependency if present)

**Interfaces:**
- Produces: CI that, on push to `main`/`master`, builds, applies remote D1 migrations, and runs `wrangler deploy`.

- [ ] **Step 1: Replace `.github/workflows/deploy.yml`**

```yaml
name: Deploy to Cloudflare

on:
  push:
    branches: [main, master]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Apply D1 migrations
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: d1 migrations apply furkancicekli --remote

      - name: Deploy
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: deploy
```

- [ ] **Step 2: Update `package.json` scripts**

```bash
npm pkg delete scripts.predeploy
npm pkg set scripts.deploy="wrangler deploy"
npm pkg delete devDependencies.gh-pages 2>/dev/null || true
```
Then run `npm install` to sync the lockfile after removing gh-pages.

- [ ] **Step 3: USER ACTION — add GitHub repository secrets**

In GitHub repo → Settings → Secrets and variables → Actions, add:
- `CLOUDFLARE_API_TOKEN` — a token with "Edit Cloudflare Workers" + D1 + R2 edit permissions.
- `CLOUDFLARE_ACCOUNT_ID` — the account ID from the Cloudflare dashboard.

- [ ] **Step 4: Validate the workflow YAML locally**

Run:
```bash
npx --yes js-yaml .github/workflows/deploy.yml > /dev/null && echo "YAML OK"
```
Expected: `YAML OK`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "ci: deploy to Cloudflare Workers on push (replace gh-pages)"
```

- [ ] **Step 6: USER ACTION — first deploy verification** (after merge to `main`)

After the PR merges to `main`, watch the Actions run. Once green, verify the deployed Worker:
```bash
curl -s https://furkancicekli.<account>.workers.dev/api/health
```
Expected: `{"status":"ok"}` and the SPA loads. (Custom domain `furkancicekli.com` cutover is a separate, user-approved step — not part of this plan.)

---

## Notes on Scope & Sequencing

- Tasks 1–4 are local frontend work (no Cloudflare account needed). Tasks 5–8 introduce the Worker/infra and include **USER ACTION** steps (wrangler login, resource creation, GitHub secrets) — these require the user's Cloudflare account.
- The public site continues serving images from `/public` in this phase. Switching reads to R2/D1 happens in the content-management phase.
- `worker-configuration.d.ts` (from `wrangler types`) is generated and gitignored.

## Self-Review

- **Spec coverage:** §2.1 install/helmet/lockfile/daisyUI → Tasks 1–2; §2.2 shadcn/tokens/ThemeSwitch → Tasks 2–4; §2.3 vite plugin/wrangler/worker/health/D1/R2 → Tasks 5–7; §2.4 R2 seed (content vs public split) → Task 7; §2.5 GitHub Actions/scripts/domain note → Task 8. UI refs/typography (§4/§5) are explicitly later-phase, no Phase-1 task needed.
- **Placeholder scan:** `PASTE_DATABASE_ID_HERE` (Task 6) is a real value the user fills from `wrangler d1 create` output, not a plan gap; `<account>` in Task 8 verify is the user's workers.dev subdomain. No TODO/TBD steps.
- **Type consistency:** `Bindings` (`ASSETS`/`DB`/`MEDIA`) consistent across Tasks 5–7; `Button`/`buttonVariants`/`cn` consistent across Tasks 2–4; theme key `theme`=`'light'|'dark'` consistent across Task 4 index.html + ThemeSwitch.
