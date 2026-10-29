
import { test, expect } from "./fixtures/players";

test.describe("Heartfleet - Multiplayer Rooms", () => {
    test("HF-R03: Two players can join the same room", async ({
        playerA,
        playerB,
    }) => {
        // 1. Player A opens the lobby.
        await playerA.goto("/lobby");

        await expect(
            playerA.getByRole("heading", {
                name: "Ready to set sail?",
            })
        ).toBeVisible();

        // 2. Player A creates a room.
        const createResponsePromise = playerA.waitForResponse(
            (response) =>
                new URL(response.url()).pathname === "/api/rooms" &&
                response.request().method() === "POST"
        );

        await playerA.getByRole("button", {
            name: /Create our room/i,
        }).click();

        const createResponse = await createResponsePromise;

        expect(createResponse.status()).toBe(201);

        const { room } = await createResponse.json();

        expect(room.id).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        );

        expect(room.code).toMatch(/^[A-F0-9]{12}$/);
        expect(room.status).toBe("waiting");

        await expect(playerA).toHaveURL(
            new RegExp(`/room/${room.id}/?$`)
        );

        // 3. Player B opens the invitation link.
        await playerB.goto(`/lobby?code=${room.code}`);

        await expect(
            playerB.getByRole("textbox", {
                name: "Invite code",
            })
        ).toHaveValue(room.code);

        // 4. Player B joins the room.
        const joinResponsePromise = playerB.waitForResponse(
            (response) =>
                new URL(response.url()).pathname === "/api/rooms/join" &&
                response.request().method() === "POST"
        );

        await playerB.getByRole("button", {
            name: /Join the voyage/i,
        }).click();

        const joinResponse = await joinResponsePromise;

        expect(joinResponse.status()).toBe(200);

        const joinResult = await joinResponse.json();

        expect(joinResult.room.id).toBe(room.id);

        await expect(playerB).toHaveURL(
            new RegExp(`/room/${room.id}/?$`)
        );

        // 5. Verify both authenticated sessions
        // can retrieve the same room.
        const [hostResponse, guestResponse] = await Promise.all([
            playerA.request.get(`/api/rooms/${room.id}`),
            playerB.request.get(`/api/rooms/${room.id}`),
        ]);

        expect(hostResponse.status()).toBe(200);
        expect(guestResponse.status()).toBe(200);

        const hostData = await hostResponse.json();
        const guestData = await guestResponse.json();

        // 6. Verify host and guest identities.
        expect(hostData.room).toMatchObject({
            id: room.id,
            code: room.code,
            host: "hf_test_a",
            guest: "hf_test_b",
            isHost: true,
        });

        expect(guestData.room).toMatchObject({
            id: room.id,
            code: room.code,
            host: "hf_test_a",
            guest: "hf_test_b",
            isHost: false,
        });
    });
});
