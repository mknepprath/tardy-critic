import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    remix({
      ignoredRouteFiles: ["**/.*"],
    }),
  ],
  ssr: {
    noExternal: ["@remix-run/node", "@remix-run/server-runtime"],
  },
});
