/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        clinic: {
          bg: "#F6F8F7",
          panel: "#FFFFFF",
          ink: "#10211C",
          teal: "#0E6E5C",
          tealDark: "#0A4F42",
          line: "#DCE6E2",
          amber: "#B6741A",
          red: "#B3261E",
          green: "#1E8E5A",
        },
      },
      fontFamily: {
        display: ["'IBM Plex Sans'", "sans-serif"],
        body: ["'Inter'", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
      borderRadius: {
        clinic: "10px",
      },
    },
  },
  plugins: [],
};
