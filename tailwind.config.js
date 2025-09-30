/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'slate-750': '#2d3748',
        'slate-650': '#3d4a5e',
      }
    },
  },
  plugins: [],
}
