import { test, expect } from "@playwright/test";

test.describe("Heartfleet - Homepage", () => {
    test("should load the homepage", async ({ page }) => {
        await page.goto("/");

        await expect(page).toHaveURL("/");
        await expect(page.locator("body")).toBeVisible();
    });

    test("should display Heartfleet branding", async ({ page }) => {
        await page.goto("/");

        await expect(
            page.getByRole("heading", {
                name: /Heartfleet/i,
                level: 1,
            })
        ).toBeVisible();
    });
});