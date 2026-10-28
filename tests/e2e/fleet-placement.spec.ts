
import {
    test,
    expect,
    type Browser,
    type BrowserContext,
    type Page,
} from "@playwright/test";

type Captain = {
    context: BrowserContext;
    page: Page;
    username: string;
};

type RoomResponse = {
    room: {
        id: string;
        code: string;
        status: string;
        host: string;
        guest: string | null;
    };
};

type FleetResponse = {
    status: string;
    ownReady: boolean;
    opponentReady: boolean;
    ownShips: unknown[] | null;
};

const password = "HeartfleetTest2026!";

async function createCaptain(
    browser: Browser,
    username: string
): Promise<Captain> {
    const context = await browser.newContext();
    const page = await context.newPage();

    const response = await context.request.post(
        "/api/auth/login",
        {
            data: {
                username,
                password,
            },
        }
    );

    expect(
        response.ok(),
        `Login failed: ${await response.text()}`
    ).toBeTruthy();

    await page.goto("/lobby");

    // Wait for React to hydrate before interacting.
    await expect(page.locator("main")).toHaveAttribute(
        "data-hydrated",
        "true"
    );

    await expect(
        page.getByRole("main").getByText(username, {
            exact: true,
        })
    ).toBeVisible();

    const joinButton = page.getByRole("button", {
        name: /Join room/,
    });

    await joinButton.click();
    await expect(joinButton).toHaveAttribute("aria-pressed", "true");

    const createButton = page.getByRole("button", {
        name: /Create room/,
    });

    await createButton.click();
    await expect(createButton).toHaveAttribute("aria-pressed", "true");

    return { context, page, username };
}

async function createRoom(captain: Captain) {
    const page = captain.page;

    const responses: string[] = [];

    const onResponse = (response: import("@playwright/test").Response) => {
        if (response.url().includes("/api/rooms")) {
            responses.push(
                `${response.request().method()} ${response.status()} ${response.url()}`
            );
        }
    };

    page.on("response", onResponse);

    try {
        await page
            .getByRole("button", { name: /Create our room/ })
            .click();

        await expect(async () => {
            const currentUrl = page.url();

            const errorMessage = await page
                .getByRole("status")
                .allTextContents();

            expect(
                currentUrl,
                `Still on ${currentUrl}\n` +
                `API responses:\n${responses.join("\n") || "None"}\n` +
                `Status messages:\n${errorMessage.join("\n") || "None"}`
            ).toMatch(/\/room\/[0-9a-f-]{36}$/);
        }).toPass({ timeout: 15000 });

        const roomId = page.url().split("/").pop()!;

        const response = await captain.context.request.get(
            `/api/rooms/${roomId}`
        );

        expect(
            response.ok(),
            `Room retrieval failed: ${await response.text()}`
        ).toBeTruthy();

        const data = (await response.json()) as RoomResponse;

        return {
            id: roomId,
            code: data.room.code,
        };
    } finally {
        page.off("response", onResponse);
    }
}

async function joinRoom(
    captain: Captain,
    code: string
) {
    await captain.page.goto(
        `/lobby?code=${encodeURIComponent(code)}`
    );

    await expect(
        captain.page.getByRole("button", {
            name: /Join the voyage/,
        })
    ).toBeVisible();

    await expect(
        captain.page.getByRole("textbox", {
            name: "Invite code",
        })
    ).toHaveValue(code);

    await captain.page
        .getByRole("button", { name: /Join the voyage/ })
        .click();

    await expect(captain.page).toHaveURL(
        /\/room\/[0-9a-f-]{36}$/
    );
}

async function openPlacement(
    captain: Captain
) {
    await captain.page
        .getByRole("link", { name: /Prepare your fleet/ })
        .click();

    await expect(captain.page).toHaveURL(
        /\/placement$/
    );

    await expect(
        captain.page.getByRole("heading", {
            name: /Arrange your fleet/,
        })
    ).toBeVisible();
}

async function getFleet(
    captain: Captain,
    roomId: string
): Promise<FleetResponse> {
    const response = await captain.context.request.get(
        `/api/rooms/${roomId}/fleet`
    );

    expect(response.ok()).toBeTruthy();

    return (await response.json()) as FleetResponse;
}

async function selectShip(
    page: Page,
    name: string
) {
    await page
        .getByRole("button", {
            name: new RegExp(`^${name}\\b`),
        })
        .click();
}

async function placeAt(
    page: Page,
    coordinate: string
) {
    await page
        .getByRole("button", {
            name: new RegExp(
                `^${coordinate}, empty water$`
            ),
        })
        .click();
}

async function placeManualFleet(page: Page) {
    const placements = [
        ["Carrier", "A1"],
        ["Battleship", "B1"],
        ["Destroyer", "C1"],
        ["Submarine", "D1"],
        ["Patrol Boat", "E1"],
    ] as const;

    for (const [ship, coordinate] of placements) {
        await selectShip(page, ship);
        await placeAt(page, coordinate);
    }
}

test.describe("Heartfleet multiplayer fleet placement", () => {
    test("two captains can create, join, place, and confirm fleets", async ({
        browser,
    }) => {
        const captainA = await createCaptain(browser, "hf_test_a");
        const captainB = await createCaptain(browser, "hf_test_b");

        try {
            let roomId = "";
            let roomCode = "";

            await test.step(
                "TC-01: Captain A creates a private room",
                async () => {
                    const room = await createRoom(captainA);

                    roomId = room.id;
                    roomCode = room.code;

                    expect(roomCode).toMatch(/^[A-F0-9]{12}$/);

                    await expect(
                        captainA.page.getByText(
                            "1 / 2 aboard"
                        )
                    ).toBeVisible();
                }
            );

            await test.step(
                "TC-02: Captain B joins using the invite code",
                async () => {
                    await joinRoom(captainB, roomCode);

                    await expect.poll(
                        async () => {
                            const response =
                                await captainA.context.request.get(
                                    `/api/rooms/${roomId}`
                                );

                            const data =
                                (await response.json()) as RoomResponse;

                            return data.room.guest;
                        }
                    ).toBe(captainB.username);

                    await expect(
                        captainB.page.getByText(
                            captainA.username,
                            { exact: true }
                        )
                    ).toBeVisible();

                    await expect(
                        captainB.page.getByText(
                            captainB.username,
                            { exact: true }
                        )
                    ).toBeVisible();

                    await expect(
                        captainA.page.getByText("2 / 2 aboard")
                    ).toBeVisible();
                }
            );

            await test.step(
                "TC-03: Both captains open independent placement boards",
                async () => {
                    await openPlacement(captainA);
                    await openPlacement(captainB);

                    const fleetA = await getFleet(
                        captainA,
                        roomId
                    );

                    const fleetB = await getFleet(
                        captainB,
                        roomId
                    );

                    expect(fleetA.ownReady).toBe(false);
                    expect(fleetB.ownReady).toBe(false);

                    expect(fleetA.ownShips).toBeNull();
                    expect(fleetB.ownShips).toBeNull();
                }
            );

            await test.step(
                "TC-04: Invalid ship placements are rejected",
                async () => {

                    const page = captainA.page;

                    // Test out-of-bounds placement.
                    await placeAt(page, "J10");

                    await expect(
                        page.getByText(/overlaps another or extends beyond/)
                    ).toBeVisible();

                    await expect(
                        page.getByText("0 / 5 ships placed")
                    ).toBeVisible();

                    // Place the Battleship vertically from B1 to E1.
                    await selectShip(page, "Battleship");

                    await page
                        .getByRole("button", { name: /Rotate/ })
                        .click();

                    await placeAt(page, "B1");

                    // Attempt to place the Carrier vertically at A1.
                    // It would overlap the Battleship at B1.
                    await selectShip(page, "Carrier");
                    await placeAt(page, "A1");

                    await expect(
                        page.getByText(/overlaps another or extends beyond/)
                    ).toBeVisible();

                    await expect(
                        page.getByText("1 / 5 ships placed")
                    ).toBeVisible();

                    // The API must reject incomplete or invalid fleets.
                    const invalidResponse =
                        await captainA.context.request.post(
                            `/api/rooms/${roomId}/fleet`,
                            {
                                data: {
                                    ships: [
                                        {
                                            id: "carrier",
                                            row: 9,
                                            col: 9,
                                            orientation: "horizontal",
                                        },
                                    ],
                                },
                            }
                        );

                    expect(invalidResponse.status()).toBe(400);

                    // Return orientation to horizontal for later tests.
                    await page
                        .getByRole("button", { name: /Rotate/ })
                        .click();
                }
            );

            await test.step(
                "TC-05: Randomize generates a valid complete fleet",
                async () => {
                    const page = captainA.page;

                    await page
                        .getByRole("button", {
                            name: "Randomize",
                        })
                        .click();

                    await expect(
                        page.getByText("5 / 5 ships placed")
                    ).toBeVisible();

                    await expect(
                        page.getByText("Complete", {
                            exact: true,
                        })
                    ).toBeVisible();

                    await expect(
                        page.getByRole("button", {
                            name: /Confirm my fleet/,
                        })
                    ).toBeEnabled();
                }
            );

            await test.step(
                "TC-06: Captain A confirms; Captain B remains unready",
                async () => {
                    await captainA.page
                        .getByRole("button", {
                            name: /Confirm my fleet/,
                        })
                        .click();

                    await expect(
                        captainA.page.getByRole("button", {
                            name: /Fleet confirmed/,
                        })
                    ).toBeDisabled();

                    await expect.poll(
                        async () =>
                            (await getFleet(captainA, roomId))
                                .ownReady
                    ).toBe(true);

                    const fleetB = await getFleet(
                        captainB,
                        roomId
                    );

                    expect(fleetB.ownReady).toBe(false);
                    expect(fleetB.opponentReady).toBe(true);
                    expect(fleetB.ownShips).toBeNull();

                    // Opponent must not receive Captain A's ships.
                    const response =
                        await captainB.context.request.get(
                            `/api/rooms/${roomId}/fleet`
                        );

                    const body = await response.text();

                    expect(body).not.toContain(
                        '"ownShips":[{"id":"carrier"'
                    );
                }
            );

            await test.step(
                "TC-07: Captain B confirms and room becomes playing",
                async () => {
                    const page = captainB.page;

                    await placeManualFleet(page);

                    await expect(
                        page.getByText("5 / 5 ships placed")
                    ).toBeVisible();

                    await page
                        .getByRole("button", {
                            name: /Confirm my fleet/,
                        })
                        .click();

                    await expect.poll(
                        async () => {
                            const response =
                                await captainA.context.request.get(
                                    `/api/rooms/${roomId}`
                                );

                            const data =
                                (await response.json()) as RoomResponse;

                            return data.room.status;
                        }
                    ).toBe("playing");

                    const fleetA = await getFleet(
                        captainA,
                        roomId
                    );

                    const fleetB = await getFleet(
                        captainB,
                        roomId
                    );

                    expect(fleetA.ownReady).toBe(true);
                    expect(fleetA.opponentReady).toBe(true);

                    expect(fleetB.ownReady).toBe(true);
                    expect(fleetB.opponentReady).toBe(true);
                }
            );

            await test.step(
                "TC-08: Refresh preserves each captain's locked fleet",
                async () => {
                    const beforeA = await getFleet(
                        captainA,
                        roomId
                    );

                    const beforeB = await getFleet(
                        captainB,
                        roomId
                    );

                    await captainA.page.reload();
                    await captainB.page.reload();

                    await expect(
                        captainA.page.getByText(
                            "5 / 5 ships placed"
                        )
                    ).toBeVisible();

                    await expect(
                        captainB.page.getByText(
                            "5 / 5 ships placed"
                        )
                    ).toBeVisible();

                    const afterA = await getFleet(
                        captainA,
                        roomId
                    );

                    const afterB = await getFleet(
                        captainB,
                        roomId
                    );

                    expect(afterA.ownShips).toEqual(
                        beforeA.ownShips
                    );

                    expect(afterB.ownShips).toEqual(
                        beforeB.ownShips
                    );

                    expect(afterA.ownReady).toBe(true);
                    expect(afterB.ownReady).toBe(true);

                    await expect(
                        captainA.page.getByRole("button", {
                            name: "Randomize",
                        })
                    ).toBeDisabled();

                    await expect(
                        captainB.page.getByRole("button", {
                            name: "Clear board",
                        })
                    ).toBeDisabled();
                }
            );
        } finally {
            await captainA.context.close();
            await captainB.context.close();
        }
    });
});
