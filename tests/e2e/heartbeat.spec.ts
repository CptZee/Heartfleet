
import { test, expect } from "./fixtures/players";
import type { Page } from "@playwright/test"
import {
    prepareMatch,
    getCurrentPlayers,
    getShipCells,
    fireSuccessfulShot,
    hostFleet,
    guestFleet,
    getMatchState,
} from "./helpers/match";

type HeartsState = {
    balance: number;
    heartbeatCost: number;
    canAffordHeartbeat: boolean;
    availableOpportunities: {
        id: string;
        milestone: string;
        status: string;
    }[];
    events: {
        id: string;
        milestone: string;
        amount: number;
    }[];
};


type HeartbeatState = {
    heartbeat: null | {
        id: string;
        status: "choosing" | "answering";
        role: "initiator" | "chooser";
        questionText: string | null;
        questionSource: string | null;
    };

    latestResolved: null | {
        id: string;
        status: "completed" | "skipped";
        role: "initiator" | "chooser";
        questionText: string | null;
        answerText: string | null;
        completedAt: string;
    };

    history: {
        id: string;
        status: "completed" | "skipped";
        role: "initiator" | "chooser";
        questionSource: string | null;
        questionText: string | null;
        answerText: string | null;
        createdAt: string;
        completedAt: string;
    }[];
};

async function getHearts(page: Page, roomId: string): Promise<HeartsState> {
    const response = await page.request.get(
        `/api/rooms/${roomId}/hearts`
    );

    expect(response.status()).toBe(200);

    return response.json();
}

async function getHeartbeat(
    page: Page,
    roomId: string
): Promise<HeartbeatState> {
    const response = await page.request.get(
        `/api/rooms/${roomId}/heartbeats`
    );

    expect(response.status()).toBe(200);

    return response.json();
}

async function heartbeatAction(
    page: Page,
    roomId: string,
    data: Record<string, unknown>
) {
    return page.request.post(
        `/api/rooms/${roomId}/heartbeats`,
        { data }
    );
}

async function earnFirstHeartbeatOpportunity(
    playerA: Page,
    playerB: Page
) {
    const room = await prepareMatch(playerA, playerB);

    const { attacker, defender, defenderFleet } =
        await getCurrentPlayers(playerA, playerB, room.id);

    const patrol = defenderFleet.find(
        ship => ship.id === "patrol"
    )!;

    const cells = getShipCells(patrol);

    const firstHit = await fireSuccessfulShot(
        attacker,
        room.id,
        cells[0].row,
        cells[0].col
    );

    expect(firstHit.hit).toBe(true);
    expect(firstHit.sunkShip).toBeNull();

    const counterattack = await fireSuccessfulShot(
        defender,
        room.id,
        9,
        9
    );

    expect(counterattack.hit).toBe(false);

    const secondHit = await fireSuccessfulShot(
        attacker,
        room.id,
        cells[1].row,
        cells[1].col
    );

    expect(secondHit.hit).toBe(true);
    expect(secondHit.sunkShip).toBe("patrol");

    const hearts = await getHearts(attacker, room.id);

    const opportunity = hearts.availableOpportunities.find(
        item => item.milestone === "ships_1"
    );

    expect(opportunity).toBeDefined();
    expect(hearts.balance).toBeGreaterThanOrEqual(3);

    return {
        room,
        attacker,
        defender,
        opportunity: opportunity!,
        hearts,
    };
}

async function activateTestHeartbeat(
    playerA: Page,
    playerB: Page
) {
    const {
        room,
        attacker: initiator,
        defender: chooser,
        opportunity,
    } = await earnFirstHeartbeatOpportunity(
        playerA,
        playerB
    );

    const response = await heartbeatAction(
        initiator,
        room.id,
        {
            action: "activate",
            opportunityId: opportunity.id,
        }
    );

    expect(
        response.status(),
        `Activation failed: ${await response.text()}`
    ).toBe(200);

    const result = await response.json();

    expect(result.success).toBe(true);
    expect(result.heartbeatId).toBeTruthy();

    return {
        room,
        initiator,
        chooser,
        heartbeatId: result.heartbeatId as string,
    };
}

async function prepareAnsweringHeartbeat(
    playerA: Page,
    playerB: Page
) {
    const {
        room,
        initiator,
        chooser,
        heartbeatId,
    } = await activateTestHeartbeat(playerA, playerB);

    const question =
        "What's something that made you smile recently?";

    const response = await heartbeatAction(
        chooser,
        room.id,
        {
            action: "choose",
            heartbeatId,
            source: "custom",
            question,
        }
    );

    const body = await response.json();

    expect(
        response.status(),
        `Question selection failed: ${JSON.stringify(body)}`
    ).toBe(200);

    const state = await getHeartbeat(initiator, room.id);

    expect(state.heartbeat?.status).toBe("answering");

    return {
        room,
        initiator,
        chooser,
        heartbeatId,
        question,
    };
}

test.describe("Heartfleet - Heartbeats", () => {
    test.setTimeout(90_000);

    test("HF-H00: Anonymous users cannot retrieve Heartbeats", async ({
        playwright,
    }) => {
        const context = await playwright.request.newContext({
            storageState: {
                cookies: [],
                origins: [],
            },
        });

        try {
            const response = await context.get(
                "/api/rooms/00000000-0000-4000-8000-000000000000/heartbeats"
            );

            expect(response.status()).toBe(403);
            expect(await response.json()).toEqual({
                error: "Access denied.",
            });
        } finally {
            await context.dispose();
        }
    });

    test("HF-H01: Invalid activation request is rejected", async ({
        playerA,
    }) => {
        // Tests request validation without modifying game state.
        const response = await playerA.request.post(
            "/api/rooms/00000000-0000-4000-8000-000000000000/heartbeats",
            {
                data: {
                    action: "activate",
                },
            }
        );

        // Membership is checked before request validation.
        expect(response.status()).toBe(403);
    });

    test("HF-H02: Unknown Heartbeat action is rejected", async ({
        playerA,
    }) => {
        const response = await playerA.request.post(
            "/api/rooms/00000000-0000-4000-8000-000000000000/heartbeats",
            {
                data: {
                    action: "unknown",
                },
            }
        );

        expect(response.status()).toBe(403);
    });

    test("HF-H03: Sinking the first ship creates a Heartbeat opportunity", async ({
        playerA,
        playerB,
    }) => {
        test.setTimeout(120_000);

        const { hearts, opportunity } =
            await earnFirstHeartbeatOpportunity(playerA, playerB);

        expect(opportunity.status).toBe("available");

        expect(hearts.events).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    milestone: "ships_1",
                    amount: 2,
                }),
            ])
        );

        expect(hearts.canAffordHeartbeat).toBe(true);
    });

    test("HF-H04: Activating a Heartbeat deducts three Hearts", async ({
        playerA,
        playerB,
    }) => {
        test.setTimeout(120_000);

        const { room, attacker, opportunity, hearts } =
            await earnFirstHeartbeatOpportunity(playerA, playerB);

        const response = await heartbeatAction(
            attacker,
            room.id,
            {
                action: "activate",
                opportunityId: opportunity.id,
            }
        );

        expect(response.status()).toBe(200);

        const result = await response.json();

        expect(result.success).toBe(true);
        expect(result.heartbeatId).toBeTruthy();

        const updatedHearts = await getHearts(
            attacker,
            room.id
        );

        expect(updatedHearts.balance).toBe(
            hearts.balance - 3
        );

        expect(
            updatedHearts.availableOpportunities.some(
                item => item.id === opportunity.id
            )
        ).toBe(false);

        const state = await getHeartbeat(attacker, room.id);

        expect(state.heartbeat?.id).toBe(
            result.heartbeatId
        );

        expect(state.heartbeat?.status).toBe("choosing");
    });

    test("HF-H05: Opponent becomes the Heartbeat question chooser", async ({
        playerA,
        playerB,
    }) => {
        test.setTimeout(120_000);

        const { room, attacker, defender, opportunity } =
            await earnFirstHeartbeatOpportunity(playerA, playerB);

        const response = await heartbeatAction(
            attacker,
            room.id,
            {
                action: "activate",
                opportunityId: opportunity.id,
            }
        );

        expect(response.status()).toBe(200);

        const initiatorState = await getHeartbeat(
            attacker,
            room.id
        );

        const chooserState = await getHeartbeat(
            defender,
            room.id
        );

        expect(initiatorState.heartbeat?.role).toBe(
            "initiator"
        );

        expect(chooserState.heartbeat?.role).toBe(
            "chooser"
        );

        expect(initiatorState.heartbeat?.id).toBe(
            chooserState.heartbeat?.id
        );
    });

    test("HF-H06: Active Heartbeat prevents both players from attacking", async ({
        playerA,
        playerB,
    }) => {
        test.setTimeout(120_000);

        const { room, attacker, defender, opportunity } =
            await earnFirstHeartbeatOpportunity(playerA, playerB);

        const activation = await heartbeatAction(
            attacker,
            room.id,
            {
                action: "activate",
                opportunityId: opportunity.id,
            }
        );

        expect(activation.status()).toBe(200);

        // The defender has the turn after the patrol sinks.
        const defenderAttack = await defender.request.post(
            `/api/rooms/${room.id}/match`,
            {
                data: {
                    row: 9,
                    col: 8,
                },
            }
        );

        expect(defenderAttack.status()).toBe(409);

        // The initiator also cannot attack.
        const initiatorAttack = await attacker.request.post(
            `/api/rooms/${room.id}/match`,
            {
                data: {
                    row: 9,
                    col: 8,
                },
            }
        );

        expect(initiatorAttack.status()).toBe(409);

        const state = await getHeartbeat(attacker, room.id);

        expect(state.heartbeat?.status).toBe("choosing");
    });

    test("HF-H07: Opponent selects a curated Heartbeat question", async ({
        playerA,
        playerB,
    }) => {
        test.setTimeout(120_000);

        const { room, initiator, chooser, heartbeatId } =
            await activateTestHeartbeat(playerA, playerB);

        const questionId = "play-02";

        const response = await heartbeatAction(
            chooser,
            room.id,
            {
                action: "choose",
                heartbeatId,
                source: "curated",
                questionId,
            }
        );

        expect(response.status()).toBe(200);

        const chooserState = await getHeartbeat(
            chooser,
            room.id
        );

        const initiatorState = await getHeartbeat(
            initiator,
            room.id
        );

        expect(chooserState.heartbeat?.status).toBe(
            "answering"
        );

        expect(initiatorState.heartbeat?.status).toBe(
            "answering"
        );

        expect(initiatorState.heartbeat?.questionSource).toBe(
            "curated"
        );

        expect(initiatorState.heartbeat?.questionText).toBeTruthy();
    });

    test("HF-H08: Opponent selects a custom Heartbeat question", async ({
        playerA,
        playerB,
    }) => {
        test.setTimeout(120_000);

        const { room, initiator, chooser, heartbeatId } =
            await activateTestHeartbeat(playerA, playerB);

        const question =
            "What's one little thing that made you smile today?";

        const response = await heartbeatAction(
            chooser,
            room.id,
            {
                action: "choose",
                heartbeatId,
                source: "custom",
                question,
            }
        );

        expect(response.status()).toBe(200);

        const initiatorState = await getHeartbeat(
            initiator,
            room.id
        );

        const chooserState = await getHeartbeat(
            chooser,
            room.id
        );

        expect(initiatorState.heartbeat).toMatchObject({
            id: heartbeatId,
            status: "answering",
            role: "initiator",
            questionSource: "custom",
            questionText: question,
        });

        expect(chooserState.heartbeat).toMatchObject({
            id: heartbeatId,
            status: "answering",
            role: "chooser",
            questionSource: "custom",
            questionText: question,
        });
    });

    test("HF-H09: Initiator can answer a Heartbeat", async ({
        playerA,
        playerB,
    }) => {
        test.setTimeout(120_000);

        const {
            room,
            initiator,
            chooser,
            heartbeatId,
            question,
        } = await prepareAnsweringHeartbeat(playerA, playerB);

        const answer = "Talking to someone special today.";

        const response = await heartbeatAction(
            initiator,
            room.id,
            {
                action: "answer",
                heartbeatId,
                answer,
            }
        );

        expect(response.status()).toBe(200);

        const initiatorState = await getHeartbeat(
            initiator,
            room.id
        );

        const chooserState = await getHeartbeat(
            chooser,
            room.id
        );

        expect(initiatorState.heartbeat).toBeNull();
        expect(chooserState.heartbeat).toBeNull();

        expect(initiatorState.latestResolved).toMatchObject({
            id: heartbeatId,
            status: "completed",
            role: "initiator",
            questionText: question,
            answerText: answer,
        });

        expect(chooserState.latestResolved).toMatchObject({
            id: heartbeatId,
            status: "completed",
            role: "chooser",
            answerText: answer,
        });
    });

    test("HF-H10: Initiator can skip a Heartbeat", async ({
        playerA,
        playerB,
    }) => {
        test.setTimeout(120_000);

        const {
            room,
            initiator,
            chooser,
            heartbeatId,
        } = await prepareAnsweringHeartbeat(playerA, playerB);

        const response = await heartbeatAction(
            initiator,
            room.id,
            {
                action: "skip",
                heartbeatId,
            }
        );

        expect(response.status()).toBe(200);

        const initiatorState = await getHeartbeat(
            initiator,
            room.id
        );

        const chooserState = await getHeartbeat(
            chooser,
            room.id
        );

        expect(initiatorState.heartbeat).toBeNull();
        expect(chooserState.heartbeat).toBeNull();

        expect(initiatorState.latestResolved).toMatchObject({
            id: heartbeatId,
            status: "skipped",
            answerText: null,
        });

        expect(chooserState.latestResolved).toMatchObject({
            id: heartbeatId,
            status: "skipped",
            answerText: null,
        });
    });

    test("HF-H11: Combat resumes after Heartbeat resolution", async ({
        playerA,
        playerB,
    }) => {
        test.setTimeout(120_000);

        const {
            room,
            initiator,
            chooser,
            heartbeatId,
        } = await prepareAnsweringHeartbeat(playerA, playerB);

        // After sinking the patrol, the chooser owns the next turn.
        // This attack should be blocked while the Heartbeat is active.
        const blocked = await chooser.request.post(
            `/api/rooms/${room.id}/match`,
            {
                data: {
                    row: 9,
                    col: 8,
                },
            }
        );

        expect(blocked.status()).toBe(409);

        const resolution = await heartbeatAction(
            initiator,
            room.id,
            {
                action: "skip",
                heartbeatId,
            }
        );

        expect(resolution.status()).toBe(200);

        // The same coordinate should now be attackable.
        const resumed = await chooser.request.post(
            `/api/rooms/${room.id}/match`,
            {
                data: {
                    row: 9,
                    col: 8,
                },
            }
        );

        expect(
            resumed.status(),
            `Combat did not resume: ${await resumed.text()}`
        ).toBe(200);

        const result = (await resumed.json()).result;

        expect(result.hit).toBe(false);
    });

    test("HF-H12: Resolved Heartbeats persist in history", async ({
        playerA,
        playerB,
    }) => {
        test.setTimeout(120_000);

        const {
            room,
            initiator,
            chooser,
            heartbeatId,
            question,
        } = await prepareAnsweringHeartbeat(playerA, playerB);

        const answer = "A really thoughtful conversation.";

        const response = await heartbeatAction(
            initiator,
            room.id,
            {
                action: "answer",
                heartbeatId,
                answer,
            }
        );

        expect(response.status()).toBe(200);

        const [initiatorState, chooserState] = await Promise.all([
            getHeartbeat(initiator, room.id),
            getHeartbeat(chooser, room.id),
        ]);

        for (const state of [initiatorState, chooserState]) {
            expect(state.history).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        id: heartbeatId,
                        status: "completed",
                        questionText: question,
                        answerText: answer,
                    }),
                ])
            );
        }

        // Reload the match pages to verify persistence.
        await initiator.goto(`/room/${room.id}/match`);
        await chooser.goto(`/room/${room.id}/match`);

        await initiator.reload();
        await chooser.reload();

        const refreshedState = await getHeartbeat(
            initiator,
            room.id
        );

        expect(refreshedState.history).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: heartbeatId,
                    status: "completed",
                    answerText: answer,
                }),
            ])
        );
    });

    test("HF-H13: Initiator cannot choose their own Heartbeat question", async ({
        playerA,
        playerB,
    }) => {
        test.setTimeout(120_000);

        const { room, initiator, heartbeatId } =
            await activateTestHeartbeat(playerA, playerB);

        const response = await heartbeatAction(initiator, room.id, {
            action: "choose",
            heartbeatId,
            source: "custom",
            question: "What's your favorite memory?",
        });

        expect(response.status()).toBe(409);

        const state = await getHeartbeat(initiator, room.id);

        expect(state.heartbeat?.status).toBe("choosing");
    });

    test("HF-H14: Chooser cannot answer the Heartbeat", async ({
        playerA,
        playerB,
    }) => {
        test.setTimeout(120_000);

        const { room, chooser, heartbeatId } =
            await prepareAnsweringHeartbeat(playerA, playerB);

        const response = await heartbeatAction(chooser, room.id, {
            action: "answer",
            heartbeatId,
            answer: "An answer from the wrong player.",
        });

        expect(response.status()).toBe(409);

        const state = await getHeartbeat(chooser, room.id);

        expect(state.heartbeat?.status).toBe("answering");
    });

    test("HF-H15: A Heartbeat opportunity cannot be activated twice", async ({
        playerA,
        playerB,
    }) => {
        test.setTimeout(120_000);

        const { room, attacker, opportunity, hearts } =
            await earnFirstHeartbeatOpportunity(playerA, playerB);

        const payload = {
            action: "activate",
            opportunityId: opportunity.id,
        };

        const first = await heartbeatAction(attacker, room.id, payload);

        expect(first.status()).toBe(200);

        const second = await heartbeatAction(attacker, room.id, payload);

        expect(second.status()).toBe(409);

        const updatedHearts = await getHearts(attacker, room.id);

        expect(updatedHearts.balance).toBe(hearts.balance - 3);

        const state = await getHeartbeat(attacker, room.id);

        expect(state.heartbeat?.status).toBe("choosing");
    });

    test("HF-H16: A Heartbeat cannot be answered twice", async ({
        playerA,
        playerB,
    }) => {
        test.setTimeout(120_000);

        const { room, initiator, heartbeatId } =
            await prepareAnsweringHeartbeat(playerA, playerB);

        const first = await heartbeatAction(initiator, room.id, {
            action: "answer",
            heartbeatId,
            answer: "My first answer.",
        });

        expect(first.status()).toBe(200);

        const second = await heartbeatAction(initiator, room.id, {
            action: "answer",
            heartbeatId,
            answer: "My second answer.",
        });

        expect(second.status()).toBe(409);

        const state = await getHeartbeat(initiator, room.id);

        expect(state.heartbeat).toBeNull();

        expect(state.latestResolved).toMatchObject({
            id: heartbeatId,
            status: "completed",
            answerText: "My first answer.",
        });
    });
    test("HF-H17: Activation without an earned opportunity is rejected", async ({
        playerA,
        playerB,
    }) => {
        test.setTimeout(120_000);

        const room = await prepareMatch(playerA, playerB);

        const before = await getHearts(playerA, room.id);

        expect(before.balance).toBe(2);
        expect(before.canAffordHeartbeat).toBe(false);
        expect(before.availableOpportunities).toHaveLength(0);

        const response = await heartbeatAction(playerA, room.id, {
            action: "activate",
            opportunityId: "00000000-0000-4000-8000-000000000000",
        });

        expect(response.status()).toBe(409);

        const after = await getHearts(playerA, room.id);

        expect(after.balance).toBe(before.balance);

        const state = await getHeartbeat(playerA, room.id);

        expect(state.heartbeat).toBeNull();
    });

    test("HF-H18: Concurrent activation creates only one Heartbeat", async ({
        playerA,
        playerB,
    }) => {
        test.setTimeout(120_000);

        const { room, attacker, opportunity, hearts } =
            await earnFirstHeartbeatOpportunity(playerA, playerB);

        const payload = {
            action: "activate",
            opportunityId: opportunity.id,
        };

        const responses = await Promise.all([
            heartbeatAction(attacker, room.id, payload),
            heartbeatAction(attacker, room.id, payload),
        ]);

        const statuses = responses
            .map(response => response.status())
            .sort((a, b) => a - b);

        expect(statuses).toEqual([200, 409]);

        const updatedHearts = await getHearts(attacker, room.id);

        expect(updatedHearts.balance).toBe(hearts.balance - 3);

        const state = await getHeartbeat(attacker, room.id);

        expect(state.heartbeat?.status).toBe("choosing");

        const successfulResponse = responses.find(
            response => response.status() === 200
        )!;

        const result = await successfulResponse.json();

        expect(state.heartbeat?.id).toBe(result.heartbeatId);
    });
    test("HF-H19: Concurrent question submissions accept only one", async ({
        playerA,
        playerB,
    }) => {
        test.setTimeout(120_000);

        const { room, chooser, initiator, heartbeatId } =
            await activateTestHeartbeat(playerA, playerB);

        const questions = [
            "What's your favorite childhood memory?",
            "What makes an ordinary day special?",
        ];

        const responses = await Promise.all(
            questions.map(question =>
                heartbeatAction(chooser, room.id, {
                    action: "choose",
                    heartbeatId,
                    source: "custom",
                    question,
                })
            )
        );

        expect(responses.map(r => r.status()).sort()).toEqual([200, 409]);

        const state = await getHeartbeat(initiator, room.id);

        expect(state.heartbeat?.status).toBe("answering");
        expect(questions).toContain(state.heartbeat?.questionText);
    });

    test("HF-H20: Concurrent answer and skip resolve only once", async ({
        playerA,
        playerB,
    }) => {
        test.setTimeout(120_000);

        const { room, initiator, heartbeatId } =
            await prepareAnsweringHeartbeat(playerA, playerB);

        const responses = await Promise.all([
            heartbeatAction(initiator, room.id, {
                action: "answer",
                heartbeatId,
                answer: "Spending time with someone special.",
            }),
            heartbeatAction(initiator, room.id, {
                action: "skip",
                heartbeatId,
            }),
        ]);

        expect(responses.map(r => r.status()).sort()).toEqual([200, 409]);

        const state = await getHeartbeat(initiator, room.id);

        expect(state.heartbeat).toBeNull();
        expect(["completed", "skipped"]).toContain(
            state.latestResolved?.status
        );
        expect(state.latestResolved?.id).toBe(heartbeatId);
    });

    test("HF-H21: Active Heartbeat persists after refresh", async ({
        playerA,
        playerB,
    }) => {
        test.setTimeout(120_000);

        const { room, initiator, chooser, heartbeatId } =
            await activateTestHeartbeat(playerA, playerB);

        await initiator.goto(`/room/${room.id}/match`);
        await chooser.goto(`/room/${room.id}/match`);

        await initiator.reload();
        await chooser.reload();

        const [initiatorState, chooserState] = await Promise.all([
            getHeartbeat(initiator, room.id),
            getHeartbeat(chooser, room.id),
        ]);

        expect(initiatorState.heartbeat).toMatchObject({
            id: heartbeatId,
            status: "choosing",
            role: "initiator",
        });

        expect(chooserState.heartbeat).toMatchObject({
            id: heartbeatId,
            status: "choosing",
            role: "chooser",
        });
    });

    test("HF-H22: Heartbeat remains active without immediate expiration", async ({
        playerA,
        playerB,
    }) => {
        test.setTimeout(120_000);

        const { room, initiator, heartbeatId } =
            await activateTestHeartbeat(playerA, playerB);

        await new Promise(resolve => setTimeout(resolve, 3000));

        const state = await getHeartbeat(initiator, room.id);

        expect(state.heartbeat).toMatchObject({
            id: heartbeatId,
            status: "choosing",
        });
    });

    test("HF-H23: Question and answer validation enforces length limits", async ({
        playerA,
        playerB,
    }) => {
        test.setTimeout(120_000);

        const { room, chooser, initiator, heartbeatId } =
            await activateTestHeartbeat(playerA, playerB);

        for (const question of ["", " ", "x".repeat(301)]) {
            const response = await heartbeatAction(chooser, room.id, {
                action: "choose",
                heartbeatId,
                source: "custom",
                question,
            });

            expect(response.status()).toBe(400);
        }

        const validQuestion = await heartbeatAction(chooser, room.id, {
            action: "choose",
            heartbeatId,
            source: "custom",
            question: "What's something you're grateful for?",
        });

        expect(validQuestion.status()).toBe(200);

        for (const answer of ["", " ", "x".repeat(1001)]) {
            const response = await heartbeatAction(initiator, room.id, {
                action: "answer",
                heartbeatId,
                answer,
            });

            expect(response.status()).toBe(400);
        }

        const state = await getHeartbeat(initiator, room.id);

        expect(state.heartbeat?.status).toBe("answering");
    });

    test("HF-H24: Unauthenticated visitor cannot access existing room Heartbeats", async ({
        playerA,
        playerB,
        playwright,
    }) => {
        test.setTimeout(120_000);

        const room = await prepareMatch(playerA, playerB);

        const anonymous = await playwright.request.newContext({
            baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
            storageState: {
                cookies: [],
                origins: [],
            },
        });

        try {
            const hearts = await anonymous.get(
                `/api/rooms/${room.id}/hearts`
            );

            const heartbeats = await anonymous.get(
                `/api/rooms/${room.id}/heartbeats`
            );

            expect(hearts.status()).toBe(401);

            // Current Heartbeat route returns 403 when
            // participant lookup fails, including anonymous access.
            expect(heartbeats.status()).toBe(403);

            const activation = await anonymous.post(
                `/api/rooms/${room.id}/heartbeats`,
                {
                    data: {
                        action: "activate",
                        opportunityId:
                            "00000000-0000-4000-8000-000000000000",
                    },
                }
            );

            expect(activation.status()).toBe(403);
        } finally {
            await anonymous.dispose();
        }
    });

    test("HF-H25: Earned Heartbeat can activate after match completion", async ({
        playerA,
        playerB,
    }) => {
        test.setTimeout(180_000);

        const room = await prepareMatch(playerA, playerB);

        const { attacker, defender, defenderFleet } =
            await getCurrentPlayers(playerA, playerB, room.id);

        const targetCells = defenderFleet.flatMap(getShipCells);

        const attackerFleet =
            attacker === playerA ? hostFleet : guestFleet;

        const attackerShipCells = attackerFleet.flatMap(getShipCells);

        const missedCells: { row: number; col: number }[] = [];

        for (let row = 0; row < 10; row++) {
            for (let col = 0; col < 10; col++) {
                const containsAttackerShip = attackerShipCells.some(
                    cell => cell.row === row && cell.col === col
                );

                if (!containsAttackerShip) {
                    missedCells.push({ row, col });
                }
            }
        }

        expect(missedCells.length).toBeGreaterThanOrEqual(
            targetCells.length - 1
        );

        // Alternate turns until the attacker sinks all five ships.
        for (let i = 0; i < targetCells.length; i++) {
            const target = targetCells[i];

            const hit = await fireSuccessfulShot(
                attacker,
                room.id,
                target.row,
                target.col
            );

            expect(hit.hit).toBe(true);

            if (i < targetCells.length - 1) {
                const miss = missedCells[i];

                const counter = await fireSuccessfulShot(
                    defender,
                    room.id,
                    miss.row,
                    miss.col
                );

                expect(counter.hit).toBe(false);
            }
        }

        const match = await getMatchState(attacker, room.id);

        expect(match.status).toBe("finished");

        const hearts = await getHearts(attacker, room.id);

        expect(hearts.balance).toBeGreaterThanOrEqual(3);

        const opportunity = hearts.availableOpportunities[0];

        expect(opportunity).toBeDefined();

        const response = await heartbeatAction(attacker, room.id, {
            action: "activate",
            opportunityId: opportunity.id,
        });

        expect(
            response.status(),
            `Post-match activation failed: ${await response.text()}`
        ).toBe(200);

        const state = await getHeartbeat(attacker, room.id);

        expect(state.heartbeat?.status).toBe("choosing");
    });
});
