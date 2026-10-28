
export const BOARD_SIZE = 10;

export const SHIPS = [
    { id: "carrier", name: "Carrier", size: 5 },
    { id: "battleship", name: "Battleship", size: 4 },
    { id: "destroyer", name: "Destroyer", size: 3 },
    { id: "submarine", name: "Submarine", size: 3 },
    { id: "patrol", name: "Patrol Boat", size: 2 },
] as const;

export type ShipId = (typeof SHIPS)[number]["id"];
export type Orientation = "horizontal" | "vertical";

export type PlacedShip = {
    id: ShipId;
    row: number;
    col: number;
    orientation: Orientation;
};

export function shipCells(ship: PlacedShip) {
    const definition = SHIPS.find((s) => s.id === ship.id);

    if (!definition) return [];

    return Array.from({ length: definition.size }, (_, index) => ({
        row:
            ship.row +
            (ship.orientation === "vertical" ? index : 0),
        col:
            ship.col +
            (ship.orientation === "horizontal" ? index : 0),
    }));
}

export function isValidFleet(
    ships: PlacedShip[],
    requireComplete = true
): boolean {
    if (!Array.isArray(ships)) return false;

    if (requireComplete && ships.length !== SHIPS.length) {
        return false;
    }

    if (ships.length > SHIPS.length) return false;

    const ids = new Set<string>();
    const occupied = new Set<string>();

    for (const ship of ships) {
        if (
            !ship ||
            !SHIPS.some((s) => s.id === ship.id) ||
            ids.has(ship.id) ||
            !Number.isInteger(ship.row) ||
            !Number.isInteger(ship.col) ||
            !["horizontal", "vertical"].includes(ship.orientation)
        ) {
            return false;
        }

        ids.add(ship.id);

        for (const cell of shipCells(ship)) {
            if (
                cell.row < 0 ||
                cell.row >= BOARD_SIZE ||
                cell.col < 0 ||
                cell.col >= BOARD_SIZE
            ) {
                return false;
            }

            const key = `${cell.row},${cell.col}`;

            if (occupied.has(key)) return false;

            occupied.add(key);
        }
    }

    return true;
}

export function randomFleet(): PlacedShip[] {
    const placed: PlacedShip[] = [];

    for (const ship of SHIPS) {
        let found = false;

        for (let attempt = 0; attempt < 1000; attempt++) {
            const orientation: Orientation =
                Math.random() < 0.5 ? "horizontal" : "vertical";

            const maxRow =
                BOARD_SIZE -
                (orientation === "vertical" ? ship.size : 1);

            const maxCol =
                BOARD_SIZE -
                (orientation === "horizontal" ? ship.size : 1);

            const candidate: PlacedShip = {
                id: ship.id,
                row: Math.floor(Math.random() * (maxRow + 1)),
                col: Math.floor(Math.random() * (maxCol + 1)),
                orientation,
            };

            if (isValidFleet([...placed, candidate], false)) {
                placed.push(candidate);
                found = true;
                break;
            }
        }

        if (!found) {
            throw new Error("Unable to arrange fleet.");
        }
    }

    return placed;
}
