/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        taha: {
          gold: '#F5C877',
          'gold-dark': '#D4A351',
          'gold-light': '#FDF3DF',
          'gold-muted': 'rgba(245, 200, 119, 0.15)',
          dark: '#141416',
          card: '#1C1C20',
          'card-hover': '#24242A',
          border: '#2E2E36',
          muted: '#8E8E98',
        }
      }
    },
  },
  plugins: [],
}