import { sameId } from '../../../utils/game-reach';
import { stampedSave } from '../../../utils/capture-fields';

import type { Capture, GameSave } from '../../../types';

// one of your games and the mons its trainer caught
export interface TrainerCard {
  save: GameSave;
  mons: Capture[];
}

// a trainer who isn't one of yours (a trade, a gift, an event's OT), the games their mons came from and the mons
export interface OtherTrainer {
  ot: string;
  games: string[];
  mons: Capture[];
}

export interface TrainerCardsData {
  cards: TrainerCard[];
  others: OtherTrainer[];
  // sealed mons with no OT to go by
  unknown: number;
}

// the trainer cards (C): every sealed mon on the card of the trainer who caught it. One of your games where it's
// still all four fields that game's pick filled in (stampedSave); a HOME gift, its game's mark but HOME's OT and ID,
// on your HOME entry's; anyone else's on a card of their own, by OT. Sealed only, as a record's other tallies are: an
// unsealed mark's fields are placeholders
export function trainerCards (saves: GameSave[], captures: Capture[]): TrainerCardsData {
  const bySave = new Map<string, Capture[]>(saves.map((save) => [save.id, []]));
  const others = new Map<string, OtherTrainer>();
  let unknown = 0;
  for (const capture of captures) {
    if (!capture.sealed) {
      continue;
    }
    const save = stampedSave(saves, capture) ??
      // its ID No. read as a number, as Gen 9 shows one (the Red Pen's homeFileOf reads it so too)
      saves.find((home) => home.game === 'home' && home.ot === capture.ot && (!capture.tid || sameId(home.tid, capture.tid)));
    if (save) {
      bySave.get(save.id)!.push(capture);
      continue;
    }
    if (!capture.ot) {
      unknown++;
      continue;
    }
    const other = others.get(capture.ot) ?? { ot: capture.ot, games: [], mons: [] };
    other.mons.push(capture);
    if (capture.origin_game && !other.games.includes(capture.origin_game)) {
      other.games.push(capture.origin_game);
    }
    others.set(capture.ot, other);
  }
  return {
    cards: saves.map((save) => ({ save, mons: bySave.get(save.id)! })),
    others: [...others.values()].sort((a, b) => b.mons.length - a.mons.length || a.ot.localeCompare(b.ot)),
    unknown,
  };
}
