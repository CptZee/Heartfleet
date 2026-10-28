export const GAME_RULES = [
    {
        number: "01",
        title: "Place your fleet",
        text: "Arrange your five ships on a 10 × 10 grid. Keep their positions hidden from your opponent.",
    },
    {
        number: "02",
        title: "Take turns firing",
        text: "Call a coordinate to attack. A hit marks part of a ship; a miss marks open water.",
    },
    {
        number: "03",
        title: "Sink every ship",
        text: "A ship sinks when all its spaces have been hit. Sink your opponent's entire fleet to win.",
    },
    {
        number: "04",
        title: "Make room for hearts",
        text: "Earn Hearts during play and spend them on special Heartbeat moments when they appear.",
    },
] as const;