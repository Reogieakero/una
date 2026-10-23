import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["rls.test.ts"],
    // A local Supabase instance is shared by every case; run sequentially.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
