
export type GameSound =
    | "hit"
    | "miss"
    | "sunk"
    | "victory"
    | "incoming-hit"
    | "incoming-miss";

let audioContext: AudioContext | null = null;
let enabled = true;

export function setGameSoundEnabled(value: boolean) {
    enabled = value;
}

export function getGameSoundEnabled() {
    return enabled;
}

export function unlockGameAudio() {
    if (typeof window === "undefined") return;

    audioContext ??= new AudioContext();

    if (audioContext.state === "suspended") {
        void audioContext.resume();
    }
}

function tone(
    frequency: number,
    start: number,
    duration: number,
    type: OscillatorType = "sine",
    volume = 0.12,
    endFrequency?: number
) {
    if (!audioContext) return;

    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);

    if (endFrequency) {
        oscillator.frequency.exponentialRampToValueAtTime(
            Math.max(1, endFrequency),
            start + duration
        );
    }

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(
        Math.max(0.0001, volume),
        start + 0.015
    );
    gain.gain.exponentialRampToValueAtTime(
        0.0001,
        start + duration
    );

    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    oscillator.start(start);
    oscillator.stop(start + duration + 0.01);
}

export function playGameSound(sound: GameSound) {
    if (!enabled || typeof window === "undefined") return;

    try {
        unlockGameAudio();

        if (!audioContext || audioContext.state !== "running") {
            return;
        }

        const now = audioContext.currentTime + 0.01;

        switch (sound) {
            case "hit":
                tone(220, now, 0.24, "triangle", 0.18, 75);
                tone(110, now + 0.03, 0.2, "sawtooth", 0.045, 55);
                break;

            case "miss":
                tone(440, now, 0.2, "sine", 0.09, 240);
                tone(300, now + 0.1, 0.25, "sine", 0.06, 130);
                break;

            case "sunk":
                tone(392, now, 0.16, "triangle", 0.12);
                tone(523, now + 0.15, 0.16, "triangle", 0.12);
                tone(784, now + 0.3, 0.42, "sine", 0.15);
                break;

            case "victory":
                [523, 659, 784, 1047].forEach((frequency, i) => {
                    tone(
                        frequency,
                        now + i * 0.17,
                        i === 3 ? 0.65 : 0.2,
                        "triangle",
                        0.13
                    );
                });
                break;

            case "incoming-hit":
                tone(180, now, 0.3, "triangle", 0.15, 80);
                tone(120, now + 0.12, 0.2, "sine", 0.08, 65);
                break;

            case "incoming-miss":
                tone(440, now, 0.15, "sine", 0.08);
                tone(587, now + 0.13, 0.25, "sine", 0.09);
                break;
        }
    } catch (error) {
        console.warn("Game audio unavailable:", error);
    }
}
