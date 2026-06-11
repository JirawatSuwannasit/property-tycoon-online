import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        pixel: {
          ink: "#2b1f3a",
          paper: "#fff7df",
          cream: "#fff2cc",
          mint: "#b8f2d0",
          sky: "#a0d8ff",
          coral: "#ff9aa2",
          lavender: "#cdb4db",
          gold: "#ffd166",
          leaf: "#7bd88f",
        },
      },
      boxShadow: {
        pixel: "4px 4px 0 #2b1f3a",
        "pixel-lg": "8px 8px 0 #2b1f3a",
      },
      fontFamily: {
        pixel: [
          "var(--font-pixel)",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "Liberation Mono",
          "Courier New",
          "monospace",
        ],
      },
    },
  },
};

export default config;
