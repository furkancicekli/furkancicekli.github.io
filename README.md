# Furkan Cicekli Portfolio

Modern, responsive portfolio website built with React, Vite, and DaisyUI.

## Features

- **React + Vite** - Fast development and optimized production builds
- **DaisyUI + Tailwind CSS** - Beautiful, customizable UI components
- **i18n Support** - Turkish, English, and Arabic languages with RTL support
- **SEO Optimized** - Meta tags, Open Graph, Twitter Cards, and structured data
- **MDX Ready** - Easy content management with MDX files
- **Responsive Design** - Mobile-first approach with smooth animations
- **Dark Mode** - Automatic theme switching

## Tech Stack

- React 19
- Vite 7
- TypeScript
- Tailwind CSS 3
- DaisyUI 5
- Framer Motion
- i18next
- React Router

## Getting Started

### Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

### Production Build

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

## Project Structure

```
src/
├── components/
│   ├── layout/       # Header, Footer, Layout
│   ├── sections/     # Hero, About, Gallery, etc.
│   └── ui/           # Reusable UI components
├── content/
│   ├── projects.ts   # Projects data
│   ├── testimonials.ts
│   └── config.ts     # Site configuration
├── i18n/
│   └── locales/      # Translation files (tr, en, ar)
├── pages/            # Page components
├── styles/           # Global styles
└── types/            # TypeScript types
```

## Adding New Content

### Adding a New Project

Edit `src/content/projects.ts`:

```typescript
{
  id: '7',
  slug: 'new-project',
  title: {
    tr: 'Yeni Proje',
    en: 'New Project',
    ar: 'مشروع جديد',
  },
  description: {
    tr: 'Proje aciklamasi',
    en: 'Project description',
    ar: 'وصف المشروع',
  },
  category: 'amber', // amber | kuka | oltu | other
  cover: '/images/gallery/7.jpeg',
  images: ['/images/gallery/7.jpeg'],
  date: '2024-01-20',
  featured: true, // Show on homepage
}
```

### Adding Images

1. Add image to `public/images/gallery/`
2. Update the project data in `src/content/projects.ts`

### Updating Translations

Edit files in `src/i18n/locales/`:
- `tr.json` - Turkish
- `en.json` - English
- `ar.json` - Arabic

## Configuration

### Site Config

Edit `src/content/config.ts`:

```typescript
export const siteConfig = {
  name: 'Your Name',
  email: 'your@email.com',
  phone: '+90...',
  // ...
}
```

### Theme Colors

Edit `tailwind.config.js`:

```javascript
daisyui: {
  themes: [
    {
      portfolio: {
        primary: '#e63946',
        // ...
      }
    }
  ]
}
```

## Deployment

The site is configured for GitHub Pages deployment:

```bash
npm run build
```

Then push the `dist` folder to GitHub Pages or use:

```bash
npm run deploy
```

## License

All rights reserved.
