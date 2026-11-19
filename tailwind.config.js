/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter Variable"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk Variable"', '"Inter Variable"', 'ui-sans-serif', 'sans-serif'],
      },
      colors: {
        bg: '#F4F5F1',
        surface: '#FFFFFF',
        ink: '#0F1712',
        muted: '#5B655E',
        line: '#E3E6E0',
        lime: '#C6F432',
        pitch: '#0B1A12',
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(.34,1.56,.64,1)',
        out: 'cubic-bezier(.22,1,.36,1)',
      },
    },
  },
  plugins: [],
};
