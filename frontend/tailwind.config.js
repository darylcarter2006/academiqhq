/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        space: {
          950: '#020611',
          900: '#040a1c',
          800: '#070e24',
          700: '#0b152e',
          600: '#101d3e',
          500: '#16264e',
          400: '#1e3060',
          300: '#2a4080',
        },
        gold: {
          DEFAULT: '#e8a020',
          light: '#f5c050',
          bright: '#ffd060',
          dim: '#8c5e12',
        },
        arctic: {
          DEFAULT: '#5ec8f0',
          light: '#8edbf8',
          dim: '#2c88b8',
        },
        parchment: {
          DEFAULT: '#f0e8d5',
          dim: '#bfa870',
          muted: '#6a6050',
        },
      },
      fontFamily: {
        serif: ['"DM Serif Display"', 'Georgia', 'serif'],
        sans: ['Syne', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
}
