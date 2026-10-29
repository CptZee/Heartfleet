
import { test, expect } from "./fixtures/players";
import type { Page } from "@playwright/test";

type Room = {
    id: string;
    code: string;
};

async function createRoom(page: Page): Promise<Room> {
    await page.goto("/lobby");

    const responsePromise = page.waitForResponse(
        response =>
            new URL(response.url()).pathname === "/api/rooms" &&
            response.request().method() === "POST"
    );

    await page.getByRole("button", {
        name: /Create our room/i,
    }).click();

    const response = await responsePromise;
    expect(response.status()).toBe(201);

    const { room } = await response.json();
    return room;
}

async function joinRoom(page: Page, room: Room) {
    await page.goto(`/lobby?code=${room.code}`);

    const responsePromise = page.waitForResponse(
        response =>
            new URL(response.url()).pathname === "/api/rooms/join" &&
            response.request().method() === "POST"
    );

    await page.getByRole("button", {
        name: /Join the voyage/i,
    }).click();

    const response = await responsePromise;
    expect(response.status()).toBe(200);
}

async function preparePlacement(
    playerA: Page,
    playerB: Page
): Promise<Room> {
    const room = await createRoom(playerA);
    await joinRoom(playerB, room);

    await playerA.goto(`/room/${room.id}/placement`);

    await expect(
        playerA.getByRole("heading", {
            name: "Arrange your fleet ♡",
        })
    ).toBeVisible({ timeout: 15000 });

    await expect(
        playerA.getByRole("button", {
            name: "A1, empty water",
        })
    ).toBeEnabled();

    return room;
}

test.describe("Heartfleet - Ship Placement", () => {
    test("HF-P01: Placement board loads correctly", async ({
        playerA,
        playerB,
    }) => {
        await preparePlacement(playerA, playerB);

        const board = playerA.getByRole("region", {
            name: "Your ocean",
        });

        await expect(
            playerA.getByText("0 / 5 ships placed")
        ).toBeVisible();

        await expect(
            playerA.getByRole("button", {
                name: "A1, empty water",
            })
        ).toBeVisible();

        await expect(
            playerA.getByRole("button", {
                name: "J10, empty water",
            })
        ).toBeVisible();

        await expect(
            playerA.getByRole("button", {
                name: /Confirm my fleet/i,
            })
        ).toBeDisabled();
    });

    test("HF-P02: Player can place a ship", async ({
        playerA,
        playerB,
    }) => {
        await preparePlacement(playerA, playerB);

        // Carrier is selected by default.
        await playerA.getByRole("button", {
            name: "A1, empty water",
        }).click();

        await expect(
            playerA.getByText("1 / 5 ships placed")
        ).toBeVisible();

        await expect(
            playerA.getByRole("button", {
                name: "A1, carrier",
            })
        ).toBeVisible();
    });

    test("HF-P03: Player can rotate a ship", async ({
        playerA,
        playerB,
    }) => {
        await preparePlacement(playerA, playerB);

        await expect(
            playerA.getByText("↔ Horizontal")
        ).toBeVisible();

        await playerA.getByRole("button", {
            name: "Rotate ↻",
        }).click();

        await expect(
            playerA.getByText("↕ Vertical")
        ).toBeVisible();

        await playerA.getByRole("button", {
            name: "A1, empty water",
        }).click();

        await expect(
            playerA.getByRole("button", {
                name: "B1, carrier",
            })
        ).toBeVisible();
    });

    test("HF-P04: Overlapping placement is rejected", async ({
        playerA,
        playerB,
    }) => {
        await preparePlacement(playerA, playerB);

        await playerA.getByRole("button", {
            name: "A1, empty water",
        }).click();

        // Select a different ship.
        await playerA.getByRole("button", {
            name: /Battleship/i,
        }).click();

        // Attempt to overlap the carrier.
        await playerA.getByRole("button", {
            name: "A2, carrier",
        }).click();

        // Clicking an occupied cell selects that ship
        // instead of attempting an invalid placement.
        await expect(
            playerA.getByText("1 / 5 ships placed")
        ).toBeVisible();
    });


    test("HF-P05: Out-of-bounds placement is rejected", async ({
        playerA,
        playerB,
    }) => {
        await preparePlacement(playerA, playerB);

        // Carrier requires five consecutive squares.
        // Starting at A10 would extend beyond the board.
        await playerA.getByRole("button", {
            name: "A10, empty water",
        }).click();

        // Verify the application's validation message.
        await expect(
            playerA.getByRole("alert").filter({
                hasText:
                    "That ship overlaps another or extends beyond the board.",
            })
        ).toBeVisible();

        // Verify no ship was placed.
        await expect(
            playerA.getByText("0 / 5 ships placed")
        ).toBeVisible();

        // The fleet must remain incomplete.
        await expect(
            playerA.getByRole("button", {
                name: "Confirm my fleet ♡",
            })
        ).toBeDisabled();
    });


    test("HF-P06: Randomize generates a complete fleet", async ({
        playerA,
        playerB,
    }) => {
        await preparePlacement(playerA, playerB);

        await playerA.getByRole("button", {
            name: "Randomize",
        }).click();

        await expect(
            playerA.getByText("5 / 5 ships placed")
        ).toBeVisible();

        await expect(
            playerA.getByRole("button", {
                name: "Confirm my fleet ♡",
            })
        ).toBeEnabled();
    });

    test("HF-P07: Incomplete fleet cannot be confirmed", async ({
        playerA,
        playerB,
    }) => {
        await preparePlacement(playerA, playerB);

        await playerA.getByRole("button", {
            name: "A1, empty water",
        }).click();

        await expect(
            playerA.getByText("1 / 5 ships placed")
        ).toBeVisible();

        await expect(
            playerA.getByRole("button", {
                name: "Confirm my fleet ♡",
            })
        ).toBeDisabled();
    });

    test("HF-P08: Player can confirm a complete fleet", async ({
        playerA,
        playerB,
    }) => {
        const room = await preparePlacement(playerA, playerB);

        await playerA.getByRole("button", {
            name: "Randomize",
        }).click();

        await expect(
            playerA.getByText("5 / 5 ships placed")
        ).toBeVisible();

        const responsePromise = playerA.waitForResponse(
            response =>
                new URL(response.url()).pathname ===
                `/api/rooms/${room.id}/fleet` &&
                response.request().method() === "POST"
        );

        await playerA.getByRole("button", {
            name: "Confirm my fleet ♡",
        }).click();

        const response = await responsePromise;

        expect(response.status()).toBe(200);

        const result = await response.json();

        expect(result.ready).toBe(true);

        await expect(
            playerA.getByRole("heading", {
                name: "Fleet locked in ♡",
            })
        ).toBeVisible({ timeout: 15000 });

        await expect(
            playerA.getByRole("button", {
                name: "Fleet confirmed ✓",
            })
        ).toBeDisabled();

        const fleetResponse = await playerA.request.get(
            `/api/rooms/${room.id}/fleet`
        );

        expect(fleetResponse.status()).toBe(200);

        const fleet = await fleetResponse.json();

        expect(fleet.ownReady).toBe(true);
        expect(fleet.ownShips).toHaveLength(5);
    });

    test("HF-P09: Confirmed fleet survives page refresh", async ({
        playerA,
        playerB,
    }) => {
        const room = await preparePlacement(playerA, playerB);

        await playerA.getByRole("button", {
            name: "Randomize",
        }).click();

        await playerA.getByRole("button", {
            name: "Confirm my fleet ♡",
        }).click();

        await expect(
            playerA.getByRole("heading", {
                name: "Fleet locked in ♡",
            })
        ).toBeVisible({ timeout: 15000 });

        const beforeResponse = await playerA.request.get(
            `/api/rooms/${room.id}/fleet`
        );

        expect(beforeResponse.status()).toBe(200);

        const before = await beforeResponse.json();

        await playerA.reload();

        await expect(
            playerA.getByRole("heading", {
                name: "Fleet locked in ♡",
            })
        ).toBeVisible({ timeout: 15000 });

        await expect(
            playerA.getByText("5 / 5 ships placed")
        ).toBeVisible();

        const afterResponse = await playerA.request.get(
            `/api/rooms/${room.id}/fleet`
        );

        expect(afterResponse.status()).toBe(200);

        const after = await afterResponse.json();

        expect(after.ownShips).toEqual(before.ownShips);
        expect(after.ownReady).toBe(true);
    });

    test("HF-P10: Both players confirming starts the match", async ({
        playerA,
        playerB,
    }) => {
        const room = await preparePlacement(playerA, playerB);

        await playerB.goto(`/room/${room.id}/placement`);

        for (const page of [playerA, playerB]) {
            await expect(
                page.getByRole("heading", {
                    name: "Arrange your fleet ♡",
                })
            ).toBeVisible();

            await page.getByRole("button", {
                name: "Randomize",
            }).click();
        }

        // Player A confirms first.
        await playerA.getByRole("button", {
            name: "Confirm my fleet ♡",
        }).click();

        await expect(
            playerA.getByRole("heading", {
                name: "Fleet locked in ♡",
            })
        ).toBeVisible({ timeout: 15000 });

        const waitingResponse = await playerA.request.get(
            `/api/rooms/${room.id}/fleet`
        );

        expect(waitingResponse.status()).toBe(200);

        const waitingStatus = await waitingResponse.json();

        expect(waitingStatus.ownReady).toBe(true);
        expect(waitingStatus.opponentReady).toBe(false);

        // Player B confirms.
        await playerB.getByRole("button", {
            name: "Confirm my fleet ♡",
        }).click();

        // Both clients should detect the match transition.
        for (const page of [playerA, playerB]) {
            await expect(
                page.getByRole("link", {
                    name: "Enter the battlefield →",
                })
            ).toBeVisible({ timeout: 15000 });
        }

        const [hostResponse, guestResponse] = await Promise.all([
            playerA.request.get(`/api/rooms/${room.id}/fleet`),
            playerB.request.get(`/api/rooms/${room.id}/fleet`),
        ]);

        const host = await hostResponse.json();
        const guest = await guestResponse.json();

        expect(host.status).toBe("playing");
        expect(guest.status).toBe("playing");

        expect(host.ownReady).toBe(true);
        expect(host.opponentReady).toBe(true);

        expect(guest.ownReady).toBe(true);
        expect(guest.opponentReady).toBe(true);
    });

    test("HF-P11: Opponent cannot retrieve private ship positions", async ({
        playerA,
        playerB,
    }) => {
        const room = await preparePlacement(playerA, playerB);

        await playerA.getByRole("button", {
            name: "Randomize",
        }).click();

        await playerA.getByRole("button", {
            name: "Confirm my fleet ♡",
        }).click();

        await expect(
            playerA.getByRole("heading", {
                name: "Fleet locked in ♡",
            })
        ).toBeVisible({ timeout: 15000 });

        const [hostResponse, guestResponse] = await Promise.all([
            playerA.request.get(`/api/rooms/${room.id}/fleet`),
            playerB.request.get(`/api/rooms/${room.id}/fleet`),
        ]);

        expect(hostResponse.status()).toBe(200);
        expect(guestResponse.status()).toBe(200);

        const host = await hostResponse.json();
        const guest = await guestResponse.json();

        expect(host.ownShips).toHaveLength(5);
        expect(host.ownReady).toBe(true);

        expect(guest.ownShips).toBeNull();
        expect(guest.ownReady).toBe(false);
        expect(guest.opponentReady).toBe(true);

        // Ensure the guest response does not expose
        // the host's complete ship arrangement.
        expect(guest).not.toHaveProperty("opponentShips");
        expect(guest).not.toHaveProperty("hostShips");
    });

    test("HF-P12: Invalid fleet submissions are rejected", async ({
        playerA,
        playerB,
    }) => {
        const room = await preparePlacement(playerA, playerB);

        const invalidFleets = [
            {
                name: "Empty fleet",
                ships: [],
            },
            {
                name: "Missing ships",
                ships: [
                    {
                        id: "carrier",
                        row: 0,
                        col: 0,
                        orientation: "horizontal",
                    },
                ],
            },
            {
                name: "Out-of-bounds ship",
                ships: [
                    { id: "carrier", row: 0, col: 9, orientation: "horizontal" },
                    { id: "battleship", row: 2, col: 0, orientation: "horizontal" },
                    { id: "destroyer", row: 4, col: 0, orientation: "horizontal" },
                    { id: "submarine", row: 6, col: 0, orientation: "horizontal" },
                    { id: "patrol", row: 8, col: 0, orientation: "horizontal" },
                ],
            },
            {
                name: "Overlapping ships",
                ships: [
                    { id: "carrier", row: 0, col: 0, orientation: "horizontal" },
                    { id: "battleship", row: 0, col: 2, orientation: "horizontal" },
                    { id: "destroyer", row: 4, col: 0, orientation: "horizontal" },
                    { id: "submarine", row: 6, col: 0, orientation: "horizontal" },
                    { id: "patrol", row: 8, col: 0, orientation: "horizontal" },
                ],
            },
        ];

        for (const invalid of invalidFleets) {
            const response = await playerA.request.post(
                `/api/rooms/${room.id}/fleet`,
                {
                    data: {
                        ships: invalid.ships,
                    },
                }
            );

            expect(
                response.status(),
                invalid.name
            ).toBe(400);

            expect(await response.json()).toEqual({
                error: "Invalid fleet arrangement.",
            });
        }

        const statusResponse = await playerA.request.get(
            `/api/rooms/${room.id}/fleet`
        );

        expect(statusResponse.status()).toBe(200);

        const status = await statusResponse.json();

        expect(status.ownReady).toBe(false);
        expect(status.ownShips).toBeNull();
    });

});
