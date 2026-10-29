import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.e2e" });

export default defineConfig({
    testDir: "./tests/e2e",

    fullyParallel: true,

    use: {
        baseURL: "http://localhost:3000",
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
    },

    projects: [
        {
            name: "setup",
            testMatch: /auth\.setup\.ts/,
        },
        {
            name: "player-a",
            use: {
                ...devices["Desktop Chrome"],
                storageState: "playwright/.auth/playerA.json",
            },
            dependencies: ["setup"],
            testIgnore: /auth\.setup\.ts/,
        },
        {
            name: "player-b",
            use: {
                ...devices["Desktop Chrome"],
                storageState: "playwright/.auth/playerB.json",
            },
            dependencies: ["setup"],
            testIgnore: /auth\.setup\.ts/,
        },
    ],

    webServer: {
        command: "npm run dev",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
    },
});