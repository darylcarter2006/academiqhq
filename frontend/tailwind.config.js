/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#080d17',
          900: '#0d1117',
          800: '#111827',
          700: '#161b27',
          600: '#1e2533',
          500: '#252d3d',
          400: '#2a3145',
          300: '#3d4a6a',
        },
        gold: {
          DEFAULT: '#c9963a',
          light: '#e8b455',
          dim: '#8a6220',
        },
        parchment: {
          DEFAULT: '#e8dfc8',
          dim: '#c4b896',
          muted: '#8a7d60',
        },
      },
      fontFamily: {
        serif: ['"DM Serif Display"', 'Georgia', 'serif'],
        sans: ['Outfit', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
