import { test, expect } from "./fixtures/players";
import { randomBytes } from "node:crypto";

test.describe("Heartfleet - Room Creation", () => {
    test("HF-R01: Player A can create a room", async ({ page }) => {
        await page.goto("/lobby");

        await expect(
            page.getByRole("heading", {
                name: "Ready to set sail?",
            })
        ).toBeVisible();

        await expect(
            page.getByRole("button", {
                name: /Create room/i,
            })
        ).toHaveAttribute("aria-pressed", "true");

        await page.getByRole("button", {
            name: /Create our room/i,
        }).click();

        await expect(page).toHaveURL(/\/lobby\/?$/);
    });

    test("HF-R02: Displays an error when room creation fails", async ({ page }) => {
        await page.route("**/api/rooms", async (route) => {
            if (route.request().method() !== "POST") {
                await route.continue();
                return;
            }

            await route.fulfill({
                status: 500,
                contentType: "application/json",
                body: JSON.stringify({
                    error: "Unable to create room.",
                }),
            });
        });

        await page.goto("/lobby");

        await page.getByRole("button", {
            name: /Create our room/i,
        }).click();

        await expect(
            page.getByRole("status")
        ).toHaveText("Unable to create room.");

        await expect(page).toHaveURL(/\/lobby\/?$/);
    });
    test("HF-R04: Invalid invite code is rejected", async ({
        playerB,
    }) => {
        await playerB.goto("/lobby");

        await playerB.getByRole("button", {
            name: /Join room/i,
        }).click();

        await playerB.getByRole("textbox", {
            name: "Invite code",
        }).fill("INVALID");

        await playerB.getByRole("button", {
            name: /Join the voyage/i,
        }).click();

        await expect(
            playerB.getByRole("status")
        ).toHaveText("Invalid invite code.");

        await expect(playerB).toHaveURL(/\/lobby\/?$/);
    });


    test("HF-R05: Nonexistent room is rejected", async ({
        playerB,
    }) => {
        const code = randomBytes(6).toString("hex").toUpperCase();

        await playerB.goto(`/lobby?code=${code}`);

        await playerB.getByRole("button", {
            name: /Join the voyage/i,
        }).click();

        await expect(
            playerB.getByRole("status")
        ).toHaveText(
            "Room not found, already full, or unavailable."
        );

        await expect(playerB).toHaveURL(
            new RegExp(`/lobby\\?code=${code}$`)
        );
    });
});