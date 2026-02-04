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
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
    require('daisyui'),
  ],
  daisyui: {
    themes: [
      {
        corporate: {
          "primary": "#4f46e5",
          "primary-content": "#ffffff",
          "secondary": "#7c3aed",
          "secondary-content": "#ffffff",
          "accent": "#f59e0b",
          "accent-content": "#000000",
          "neutral": "#1f2937",
          "neutral-content": "#ffffff",
          "base-100": "#ffffff",
          "base-200": "#f9fafb",
          "base-300": "#e5e7eb",
          "base-content": "#1f2937",
          "info": "#3b82f6",
          "success": "#22c55e",
          "warning": "#f59e0b",
          "error": "#ef4444",
        },
      },
      "business",
    ],
    darkTheme: "business",
  },
}
