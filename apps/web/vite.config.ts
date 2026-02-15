import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 4302,
    proxy: {
      "/api": {
        target: "http://localhost:4300",
        changeOrigin: true,
      },
      "/ws": {
        target: "ws://localhost:4300",
        ws: true,
      },
    },
  },
});
