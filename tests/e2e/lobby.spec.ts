import { test, expect } from "@playwright/test";

test.describe("Heartfleet - Lobby", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("/lobby");

        await expect(
            page.getByRole("heading", {
                name: "Ready to set sail?",
            })
        ).toBeVisible();
    });

    test("should default to create room mode", async ({ page }) => {
        await expect(
            page.getByRole("button", { name: /Create room/i })
        ).toHaveAttribute("aria-pressed", "true");

        await expect(
            page.getByRole("button", { name: /Create our room/i })
        ).toBeVisible();

        await expect(
            page.getByRole("textbox", { name: "Invite code" })
        ).toHaveCount(0);
    });

    test("should switch to join room mode", async ({ page }) => {
        await page.getByRole("button", {
            name: /Join room/i,
        }).click();

        await expect(
            page.getByRole("button", { name: /Join room/i })
        ).toHaveAttribute("aria-pressed", "true");

        await expect(
            page.getByRole("textbox", { name: "Invite code" })
        ).toBeVisible();

        await expect(
            page.getByRole("button", { name: /Join the voyage/i })
        ).toBeVisible();
    });

    test("should show validation error for empty invite code", async ({ page }) => {
        await page.getByRole("button", {
            name: /Join room/i,
        }).click();

        await page.getByRole("button", {
            name: /Join the voyage/i,
        }).click();

        await expect(
            page.getByRole("status")
        ).toHaveText("Enter an invite code to join.");
    });

    test("should convert invite codes to uppercase", async ({ page }) => {
        await page.getByRole("button", {
            name: /Join room/i,
        }).click();

        const input = page.getByRole("textbox", {
            name: "Invite code",
        });

        await input.fill("abcdef123456");

        await expect(input).toHaveValue("ABCDEF123456");
    });

    test("should return to create mode", async ({ page }) => {
        await page.getByRole("button", {
            name: /Join room/i,
        }).click();

        await page.getByRole("button", {
            name: /Create room/i,
        }).click();

        await expect(
            page.getByRole("textbox", { name: "Invite code" })
        ).toHaveCount(0);

        await expect(
            page.getByRole("button", { name: /Create our room/i })
        ).toBeVisible();
    });
});

test.describe("Heartfleet - Invitation Links", () => {
    test("should automatically select join mode for valid invite links", async ({ page }) => {
        await page.goto("/lobby?code=ABCDEF123456");

        await expect(
            page.getByRole("button", { name: /Join room/i })
        ).toHaveAttribute("aria-pressed", "true");

        await expect(
            page.getByRole("textbox", { name: "Invite code" })
        ).toHaveValue("ABCDEF123456");
    });

    test("should normalize lowercase invite links", async ({ page }) => {
        await page.goto("/lobby?code=abcdef123456");

        await expect(
            page.getByRole("textbox", { name: "Invite code" })
        ).toHaveValue("ABCDEF123456");
    });

    test("should ignore malformed invite links", async ({ page }) => {
        await page.goto("/lobby?code=INVALID!");

        await expect(
            page.getByRole("button", { name: /Create room/i })
        ).toHaveAttribute("aria-pressed", "true");

        await expect(
            page.getByRole("textbox", { name: "Invite code" })
        ).toHaveCount(0);
    });
});