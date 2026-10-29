
import { expect, type Page } from "@playwright/test";

export type Ship = {
    id: string;
    row: number;
    col: number;
    orientation: "horizontal" | "vertical";
};

export const hostFleet: Ship[] = [
    { id: "carrier", row: 0, col: 0, orientation: "horizontal" },
    { id: "battleship", row: 2, col: 0, orientation: "horizontal" },
    { id: "destroyer", row: 4, col: 0, orientation: "horizontal" },
    { id: "submarine", row: 6, col: 0, orientation: "horizontal" },
    { id: "patrol", row: 8, col: 0, orientation: "horizontal" },
];

export const guestFleet: Ship[] = [
    { id: "carrier", row: 0, col: 5, orientation: "horizontal" },
    { id: "battleship", row: 2, col: 5, orientation: "horizontal" },
    { id: "destroyer", row: 4, col: 5, orientation: "horizontal" },
    { id: "submarine", row: 6, col: 5, orientation: "horizontal" },
    { id: "patrol", row: 8, col: 5, orientation: "horizontal" },
];

export async function createRoom(page: Page) {
    await page.goto("/lobby");

    const responsePromise = page.waitForResponse(
        response =>
            response.url().endsWith("/api/rooms") &&
            response.request().method() === "POST"
    );

    await page.getByRole("button", {
        name: /Create our room/i,
    }).click();

    const response = await responsePromise;
    expect(response.status()).toBe(201);

    const { room } = await response.json() as {
        room: {
            id: string;
            code: string;
            status: string;
        };
    };

    expect(room.id).toBeTruthy();
    expect(room.code).toBeTruthy();

    await page.goto(`/room/${room.id}`);

    return room;
}


export async function joinRoom(
    page: Page,
    room: { id: string; code: string }
) {
    const response = await page.request.post(
        "/api/rooms/join",
        {
            data: {
                code: room.code,
            },
        }
    );

    const body = await response.json();

    expect(
        response.status(),
        `Failed to join room: ${JSON.stringify(body)}`
    ).toBe(200);

    await page.goto(`/room/${room.id}`);

    await expect(page).toHaveURL(
        new RegExp(`/room/${room.id}`)
    );
}


export async function submitFleet(
    page: Page,
    roomId: string,
    ships: Ship[]
) {
    const response = await page.request.post(
        `/api/rooms/${roomId}/fleet`,
        { data: { ships } }
    );

    expect(response.status()).toBe(200);

    const result = await response.json();
    expect(result.ready).toBe(true);
}

export async function prepareMatch(
    playerA: Page,
    playerB: Page
) {
    const room = await createRoom(playerA);

    await joinRoom(playerB, room);

    await submitFleet(playerA, room.id, hostFleet);
    await submitFleet(playerB, room.id, guestFleet);

    const response = await playerA.request.get(
        `/api/rooms/${room.id}/match`
    );

    expect(response.status()).toBe(200);

    const state = await response.json();
    expect(state.status).toBe("playing");

    return room;
}

export async function getMatchState(
    page: Page,
    roomId: string
) {
    const response = await page.request.get(
        `/api/rooms/${roomId}/match`
    );

    expect(response.status()).toBe(200);

    return response.json();
}

export async function getCurrentPlayers(
    playerA: Page,
    playerB: Page,
    roomId: string
) {
    const [stateA, stateB] = await Promise.all([
        getMatchState(playerA, roomId),
        getMatchState(playerB, roomId),
    ]);

    expect(stateA.yourTurn).not.toBe(stateB.yourTurn);

    return stateA.yourTurn
        ? {
            attacker: playerA,
            defender: playerB,
            defenderFleet: guestFleet,
        }
        : {
            attacker: playerB,
            defender: playerA,
            defenderFleet: hostFleet,
        };
}

export function getShipCells(ship: Ship) {
    const sizes: Record<string, number> = {
        carrier: 5,
        battleship: 4,
        destroyer: 3,
        submarine: 3,
        patrol: 2,
    };

    return Array.from(
        { length: sizes[ship.id] },
        (_, index) => ({
            row: ship.row +
                (ship.orientation === "vertical" ? index : 0),
            col: ship.col +
                (ship.orientation === "horizontal" ? index : 0),
        })
    );
}

export async function attack(
    page: Page,
    roomId: string,
    row: number,
    col: number
) {
    return page.request.post(
        `/api/rooms/${roomId}/match`,
        { data: { row, col } }
    );
}

export async function fireSuccessfulShot(
    page: Page,
    roomId: string,
    row: number,
    col: number
) {
    const response = await attack(page, roomId, row, col);

    const status = response.status();
    const body = await response.json();

    expect(
        status,
        `Attack at (${row}, ${col}): ${JSON.stringify(body)}`
    ).toBe(200);

    return body.result as {
        hit: boolean;
        sunkShip: string | null;
        won: boolean;
    };
}
