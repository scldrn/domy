import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import svgr from "vite-plugin-svgr";
import { routes } from "./src/routes.ts";

export default defineConfig({
  // One .env at the repository root; only VITE_* variables reach the browser.
  envDir: "../..",
  plugins: [
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
      virtualRouteConfig: routes,
      routesDirectory: "./src/routes",
      generatedRouteTree: "./src/route-tree.gen.ts",
    }),
    react(),
    tailwindcss(),
    svgr({
      svgrOptions: { dimensions: false, svgProps: { fill: "currentColor", "aria-hidden": "true" } },
    }),
    // The installable app (feature 003, research R2): the manifest and a service worker of our
    // own that keeps the app shell; it is active in the built app, not in development.
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      injectRegister: false,
      registerType: "prompt",
      // A classic worker (iife): what every supported phone runs, Safari included.
      injectManifest: {
        rollupFormat: "iife",
        globPatterns: ["**/*.{js,css,html,woff2,png,svg}"],
      },
      manifest: {
        name: "Domy",
        short_name: "Domy",
        description: "Rutas, entregas y seguimiento de envíos de Cohex.",
        lang: "es-CO",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        // The seed color and the paper of the light scheme (design-system.md §3).
        theme_color: "#34495E",
        background_color: "#EEEDF1",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/icons/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    proxy: {
      // T136: local API transport must not consume assertion budgets resolving a hostname.
      "/api": `http://127.0.0.1:${process.env["API_PORT"] ?? "3000"}`,
    },
  },
});
