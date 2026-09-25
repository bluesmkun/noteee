import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

// 开发服务器把 /api 与 WebSocket 代理到一个现成的 hub：
// MONITOR_HUB=https://hub.example.com npm run dev
const hub = process.env.MONITOR_HUB || "http://127.0.0.1:9911"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": import.meta.dirname + "/src" } },
  build: { chunkSizeWarningLimit: 900 },
  server: { proxy: { "/api": { target: hub, changeOrigin: true, ws: true } } },
})
