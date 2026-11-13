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
          DEFAULT: '#2563eb',
          dark: '#1d4ed8',
          light: '#60a5fa'
        },
        surface: {
          light: '#ffffff',
          dark: '#1e293b'
        },
        bg: {
          light: '#f8fafc',
          dark: '#0f172a'
        }
      }
    },
  },
  plugins: [],
}
