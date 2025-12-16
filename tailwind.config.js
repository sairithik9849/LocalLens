// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Primary Theme (Orange)
        primary: {
          DEFAULT: '#e48a04',
          hover: '#c77603',
          light: '#f39c12',
          50: '#fef8f1',
          100: '#fdecd6',
          200: '#fbd6ab',
          300: '#f8ba75',
          400: '#f39c12',
          500: '#e48a04',
          600: '#c77603',
          700: '#a55f02',
          800: '#874d02',
          900: '#6d3e01',
        },
        // Secondary Theme (Green)
        secondary: {
          DEFAULT: '#27ae60',
          hover: '#229954',
          light: '#2ecc71',
          50: '#f0fdf5',
          100: '#dcfce8',
          200: '#bbf7d1',
          300: '#86efac',
          400: '#4ade80',
          500: '#27ae60',
          600: '#229954',
          700: '#1d8348',
          800: '#18693d',
          900: '#145632',
        },
      },
    },
  },
  plugins: [],
}