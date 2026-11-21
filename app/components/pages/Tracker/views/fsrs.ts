// a small FSRS (4.5, its published default weights): each card's stability (the days till recall falls to 90%) and
// difficulty, moved by each answer's grade, and the day it's next due at 90% recall. A card answered Again comes back
// in a minute, within the session, as a relearning step
export type Grade = 1 | 2 | 3 | 4;

export interface Card {
  stability: number;
  difficulty: number;
  // ms since the epoch
  due: number;
  last: number;
  reps: number;
  lapses: number;
}

const W = [0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474, 0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755];
const DECAY = -0.5;
const FACTOR = 19 / 81;
const DAY = 86_400_000;
const RELEARN_MS = 60_000;

const clampD = (d: number) => Math.min(10, Math.max(1, d));
const initialDifficulty = (grade: Grade) => clampD(W[4] - (grade - 3) * W[5]);

// how likely it's recalled `days` after its last review
export const recall = (card: Card, now: number) => (1 + (FACTOR * Math.max(0, now - card.last)) / DAY / card.stability) ** DECAY;

export function review (card: Card | undefined, grade: Grade, now: number): Card {
  let stability: number;
  let difficulty: number;
  if (!card) {
    stability = W[grade - 1];
    difficulty = initialDifficulty(grade);
  } else {
    const r = recall(card, now);
    difficulty = clampD(W[7] * initialDifficulty(3) + (1 - W[7]) * (card.difficulty - W[6] * (grade - 3)));
    stability = grade === 1
      ? W[11] * card.difficulty ** -W[12] * ((card.stability + 1) ** W[13] - 1) * Math.exp(W[14] * (1 - r))
      : card.stability * (Math.exp(W[8]) * (11 - card.difficulty) * card.stability ** -W[9] * (Math.exp(W[10] * (1 - r)) - 1) *
        (grade === 2 ? W[15] : 1) * (grade === 4 ? W[16] : 1) + 1);
  }
  // at 90% recall the interval is the stability itself
  const due = grade === 1 ? now + RELEARN_MS : now + Math.max(1, Math.round(stability)) * DAY;
  return {
    stability,
    difficulty,
    due,
    last: now,
    reps: (card?.reps ?? 0) + 1,
    lapses: (card?.lapses ?? 0) + (grade === 1 && card ? 1 : 0),
  };
}

// how long till it's due again on each grade, for the buttons
export const intervalMs = (card: Card | undefined, grade: Grade, now: number) => review(card, grade, now).due - now;
