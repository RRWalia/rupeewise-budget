import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

const SEARCH_CONSOLE_META_NAME = "google-site-verification";

function escapeHtmlAttribute(value: string) {
  const entities: Record<string, string> = {
    "&": "&amp;",
    '"': "&quot;",
    "'": "&#39;",
    "<": "&lt;",
    ">": "&gt;",
  };

  return value.replace(/[&"'<>]/g, (character) => entities[character]);
}

function searchConsoleVerificationPlugin(token?: string): Plugin {
  const verificationToken = token?.trim();
  if (!verificationToken) return { name: "google-search-console-verification" };

  const metaTag = `<meta name="${SEARCH_CONSOLE_META_NAME}" content="${escapeHtmlAttribute(verificationToken)}" />`;
  const existingTag = /<meta\b(?=[^>]*\bname=["']google-site-verification["'])[^>]*>/i;

  return {
    name: "google-search-console-verification",
    transformIndexHtml(html) {
      if (existingTag.test(html)) return html.replace(existingTag, metaTag);
      return html.replace("</head>", `    ${metaTag}\n  </head>`);
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");

  return {
    server: {
      host: "0.0.0.0",
      allowedHosts: true,
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
    plugins: [
      react(),
      searchConsoleVerificationPlugin(env.VITE_GOOGLE_SITE_VERIFICATION),
      mode === "development" && componentTagger(),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
