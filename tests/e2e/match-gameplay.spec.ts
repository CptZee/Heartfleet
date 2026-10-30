
import { test, expect } from "./fixtures/players";
import type { Page } from "@playwright/test";
import {
    prepareMatch,
    getMatchState,
    getCurrentPlayers,
    getShipCells,
    attack,
    fireSuccessfulShot,
    hostFleet,
    guestFleet,
} from "./helpers/match";

type Ship = {
    id: string;
    row: number;
    col: number;
    orientation: "horizontal" | "vertical";
};

function opponentBoard(page: Page) {
    return page.locator("section").filter({
        has: page.getByText("Choose a coordinate to attack", {
            exact: true,
        }),
    });
}

type MatchShot = {
    row: number;
    col: number;
    hit: boolean;
    sunkShip: string | null;
};

function shipCoordinates(ships: Ship[]): string[] {
    const sizes: Record<string, number> = {
        carrier: 5,
        battleship: 4,
        destroyer: 3,
        submarine: 3,
        patrol: 2,
    };

    return ships.flatMap(ship =>
        Array.from({ length: sizes[ship.id] }, (_, index) => {
            const row =
                ship.row +
                (ship.orientation === "vertical" ? index : 0);

            const col =
                ship.col +
                (ship.orientation === "horizontal" ? index : 0);

            return `${row},${col}`;
        })
    );
}

test.describe("Heartfleet - Match Gameplay", () => {
    test("HF-G01: Both fleets confirmed starts the match", async ({
        playerA,
        playerB,
    }) => {
        test.setTimeout(90_000);
        const room = await prepareMatch(playerA, playerB);

        const [hostResponse, guestResponse] = await Promise.all([
            playerA.request.get(`/api/rooms/${room.id}/match`),
            playerB.request.get(`/api/rooms/${room.id}/match`),
        ]);

        expect(hostResponse.status()).toBe(200);
        expect(guestResponse.status()).toBe(200);

        const host = await hostResponse.json();
        const guest = await guestResponse.json();

        expect(host.status).toBe("playing");
        expect(guest.status).toBe("playing");

        expect(host.ownShips).toEqual(hostFleet);
        expect(guest.ownShips).toEqual(guestFleet);

        expect(host.yourShots).toEqual([]);
        expect(guest.yourShots).toEqual([]);

        // Exactly one player should have the first turn.
        expect(host.yourTurn).not.toBe(guest.yourTurn);
    });

    test("HF-G02: Both players can load the battlefield", async ({
        playerA,
        playerB,
    }) => {
        const room = await prepareMatch(playerA, playerB);

        await Promise.all([
            playerA.goto(`/room/${room.id}/match`),
            playerB.goto(`/room/${room.id}/match`),
        ]);

        for (const page of [playerA, playerB]) {
            await expect(
                page.getByRole("heading", {
                    name: "Two fleets. One heart. ♡",
                })
            ).toBeVisible({ timeout: 15000 });

            await expect(
                page.getByRole("heading", {
                    name: "Your ocean",
                })
            ).toBeVisible();
            const board = opponentBoard(page);

            await expect(
                board.getByRole("button", {
                    name: "A1: unexplored",
                })
            ).toHaveCount(1);

            await expect(
                board.getByRole("button", {
                    name: "J10: unexplored",
                })
            ).toHaveCount(1);

        }
    });

    test("HF-G03: Only the current player can attack", async ({
        playerA,
        playerB,
    }) => {
        const room = await prepareMatch(playerA, playerB);

        await Promise.all([
            playerA.goto(`/room/${room.id}/match`),
            playerB.goto(`/room/${room.id}/match`),
        ]);

        const response = await playerA.request.get(
            `/api/rooms/${room.id}/match`
        );

        const host = await response.json();

        const activePlayer = host.yourTurn ? playerA : playerB;
        const waitingPlayer = host.yourTurn ? playerB : playerA;

        await expect(
            opponentBoard(activePlayer).getByRole("button", {
                name: "J10: unexplored",
            })
        ).toBeEnabled({ timeout: 15000 });

        await expect(
            opponentBoard(waitingPlayer).getByRole("button", {
                name: "J10: unexplored",
            })
        ).toBeDisabled({ timeout: 15000 });

        await expect(
            waitingPlayer.getByRole("heading", {
                name: "Not Your Turn",
            })
        ).toBeVisible();
    });

    test("HF-G04: Current player can fire a valid shot", async ({
        playerA,
        playerB,
    }) => {
        const room = await prepareMatch(playerA, playerB);

        const hostResponse = await playerA.request.get(
            `/api/rooms/${room.id}/match`
        );

        const host = await hostResponse.json();

        const attacker = host.yourTurn ? playerA : playerB;
        const defender = host.yourTurn ? playerB : playerA;

        await attacker.goto(`/room/${room.id}/match`);

        // J10 is empty in both deterministic fleets.
        const shotResponsePromise = attacker.waitForResponse(
            response =>
                new URL(response.url()).pathname ===
                `/api/rooms/${room.id}/match` &&
                response.request().method() === "POST"
        );

        await opponentBoard(attacker).getByRole("button", {
            name: "J10: unexplored",
        }).click();

        const shotResponse = await shotResponsePromise;

        expect(shotResponse.status()).toBe(200);

        const { result } = await shotResponse.json();

        expect(result.hit).toBe(false);
        expect(result.sunkShip).toBeNull();
        expect(result.won).toBe(false);

        await expect(
            attacker.getByRole("button", {
                name: "J10: miss",
            })
        ).toBeVisible({ timeout: 15000 });

        const [attackerResponse, defenderResponse] =
            await Promise.all([
                attacker.request.get(
                    `/api/rooms/${room.id}/match`
                ),
                defender.request.get(
                    `/api/rooms/${room.id}/match`
                ),
            ]);

        const attackerState = await attackerResponse.json();
        const defenderState = await defenderResponse.json();

        expect(attackerState.yourShots).toContainEqual({
            row: 9,
            col: 9,
            hit: false,
            sunkShip: null,
        });

        expect(defenderState.incomingShots).toContainEqual({
            row: 9,
            col: 9,
            hit: false,
            sunkShip: null,
        });
    });

    test("HF-G05: Attacking an occupied square registers a hit", async ({
        playerA,
        playerB,
    }) => {
        const room = await prepareMatch(playerA, playerB);

        const { attacker, defender, defenderFleet } =
            await getCurrentPlayers(playerA, playerB, room.id);

        // Target the first segment of the defender's carrier.
        const carrier = defenderFleet.find(
            ship => ship.id === "carrier"
        )!;

        const response = await attack(
            attacker,
            room.id,
            carrier.row,
            carrier.col
        );

        expect(response.status(), await response.text()).toBe(200);

        const { result } = await response.json();

        expect(result.hit).toBe(true);
        expect(result.sunkShip).toBeNull();
        expect(result.won).toBe(false);

        const attackerState = await getMatchState(attacker, room.id);
        const defenderState = await getMatchState(defender, room.id);

        const expectedShot = {
            row: carrier.row,
            col: carrier.col,
            hit: true,
            sunkShip: null,
        };

        expect(attackerState.yourShots).toContainEqual(expectedShot);
        expect(defenderState.incomingShots).toContainEqual(expectedShot);
    });

    test("HF-G06: Attacking empty water registers a miss", async ({
        playerA,
        playerB,
    }) => {
        const room = await prepareMatch(playerA, playerB);

        const { attacker, defender } =
            await getCurrentPlayers(playerA, playerB, room.id);

        // J10 is empty in both predefined fleets.
        const response = await attack(attacker, room.id, 9, 9);

        expect(response.status(), await response.text()).toBe(200);

        const { result } = await response.json();

        expect(result.hit).toBe(false);
        expect(result.sunkShip).toBeNull();
        expect(result.won).toBe(false);

        const attackerState = await getMatchState(attacker, room.id);
        const defenderState = await getMatchState(defender, room.id);

        const expectedShot = {
            row: 9,
            col: 9,
            hit: false,
            sunkShip: null,
        };

        expect(attackerState.yourShots).toContainEqual(expectedShot);
        expect(defenderState.incomingShots).toContainEqual(expectedShot);
    });

    test("HF-G07: Turn ownership remains consistent after a shot", async ({
        playerA,
        playerB,
    }) => {
        const room = await prepareMatch(playerA, playerB);

        const { attacker, defender } =
            await getCurrentPlayers(playerA, playerB, room.id);

        const response = await attack(attacker, room.id, 9, 9);

        expect(response.status(), await response.text()).toBe(200);

        const attackerState = await getMatchState(attacker, room.id);
        const defenderState = await getMatchState(defender, room.id);

        // Exactly one player must own the turn.
        expect(attackerState.yourTurn).not.toBe(
            defenderState.yourTurn
        );

        expect(attackerState.status).toBe("playing");
        expect(defenderState.status).toBe("playing");

        // Check that a non-current player cannot attack.
        const waitingPlayer = attackerState.yourTurn
            ? defender
            : attacker;

        const rejected = await attack(
            waitingPlayer,
            room.id,
            9,
            8
        );

        expect(rejected.status()).toBe(409);

        expect(await rejected.json()).toEqual({
            error: "Please wait for your turn.",
        });
    });

    test("HF-G08: Duplicate attacks are rejected", async ({
        playerA,
        playerB,
    }) => {
        const room = await prepareMatch(playerA, playerB);

        const { attacker } =
            await getCurrentPlayers(playerA, playerB, room.id);

        const firstResponse = await attack(
            attacker,
            room.id,
            9,
            9
        );

        expect(firstResponse.status()).toBe(200);

        const duplicateResponse = await attack(
            attacker,
            room.id,
            9,
            9
        );

        expect(duplicateResponse.status()).toBe(409);

        const error = await duplicateResponse.json();

        // Depending on server-side validation order, the
        // duplicate can be rejected for either reason.
        expect([
            "You've already attacked this coordinate.",
            "Please wait for your turn.",
        ]).toContain(error.error);

        const state = await getMatchState(attacker, room.id);

        const shotsAtCoordinate = state.yourShots.filter(
            (shot: { row: number; col: number }) =>
                shot.row === 9 && shot.col === 9
        );

        expect(shotsAtCoordinate).toHaveLength(1);
    });

    test("HF-G09: Invalid attack coordinates are rejected", async ({
        playerA,
        playerB,
    }) => {
        const room = await prepareMatch(playerA, playerB);

        const { attacker } =
            await getCurrentPlayers(playerA, playerB, room.id);

        const invalidCoordinates = [
            { row: -1, col: 0 },
            { row: 10, col: 0 },
            { row: 0, col: -1 },
            { row: 0, col: 10 },
            { row: 1.5, col: 2 },
            { row: "A", col: 0 },
            { row: null, col: null },
        ];

        for (const coordinates of invalidCoordinates) {
            const response = await attacker.request.post(
                `/api/rooms/${room.id}/match`,
                {
                    data: coordinates,
                }
            );

            expect(
                response.status(),
                JSON.stringify(coordinates)
            ).toBe(409);

            expect(await response.json()).toEqual({
                error: "Invalid attack coordinate.",
            });
        }

        const state = await getMatchState(attacker, room.id);

        expect(state.yourShots).toHaveLength(0);
    });

    test("HF-G10: Opponent fleet positions remain private", async ({
        playerA,
        playerB,
    }) => {
        const room = await prepareMatch(playerA, playerB);

        const hostResponse = await playerA.request.get(
            `/api/rooms/${room.id}/match`
        );

        const guestResponse = await playerB.request.get(
            `/api/rooms/${room.id}/match`
        );

        expect(hostResponse.status()).toBe(200);
        expect(guestResponse.status()).toBe(200);

        const host = await hostResponse.json();
        const guest = await guestResponse.json();

        expect(host.ownShips).toEqual(hostFleet);
        expect(guest.ownShips).toEqual(guestFleet);

        // The API should never expose an opponentShips field.
        expect(host).not.toHaveProperty("opponentShips");
        expect(guest).not.toHaveProperty("opponentShips");

        // Each response must contain only its owner's fleet.
        expect(host.ownShips).not.toEqual(guestFleet);
        expect(guest.ownShips).not.toEqual(hostFleet);

        // Check the actual client-facing response structure.
        expect(Object.keys(host)).toEqual(
            expect.arrayContaining([
                "status",
                "yourTurn",
                "ownShips",
                "yourShots",
                "incomingShots",
            ])
        );

        // Both fleets contain exactly 17 occupied squares.
        expect(shipCoordinates(host.ownShips)).toHaveLength(17);
        expect(shipCoordinates(guest.ownShips)).toHaveLength(17);
    });

    test("HF-G11: A ship sinks after all its cells are hit", async ({
        playerA,
        playerB,
    }) => {
        const room = await prepareMatch(playerA, playerB);

        const { attacker, defender, defenderFleet } =
            await getCurrentPlayers(playerA, playerB, room.id);

        const patrol = defenderFleet.find(
            ship => ship.id === "patrol"
        )!;

        const cells = getShipCells(patrol);

        // First hit: patrol is damaged but not sunk.
        const firstHit = await fireSuccessfulShot(
            attacker,
            room.id,
            cells[0].row,
            cells[0].col
        );

        expect(firstHit.hit).toBe(true);
        expect(firstHit.sunkShip).toBeNull();
        expect(firstHit.won).toBe(false);

        // Defender takes a turn, targeting guaranteed empty water.
        const counterattack = await fireSuccessfulShot(
            defender,
            room.id,
            9,
            9
        );

        expect(counterattack.hit).toBe(false);

        // Second hit: patrol is now sunk.
        const secondHit = await fireSuccessfulShot(
            attacker,
            room.id,
            cells[1].row,
            cells[1].col
        );

        expect(secondHit.hit).toBe(true);
        expect(secondHit.sunkShip).toBe("patrol");
        expect(secondHit.won).toBe(false);

        const attackerState = await getMatchState(
            attacker,
            room.id
        );

        const defenderState = await getMatchState(
            defender,
            room.id
        );

        expect(attackerState.yourShots).toContainEqual({
            ...cells[1],
            hit: true,
            sunkShip: "patrol",
        });

        expect(defenderState.incomingShots).toContainEqual({
            ...cells[1],
            hit: true,
            sunkShip: "patrol",
        });

        expect(attackerState.status).toBe("playing");
    });

    test("HF-G12: Destroying all enemy ships ends the match", async ({
        playerA,
        playerB,
    }) => {
        test.setTimeout(180_000);
        const room = await prepareMatch(playerA, playerB);

        const { attacker, defender, defenderFleet } =
            await getCurrentPlayers(playerA, playerB, room.id);

        const targetCells = defenderFleet.flatMap(getShipCells);

        expect(targetCells).toHaveLength(17);

        // These coordinates are empty in both deterministic fleets.
        const attackerOccupied = new Set(
            shipCoordinates(
                attacker === playerA ? hostFleet : guestFleet
            )
        );

        const counterattackCells = Array.from(
            { length: 100 },
            (_, index) => ({
                row: Math.floor(index / 10),
                col: index % 10,
            })
        ).filter(
            cell => !attackerOccupied.has(`${cell.row},${cell.col}`)
        ).slice(0, 16);

        expect(counterattackCells).toHaveLength(16);


        for (let index = 0; index < targetCells.length; index++) {
            const cell = targetCells[index];

            const result = await fireSuccessfulShot(
                attacker,
                room.id,
                cell.row,
                cell.col
            );

            expect(result.hit).toBe(true);

            const isFinalShot =
                index === targetCells.length - 1;

            expect(result.won).toBe(isFinalShot);

            if (isFinalShot) {
                break;
            }

            const counter = counterattackCells[index];

            const counterResult = await fireSuccessfulShot(
                defender,
                room.id,
                counter.row,
                counter.col
            );

            expect(counterResult.hit).toBe(false);
            expect(counterResult.won).toBe(false);
        }

        const winnerState = await getMatchState(
            attacker,
            room.id
        );

        const loserState = await getMatchState(
            defender,
            room.id
        );

        expect(winnerState.status).toBe("finished");
        expect(loserState.status).toBe("finished");

        expect(winnerState.winner).toBe("you");
        expect(loserState.winner).toBe("opponent");

        expect(winnerState.yourTurn).toBe(false);
        expect(loserState.yourTurn).toBe(false);

        expect(
            winnerState.yourShots.filter(
                (shot: { hit: boolean }) => shot.hit
            )
        ).toHaveLength(17);


        // Combat must remain disabled after victory.
        const rejectedAttack = await attack(
            defender,
            room.id,
            9,
            9
        );

        expect(rejectedAttack.status()).toBe(409);
    });

    test("HF-G13: Both players receive synchronized shot updates", async ({
        playerA,
        playerB,
    }) => {
        const room = await prepareMatch(playerA, playerB);

        const { attacker, defender } =
            await getCurrentPlayers(playerA, playerB, room.id);

        await Promise.all([
            attacker.goto(`/room/${room.id}/match`),
            defender.goto(`/room/${room.id}/match`),
        ]);

        await expect(
            opponentBoard(attacker).getByRole("button", {
                name: "J10: unexplored",
            })
        ).toBeEnabled({ timeout: 15000 });

        const shotResponse = attacker.waitForResponse(
            response =>
                new URL(response.url()).pathname ===
                `/api/rooms/${room.id}/match` &&
                response.request().method() === "POST"
        );

        await opponentBoard(attacker).getByRole("button", {
            name: "J10: unexplored",
        }).click();

        const response = await shotResponse;

        expect(response.status()).toBe(200);

        // Attacker sees the outgoing miss.
        await expect(
            opponentBoard(attacker).getByRole("button", {
                name: "J10: miss",
            })
        ).toBeVisible({ timeout: 15000 });

        // Defender receives the shot through polling.
        const ownBoard = defender.locator("section").filter({
            has: defender.getByText(
                "Your ships and incoming enemy attacks",
                { exact: true }
            ),
        });

        await expect(
            ownBoard.getByRole("button", {
                name: "J10: miss",
            })
        ).toBeVisible({ timeout: 15000 });

        const attackerState = await getMatchState(
            attacker,
            room.id
        );

        const defenderState = await getMatchState(
            defender,
            room.id
        );

        expect(attackerState.yourShots).toContainEqual({
            row: 9,
            col: 9,
            hit: false,
            sunkShip: null,
        });

        expect(defenderState.incomingShots).toContainEqual({
            row: 9,
            col: 9,
            hit: false,
            sunkShip: null,
        });
    });

    test("HF-G14: Match progress persists after refresh", async ({
        playerA,
        playerB,
    }) => {
        const room = await prepareMatch(playerA, playerB);

        const { attacker } =
            await getCurrentPlayers(playerA, playerB, room.id);

        await attacker.goto(`/room/${room.id}/match`);

        const response = await attack(
            attacker,
            room.id,
            9,
            9
        );

        expect(response.status()).toBe(200);

        await attacker.reload();

        await expect(
            attacker.getByRole("heading", {
                name: "Two fleets. One heart. ♡",
            })
        ).toBeVisible({ timeout: 15000 });

        await expect(
            opponentBoard(attacker).getByRole("button", {
                name: "J10: miss",
            })
        ).toBeVisible({ timeout: 15000 });

        const state = await getMatchState(
            attacker,
            room.id
        );

        expect(state.yourShots).toContainEqual({
            row: 9,
            col: 9,
            hit: false,
            sunkShip: null,
        });
    });

    test("HF-G15: Anonymous users cannot access match state", async ({
        playerA,
        playerB,
        playwright,
    }) => {
        test.setTimeout(120_000);

        const room = await prepareMatch(playerA, playerB);

        const anonymous = await playwright.request.newContext({
            baseURL:
                process.env.PLAYWRIGHT_BASE_URL ??
                "http://localhost:3000",
            storageState: {
                cookies: [],
                origins: [],
            },
        });

        try {
            const response = await anonymous.get(
                `/api/rooms/${room.id}/match`
            );

            expect(
                response.status(),
                `Anonymous match access returned: ${await response.text()}`
            ).toBe(401);
        } finally {
            await anonymous.dispose();
        }
    });
});
