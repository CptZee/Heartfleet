
import { test, expect } from "./fixtures/players";
import { randomUUID } from "node:crypto";

test.describe("Heartfleet - Room Access", () => {
    test("HF-L05: Unauthenticated users cannot access room data", async ({
        browser,
    }) => {
        const context = await browser.newContext({
            storageState: {
                cookies: [],
                origins: [],
            },
        });

        try {
            const response = await context.request.get(
                `/api/rooms/${randomUUID()}`
            );

            expect(response.status()).toBe(401);

            expect(await response.json()).toMatchObject({
                error: "Unauthorized.",
            });
        } finally {
            await context.close();
        }
    });

    test("HF-L09: Invalid room ID is rejected", async ({
        playerA,
    }) => {
        const response = await playerA.request.get(
            "/api/rooms/not-a-valid-uuid"
        );

        expect(response.status()).toBe(400);

        expect(await response.json()).toMatchObject({
            error: "Invalid room ID.",
        });
    });

    test("HF-L10: Unknown room returns 404", async ({
        playerA,
    }) => {
        const response = await playerA.request.get(
            `/api/rooms/${randomUUID()}`
        );

        expect(response.status()).toBe(404);

        expect(await response.json()).toMatchObject({
            error: "Room not found.",
        });
    });
});
