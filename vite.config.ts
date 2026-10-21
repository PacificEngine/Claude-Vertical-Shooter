import { defineConfig } from "vitest/config";

// GitHub Pages serves this repo from /Claude-Vertical-Shooter/. The production
// build (and `vite preview` of it) needs that prefix; dev and the e2e tests
// keep serving "/".
export default defineConfig(({ command, isPreview }) => ({
  base: command === "build" || isPreview ? "/Claude-Vertical-Shooter/" : "/",
  test: { include: ["src/**/*.test.ts"] },
}));
