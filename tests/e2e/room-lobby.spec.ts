
import { test, expect } from "./fixtures/players";
import type { Page } from "@playwright/test";

type CreatedRoom = {
    id: string;
    code: string;
    status: string;
};

async function createRoom(page: Page): Promise<CreatedRoom> {
    await page.goto("/lobby");

    const responsePromise = page.waitForResponse(
        (response) =>
            new URL(response.url()).pathname === "/api/rooms" &&
            response.request().method() === "POST"
    );

    await page.getByRole("button", {
        name: /Create our room/i,
    }).click();

    const response = await responsePromise;
    expect(response.status()).toBe(201);

    const { room } = await response.json();

    await expect(page).toHaveURL(
        new RegExp(`/room/${room.id}/?$`)
    );

    return room;
}

async function joinRoom(page: Page, room: CreatedRoom) {
    await page.goto(`/lobby?code=${room.code}`);

    await expect(
        page.getByRole("textbox", { name: "Invite code" })
    ).toHaveValue(room.code);

    const responsePromise = page.waitForResponse(
        (response) =>
            new URL(response.url()).pathname === "/api/rooms/join" &&
            response.request().method() === "POST"
    );

    await page.getByRole("button", {
        name: /Join the voyage/i,
    }).click();

    const response = await responsePromise;
    expect(response.status()).toBe(200);

    const { room: joinedRoom } = await response.json();
    expect(joinedRoom.id).toBe(room.id);

    await expect(page).toHaveURL(
        new RegExp(`/room/${room.id}/?$`)
    );
}

test.describe("Heartfleet - Room Lobby", () => {
    test("HF-L01: Host sees room details", async ({
        playerA,
    }) => {
        const room = await createRoom(playerA);

        await expect(
            playerA.getByRole("heading", {
                name: "Waiting for someone special",
            })
        ).toBeVisible();

        await expect(
            playerA.getByText("1 / 2 aboard")
        ).toBeVisible();

        await expect(
            playerA.getByText(room.code, { exact: true })
        ).toBeVisible();

        await expect(
            playerA.getByRole("main").getByText(
                "hf_test_a",
                { exact: true }
            )
        ).toBeVisible();
    });

    test("HF-L02: Both captains appear after joining", async ({
        playerA,
        playerB,
    }) => {
        const room = await createRoom(playerA);
        await joinRoom(playerB, room);

        for (const page of [playerA, playerB]) {
            await expect(
                page.getByRole("heading", {
                    name: "Both captains aboard ♡",
                })
            ).toBeVisible({ timeout: 15000 });

            await expect(
                page.getByText("2 / 2 aboard")
            ).toBeVisible();

            await expect(
                page.getByRole("main").getByText(
                    "hf_test_a",
                    { exact: true }
                )
            ).toBeVisible();

            await expect(
                page.getByRole("main").getByText(
                    "hf_test_b",
                    { exact: true }
                )
            ).toBeVisible();
        }
    });

    test("HF-L03: Host updates without refreshing", async ({
        playerA,
        playerB,
    }) => {
        const room = await createRoom(playerA);

        await expect(
            playerA.getByText("1 / 2 aboard")
        ).toBeVisible();

        await joinRoom(playerB, room);

        // Do not reload Player A's page.
        // The application's polling should update it.
        await expect(
            playerA.getByRole("heading", {
                name: "Both captains aboard ♡",
            })
        ).toBeVisible({ timeout: 15000 });

        await expect(
            playerA.getByText("2 / 2 aboard")
        ).toBeVisible();
    });

    test("HF-L04: Refresh preserves room membership", async ({
        playerA,
        playerB,
    }) => {
        const room = await createRoom(playerA);
        await joinRoom(playerB, room);

        await Promise.all([
            playerA.reload(),
            playerB.reload(),
        ]);

        for (const page of [playerA, playerB]) {
            await expect(page).toHaveURL(
                new RegExp(`/room/${room.id}/?$`)
            );

            await expect(
                page.getByText("2 / 2 aboard")
            ).toBeVisible({ timeout: 15000 });
        }
    });

    test("HF-L11: Invite code is displayed correctly", async ({
        playerA,
    }) => {
        const room = await createRoom(playerA);

        expect(room.code).toMatch(/^[A-F0-9]{12}$/);

        await expect(
            playerA.getByText(room.code, { exact: true })
        ).toBeVisible();

        await expect(
            playerA.getByRole("button", {
                name: /Copy invite link/i,
            })
        ).toBeVisible();
    });

    test("HF-L12: Players can access ship placement", async ({
        playerA,
        playerB,
    }) => {
        const room = await createRoom(playerA);
        await joinRoom(playerB, room);

        await expect(
            playerA.getByRole("link", {
                name: /Prepare your fleet/i,
            })
        ).toBeVisible({ timeout: 15000 });

        await playerA.getByRole("link", {
            name: /Prepare your fleet/i,
        }).click();

        await expect(playerA).toHaveURL(
            new RegExp(`/room/${room.id}/placement/?$`)
        );
    });

    test("HF-L13: Guest can leave a waiting room", async ({
        playerA,
        playerB,
    }) => {
        const room = await createRoom(playerA);
        await joinRoom(playerB, room);

        await expect(
            playerB.getByText("2 / 2 aboard")
        ).toBeVisible();

        const leaveResponsePromise = playerB.waitForResponse(
            response =>
                new URL(response.url()).pathname ===
                `/api/rooms/${room.id}/leave` &&
                response.request().method() === "POST"
        );

        await playerB.getByRole("button", {
            name: "Leave room",
        }).click();

        const response = await leaveResponsePromise;

        expect(response.status()).toBe(200);
        expect(await response.json()).toEqual({
            success: true,
        });

        await expect(playerB).toHaveURL(/\/lobby\/?$/);

        // Verify the host sees the guest departure
        // without refreshing.
        await expect(
            playerA.getByText("1 / 2 aboard")
        ).toBeVisible({ timeout: 15000 });

        await expect(
            playerA.getByRole("heading", {
                name: "Waiting for someone special",
            })
        ).toBeVisible();
    });

    test("HF-L14: Invalid room ID cannot be used to leave", async ({
        playerA,
    }) => {
        const response = await playerA.request.post(
            "/api/rooms/invalid-id/leave"
        );

        expect(response.status()).toBe(400);

        expect(await response.json()).toEqual({
            error: "Invalid room ID.",
        });
    });

    test("HF-L15: Unauthenticated users cannot leave rooms", async ({
        browser,
    }) => {
        const context = await browser.newContext({
            storageState: {
                cookies: [],
                origins: [],
            },
        });

        try {
            const response = await context.request.post(
                `/api/rooms/${crypto.randomUUID()}/leave`
            );

            expect(response.status()).toBe(401);

            expect(await response.json()).toEqual({
                error: "Unauthorized.",
            });
        } finally {
            await context.close();
        }
    });

});
