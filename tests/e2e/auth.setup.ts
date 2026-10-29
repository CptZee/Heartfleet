
import { test as setup, expect } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

const authDir = path.join(process.cwd(), "playwright/.auth");

const accounts = [
    {
        name: "playerA",
        username: process.env.E2E_PLAYER_A_USERNAME!,
        password: process.env.E2E_PLAYER_A_PASSWORD!,
    },
    {
        name: "playerB",
        username: process.env.E2E_PLAYER_B_USERNAME!,
        password: process.env.E2E_PLAYER_B_PASSWORD!,
    },
];

for (const account of accounts) {
    setup(`authenticate ${account.name}`, async ({ page }) => {
        setup.setTimeout(60_000);

        if (!account.username || !account.password) {
            throw new Error(
                `Missing E2E credentials for ${account.name}`
            );
        }

        fs.mkdirSync(authDir, { recursive: true });

        // 1. Open login page.
        await page.goto("/login");

        await expect(
            page.getByRole("heading", {
                name: "Welcome back",
            })
        ).toBeVisible({ timeout: 15000 });

        // 2. Enter credentials.
        await page.getByRole("textbox", {
            name: "Username",
        }).fill(account.username);

        await page.getByLabel("Password").fill(account.password);

        // 3. Listen for the login API response.
        const loginResponsePromise = page.waitForResponse(
            (response) =>
                new URL(response.url()).pathname ===
                "/api/auth/login" &&
                response.request().method() === "POST",
            { timeout: 15000 }
        );

        // 4. Submit login.
        await page.getByRole("button", {
            name: "Log in ♡",
        }).click();

        const loginResponse = await loginResponsePromise;

        // 5. Verify login succeeded.
        expect(
            loginResponse.status(),
            `Authentication failed for ${account.name}: ${await loginResponse.text()
            }`
        ).toBe(200);

        // 6. Verify navigation to lobby.
        await expect(page).toHaveURL(/\/lobby\/?$/, {
            timeout: 15000,
        });

        // 7. Verify lobby rendered.
        await expect(
            page.getByRole("heading", {
                name: "Ready to set sail?",
            })
        ).toBeVisible({ timeout: 15000 });

        // 8. Verify authenticated identity.
        await expect(
            page.getByRole("main").getByText(
                account.username,
                { exact: true }
            )
        ).toBeVisible({ timeout: 15000 });

        // 9. Save authenticated browser state.
        const storagePath = path.join(
            authDir,
            `${account.name}.json`
        );

        await page.context().storageState({
            path: storagePath,
        });

        console.log(
            `[E2E Auth] ${account.name} authenticated successfully.`
        );
    });
}
