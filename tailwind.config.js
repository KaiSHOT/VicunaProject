/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        vicuna: {
          bg: "#5C9350",
          panel: "#2F4F28",
          "panel-border": "#4D6F42",
          board: {
            light: "#70A664",
            DEFAULT: "#5C9350",
            dark: "#4A7A3D",
          },
          accent: {
            light: "#E7BE70",
            DEFAULT: "#D9A544",
            dark: "#B8842E",
            ink: "#3C2E14",
          },
          risk: {
            light: "#D8AAB2",
            DEFAULT: "#C4576B",
            dark: "#9C4054",
            ink: "#4A1B28",
          },
          info: {
            light: "#6BBCB0",
            DEFAULT: "#3E9C8F",
            dark: "#2E7A6F",
          },
          cream: {
            DEFAULT: "#F3E9D2",
            border: "#B8A67C",
          },
          blush: {
            DEFAULT: "#F6E3E6",
            border: "#D8AAB2",
          },
          text: {
            primary: "#F2EFE7",
            secondary: "#D9E4D0",
            muted: "#ABC29E",
          },
        },
      },
    },
  },
  plugins: [],
};
