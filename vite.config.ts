import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
// base = '/patrimoine/' en build pour GitHub Pages (https://<user>.github.io/patrimoine/)
export default defineConfig(({ command }) => ({
  base: command === "build" ? "/patrimoine/" : "/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "Patrimoine",
        short_name: "Patrimoine",
        description: "Suivi de patrimoine et de collection",
        lang: "fr",
        theme_color: "#0e1116",
        background_color: "#0e1116",
        display: "standalone",
        icons: [
          {
            src: "favicon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any",
          },
        ],
      },
    }),
  ],
}));
