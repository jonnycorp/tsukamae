import { CatchCalendar } from './CatchCalendar';

import type { ComponentType } from 'react';
import type { LabKey } from './lab-i18n';
import type { LabProps } from './lab-kit';

// the lab's sketches, in the deck's order (X, then a card or its number). Each is its own file here, its own
// styles/lab/_<id>.scss and its own keys in lab-i18n.ts: taking one out is those three and its line below
export interface LabSketch {
  id: string;
  title: LabKey;
  blurb: LabKey;
  // one character drawn large on its card
  glyph: string;
  // reads the records, so a checklist (which keeps none) doesn't offer it
  records: boolean;
  component: ComponentType<LabProps>;
}

export const LAB_SKETCHES: LabSketch[] = [
  { id: 'calendar', title: 'calendar.title', blurb: 'calendar.blurb', glyph: '暦', records: true, component: CatchCalendar },
];

export type LabSceneId = 'lab' | `lab:${string}`;

export const isLabScene = (scene: string | null): scene is LabSceneId => scene === 'lab' || Boolean(scene?.startsWith('lab:'));

export const labSketch = (scene: LabSceneId): LabSketch | undefined => LAB_SKETCHES.find((sketch) => `lab:${sketch.id}` === scene);
