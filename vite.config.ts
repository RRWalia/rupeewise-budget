import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "0.0.0.0",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;

          const normalizedId = id.replace(/\\/g, "/");
          if (
            normalizedId.includes("/node_modules/react/") ||
            normalizedId.includes("/node_modules/react-dom/") ||
            normalizedId.includes("/node_modules/scheduler/")
          ) {
            return "react-vendor";
          }
          if (normalizedId.includes("/node_modules/@supabase/")) return "supabase";
          if (
            normalizedId.includes("/node_modules/recharts/") ||
            normalizedId.includes("/node_modules/d3-") ||
            normalizedId.includes("/node_modules/victory-vendor/")
          ) {
            return "charts";
          }
          if (normalizedId.includes("/node_modules/@radix-ui/")) return "radix-ui";
          if (normalizedId.includes("/node_modules/framer-motion/")) return "motion";
          return "vendor";
        },
      },
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
