import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  webServer: {
    command: "yarn dev --port 5173 --strictPort",
    url: "http://localhost:5173",
    reuseExistingServer: true,
  },
  use: { baseURL: "http://localhost:5173" },
});
