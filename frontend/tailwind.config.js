import typography from "@tailwindcss/typography";

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: "#FDFCF8",
        paper: "#FFFFFF",
        primary: "#c8b631", // A nice burnt orange/red for highlights
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Outfit', 'sans-serif'],
        handwriting: ['Caveat', 'cursive'],
      }
    },
  },
  plugins: [
    typography,
  ],
};