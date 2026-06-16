/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#eff6ff',
          100: '#dbeafe',
          500: '#0055ff',
          600: '#0040cc',
          700: '#0030a0',
        },
      },
    },
  },
  plugins: [],
};
