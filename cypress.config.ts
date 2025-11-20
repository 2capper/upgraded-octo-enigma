import { defineConfig } from "cypress";
import { setupNodeEvents } from "./cypress/tasks/database";

export default defineConfig({
  e2e: {
    baseUrl: "http://localhost:5000",
    supportFile: "cypress/support/e2e.ts",
    specPattern: "cypress/e2e/**/*.cy.ts",
    setupNodeEvents,
    video: false,
    screenshotOnRunFailure: true,
    viewportWidth: 1280,
    viewportHeight: 720,
    defaultCommandTimeout: 10000,
    requestTimeout: 10000,
    responseTimeout: 10000,
  },
  env: {
    DATABASE_URL: process.env.DATABASE_URL,
  },
});
