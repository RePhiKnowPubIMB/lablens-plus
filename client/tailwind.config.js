/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#eef7ff",
          100: "#d9edff",
          200: "#bce0ff",
          300: "#8ecdff",
          400: "#59b1ff",
          500: "#338fff",
          600: "#1a6ff5",
          700: "#145ae1",
          800: "#1749b6",
          900: "#19408f",
          950: "#142957",
        },
        accent: {
          50: "#f0fdfa",
          100: "#ccfbef",
          200: "#99f6e0",
          300: "#5fe9cd",
          400: "#2dd4b5",
          500: "#14b89c",
          600: "#0d9480",
          700: "#0f7668",
          800: "#115e54",
          900: "#134e46",
          950: "#042f2b",
        },
      },
      fontFamily: {
        sans: ['"Inter"', "system-ui", "-apple-system", "sans-serif"],
        bengali: ['"Noto Sans Bengali"', '"Hind Siliguri"', "sans-serif"],
      },
    },
  },
  plugins: [],
};
