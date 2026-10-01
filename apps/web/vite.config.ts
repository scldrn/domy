import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
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
  ],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    proxy: {
      "/api": `http://localhost:${process.env["API_PORT"] ?? "3000"}`,
    },
  },
});
