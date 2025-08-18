import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default ({ mode }) => {
  // Load VITE_* env vars (e.g. VITE_API_BASE_URL)
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const apiBase = env.VITE_API_BASE_URL || "http://localhost:8000";

  return defineConfig({
    plugins: [react()],
    base: "/",
    server: {
      proxy: {
        "/api": {
          target: apiBase,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, "/api"),
        },
      },
    },
    build: {
      outDir: "../static/",
      emptyOutDir: true,
    },
  });
};
