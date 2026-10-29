import { test, expect } from "@playwright/test";

test.describe("Heartfleet - Rooms", () => {
    test("should navigate to lobby from homepage", async ({ page }) => {
        await page.goto("/");

        const enterLobby = page.getByRole("link", {
            name: /Set sail together/i,
        });

        await expect(enterLobby).toBeVisible();
        await enterLobby.click();

        await expect(page).toHaveURL(/\/lobby\/?$/);
    });

    test("should navigate to lobby from bottom CTA", async ({ page }) => {
        await page.goto("/");

        const enterLobby = page.getByRole("link", {
            name: /Enter the lobby/i,
        });

        await expect(enterLobby).toBeVisible();
        await enterLobby.click();

        await expect(page).toHaveURL(/\/lobby\/?$/);
    });

    test.describe("Heartfleet - Lobby Authentication", () => {
        test("should redirect unauthenticated users to login", async ({ page }) => {
            await page.goto("/lobby");

            await expect(page).toHaveURL(/\/login\/?$/);

            await expect(
                page.getByRole("link", { name: /sign up/i })
            ).toBeVisible();
        });

        test("should prevent unauthenticated users from accessing lobby directly", async ({ page }) => {
            await page.goto("/lobby");

            await expect(page).toHaveURL(/\/login\/?$/);

            await page.goto("/lobby");

            await expect(page).toHaveURL(/\/login\/?$/);
        });
    });
});