import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const gatewayPort = process.env.GATEWAY_PORT || "4300";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 4302,
    proxy: {
      "/api": {
        target: `http://localhost:${gatewayPort}`,
        changeOrigin: true,
      },
      "/ws": {
        target: `ws://localhost:${gatewayPort}`,
        ws: true,
      },
    },
  },
});
