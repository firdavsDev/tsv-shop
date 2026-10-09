import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": r("./src"),
      // 'server-only' throws outside the React server build; tests run server code directly.
      "server-only": r("./test/empty.ts"),
    },
  },
  test: { include: ["test/unit/**/*.test.ts"], environment: "node" },
});
