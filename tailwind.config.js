/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#E84560',
          50: '#fdf2f5',
          100: '#fbe6ec',
          200: '#f8d0db',
          300: '#f2aabe',
          400: '#ea769a',
          500: '#E84560',
          600: '#d42d4a',
          700: '#b3203c',
          800: '#951d36',
          900: '#7e1d33',
        }
      }
    },
  },
  plugins: [],
}
