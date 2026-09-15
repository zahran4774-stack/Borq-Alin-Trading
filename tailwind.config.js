/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        navy: "#0A1D33",
        gold: "#C9A227",
        "gold-dark": "#B08D2E",
        cream: "#F7F5F0",
      },
      fontFamily: {
        cairo: ["Cairo", "Tahoma", "sans-serif"],
      },
    },
  },
  plugins: [],
};
