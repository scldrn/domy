import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv, type IndexHtmlTransformContext } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import svgr from "vite-plugin-svgr";
import { publicOriginSchema } from "@domy/domain";
import { routes } from "./src/routes.ts";

type BundleChunk = Extract<
  NonNullable<IndexHtmlTransformContext["bundle"]>[string],
  { type: "chunk" }
>;

const appModuleId = fileURLToPath(new URL("./src/app.tsx", import.meta.url));

export default defineConfig(({ mode }) => ({
  // One .env at the repository root; only VITE_* variables reach the browser.
  envDir: "../..",
  plugins: [
    {
      name: "domy-public-base-url",
      config(config) {
        const source =
          config.envDir === false
            ? process.env
            : loadEnv(mode, resolve(config.root ?? process.cwd(), config.envDir ?? "."), [
                "PUBLIC_BASE_URL",
                "APP_URL",
              ]);
        const configuredOrigin = source["PUBLIC_BASE_URL"] || source["APP_URL"];
        let publicOrigin: string;
        try {
          publicOrigin = publicOriginSchema.parse(configuredOrigin || "http://localhost:5173");
        } catch {
          throw new Error("PUBLIC_BASE_URL or APP_URL must be a bare HTTP(S) origin");
        }
        return { define: { "import.meta.env.PUBLIC_BASE_URL": JSON.stringify(publicOrigin) } };
      },
    },
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
    {
      name: "domy-preload-app-bootstrap",
      apply: "build",
      transformIndexHtml: {
        order: "post",
        handler(_html, { bundle }) {
          const chunks = Object.values(bundle ?? {}).filter(
            (output): output is BundleChunk => output.type === "chunk",
          );
          const appChunk = chunks.find((chunk) => chunk.facadeModuleId === appModuleId);
          if (!appChunk) {
            throw new Error("Vite build did not emit the expected app bootstrap chunk");
          }
          const chunksByFileName = new Map(chunks.map((chunk) => [chunk.fileName, chunk]));
          const preloadedFileNames = new Set<string>();
          const visitStaticImports = (chunk: BundleChunk): void => {
            if (preloadedFileNames.has(chunk.fileName)) return;
            preloadedFileNames.add(chunk.fileName);
            for (const fileName of chunk.imports) {
              const importedChunk = chunksByFileName.get(fileName);
              if (importedChunk) visitStaticImports(importedChunk);
            }
          };
          visitStaticImports(appChunk);
          return [...preloadedFileNames].map((fileName) => ({
            tag: "link",
            attrs: { rel: "modulepreload", href: `/${fileName}`, crossorigin: true },
            injectTo: "head-prepend",
          }));
        },
      },
    },
  ],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    proxy: {
      "/api": `http://127.0.0.1:${process.env["API_PORT"] ?? "3000"}`,
    },
  },
}));
