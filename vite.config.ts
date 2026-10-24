import react from "@vitejs/plugin-react";
import process from "node:process";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

// The browser only ever talks to its own origin: in development Vite forwards /api to the API server, and in
// production a reverse proxy (see README) does the same. That keeps the session cookie first-party and means
// the API needs no cross-origin setup beyond FRONTEND_URL.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const backendUrl = env.VITE_API_URL || process.env.VITE_API_URL || "http://localhost:4000";
  const api = { "/api": { target: backendUrl, changeOrigin: true } };

  return {
    plugins: [react()],
    server: { port: 3000, strictPort: true, proxy: api },
    preview: { port: 3000, strictPort: true, proxy: api },
    build: { sourcemap: true },
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: ["./src/test/setup.ts"],
      css: false,
      restoreMocks: true,
    },
  };
});
