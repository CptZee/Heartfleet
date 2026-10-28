
export const HEARTBEAT_QUESTIONS = [
    {
        id: "smile-01",
        category: "Little Smiles",
        text: "What's something small that made you smile recently?",
    },
    {
        id: "smile-02",
        category: "Little Smiles",
        text: "What's a compliment you've never forgotten?",
    },
    {
        id: "smile-03",
        category: "Little Smiles",
        text: "What always manages to brighten your day?",
    },
    {
        id: "smile-04",
        category: "Little Smiles",
        text: "What's your favorite way to cheer someone up?",
    },
    {
        id: "know-01",
        category: "Getting to Know You",
        text: "What's something you could talk about for hours?",
    },
    {
        id: "know-02",
        category: "Getting to Know You",
        text: "What does your ideal peaceful afternoon look like?",
    },
    {
        id: "know-03",
        category: "Getting to Know You",
        text: "What's a little tradition you'd love to start?",
    },
    {
        id: "know-04",
        category: "Getting to Know You",
        text: "What's something you're looking forward to?",
    },
    {
        id: "sweet-01",
        category: "A Little Sweet",
        text: "What's a thoughtful gesture that means a lot to you?",
    },
    {
        id: "sweet-02",
        category: "A Little Sweet",
        text: "What makes spending time with someone feel special?",
    },
    {
        id: "sweet-03",
        category: "A Little Sweet",
        text: "What's your idea of a simple but lovely date?",
    },
    {
        id: "sweet-04",
        category: "A Little Sweet",
        text: "What's a quality you find especially endearing?",
    },
    {
        id: "play-01",
        category: "Playful Waters",
        text: "If we were a team in another game, what would our team name be?",
    },
    {
        id: "play-02",
        category: "Playful Waters",
        text: "What's your most harmless competitive habit?",
    },
    {
        id: "play-03",
        category: "Playful Waters",
        text: "If you won this battle, how would you celebrate?",
    },
    {
        id: "play-04",
        category: "Playful Waters",
        text: "What's one silly challenge you'd like us to try?",
    },
] as const;

export function getHeartbeatQuestion(id: string) {
    return HEARTBEAT_QUESTIONS.find(
        (question) => question.id === id
    );
}
