import { BallGalaxy } from './BallGalaxy';
import { CatchDays } from './CatchDays';
import { ChampionsRoster } from './ChampionsRoster';
import { DexMosaic } from './DexMosaic';
import { NameQuiz } from './NameQuiz';
import { NatureGrid } from './NatureGrid';
import { RecordCheck } from './RecordCheck';

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
  { id: 'galaxy', title: 'galaxy.title', blurb: 'galaxy.blurb', glyph: '球', records: true, component: BallGalaxy },
  { id: 'champions', title: 'champions.title', blurb: 'champions.blurb', glyph: '覧', records: false, component: ChampionsRoster },
  { id: 'mosaic', title: 'mosaic.title', blurb: 'mosaic.blurb', glyph: '壁', records: false, component: DexMosaic },
  { id: 'days', title: 'days.title', blurb: 'days.blurb', glyph: '日', records: true, component: CatchDays },
  { id: 'quiz', title: 'quiz.title', blurb: 'quiz.blurb', glyph: '名', records: false, component: NameQuiz },
  { id: 'check', title: 'check.title', blurb: 'check.blurb', glyph: '検', records: true, component: RecordCheck },
  { id: 'nature', title: 'nature.title', blurb: 'nature.blurb', glyph: '性', records: true, component: NatureGrid },
];

export type LabSceneId = 'lab' | `lab:${string}`;

export const isLabScene = (scene: string | null): scene is LabSceneId => scene === 'lab' || Boolean(scene?.startsWith('lab:'));

export const labSketch = (scene: LabSceneId): LabSketch | undefined => LAB_SKETCHES.find((sketch) => `lab:${sketch.id}` === scene);
