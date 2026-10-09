import type { Config } from "tailwindcss";

// هوية بصرية: كحلي + ذهبي (نفس رسوم باي) بدرجات ودودة
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f1f5fb", 100: "#dde7f5", 200: "#bfd2ec", 500: "#2c5a94",
          600: "#1d4577", 700: "#143560", 900: "#0A1D33",
        },
        gold: { 50: "#fbf7e8", 100: "#f5ecc6", 400: "#d9b64a", 500: "#C9A227", 600: "#B08D2E", 700: "#8a6d1f" },
        cream: "#f8f6f0",
      },
      fontFamily: { sans: ["Cairo", "Tajawal", "Segoe UI", "Tahoma", "system-ui", "sans-serif"] },
      boxShadow: { soft: "0 2px 12px rgba(10,29,51,0.06)" },
    },
  },
  plugins: [],
};

export default config;
