import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // "prompt": ein Update zerschießt nie eine laufende Spielsession.
      registerType: "prompt",
      manifest: {
        name: "Codex35 — D&D 3.5 Charaktere",
        short_name: "Codex35",
        description: "D&D 3.5 Charakter-Manager mit Homebrew-Kompendium",
        lang: "de",
        display: "standalone",
        background_color: "#0f172a",
        theme_color: "#0f172a",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ],
      },
      workbox: {
        // SRD-Packs (JSON-Assets) mit precachen — die App ist offline komplett.
        globPatterns: ["**/*.{js,css,html,ico,png,svg,json,woff2}"],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
  build: {
    chunkSizeWarningLimit: 900,
  },
});
