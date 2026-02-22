import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const backendTarget = env.VITE_BACKEND_TARGET || "http://127.0.0.1:4000";

  return {
    plugins: [react()],
    server: {
      host: "0.0.0.0",
      port: 5173,
      strictPort: true,
      open: true,
      proxy: {
        "/auth": { target: backendTarget, changeOrigin: true },
        "/api": { target: backendTarget, changeOrigin: true },
        "/live": { target: backendTarget, changeOrigin: true },
        "/ready": { target: backendTarget, changeOrigin: true },
        "/health": { target: backendTarget, changeOrigin: true }
      }
    }
  };
});
