/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['Playfair Display', 'Georgia', 'serif'],
        arabic: ['Noto Sans Arabic', 'system-ui', 'sans-serif'],
      },
      colors: {
        primary: {
          DEFAULT: '#e63946',
          dark: '#c1121f',
          light: '#ff6b6b',
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'scale-in': 'scaleIn 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
    require('daisyui'),
  ],
  daisyui: {
    themes: [
      {
        portfolio: {
          "primary": "#e63946",
          "primary-content": "#ffffff",
          "secondary": "#1a1a1a",
          "secondary-content": "#ffffff",
          "accent": "#457b9d",
          "accent-content": "#ffffff",
          "neutral": "#333333",
          "neutral-content": "#f5f5f5",
          "base-100": "#ffffff",
          "base-200": "#fafafa",
          "base-300": "#f0f0f0",
          "base-content": "#1a1a1a",
          "info": "#3abff8",
          "success": "#36d399",
          "warning": "#fbbd23",
          "error": "#f87272",
        },
        dark: {
          "primary": "#e63946",
          "primary-content": "#ffffff",
          "secondary": "#f5f5f5",
          "secondary-content": "#1a1a1a",
          "accent": "#457b9d",
          "accent-content": "#ffffff",
          "neutral": "#f5f5f5",
          "neutral-content": "#1a1a1a",
          "base-100": "#1a1a1a",
          "base-200": "#252525",
          "base-300": "#333333",
          "base-content": "#f5f5f5",
          "info": "#3abff8",
          "success": "#36d399",
          "warning": "#fbbd23",
          "error": "#f87272",
        },
      },
    ],
    darkTheme: "dark",
  },
}
