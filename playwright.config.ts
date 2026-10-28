
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
    testDir: "./tests/e2e",
    fullyParallel: false,
    retries: process.env.CI ? 2 : 0,
    workers: 1,
    reporter: [["list"], ["html", { open: "never" }]],
    timeout: 90_000,
    expect: {
        timeout: 15_000,
    },
    use: {
        baseURL: "http://127.0.0.1:3000",
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
    },
    projects: [
        {
            name: "chromium",
            use: { ...devices["Desktop Chrome"] },
        },
    ],
    webServer: {
        command: "npm run dev -- --hostname 127.0.0.1",
        url: "http://127.0.0.1:3000/login",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
    },
});
