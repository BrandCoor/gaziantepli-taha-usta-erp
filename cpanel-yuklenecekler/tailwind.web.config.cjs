/** Garson / QR menü / patron sayfaları için Tailwind yapılandırması (npm run build:web). */
module.exports = {
  content: [__dirname + '/garson/index.html', __dirname + '/menu/index.html', __dirname + '/patron/index.html'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
        serif: ['"Playfair Display"', 'serif'],
      },
      colors: {
        brand: { gold: '#F5C877', darkgold: '#D4A351', dark: '#141416', card: '#1C1C20', border: '#2C2C34' },
      },
    },
  },
  plugins: [],
};
