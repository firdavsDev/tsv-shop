import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

/** Needs the local Supabase stack: `npm run db:start` (Docker). */
export default defineConfig({
  resolve: { alias: { "@": r("./src"), "server-only": r("./test/empty.ts") } },
  test: {
    include: ["test/integration/**/*.test.ts"],
    setupFiles: ["test/integration/setup.ts"],
    environment: "node",
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
