export type EndgameStage =
    | "battle"
    | "heartbeats"
    | "letters"
    | "summary";

const STORAGE_PREFIX = "heartfleet-endgame";

function key(roomId: string) {
    return `${STORAGE_PREFIX}-${roomId}`;
}

export function getEndgameStage(
    roomId: string
): EndgameStage | null {
    if (typeof window === "undefined") return null;

    const value = window.sessionStorage.getItem(key(roomId));

    if (
        value === "heartbeats" ||
        value === "letters" ||
        value === "summary"
    ) {
        return value;
    }

    return null;
}

export function saveEndgameStage(
    roomId: string,
    stage: EndgameStage
) {
    if (typeof window === "undefined") return;

    if (stage === "battle") return;

    window.sessionStorage.setItem(key(roomId), stage);
}