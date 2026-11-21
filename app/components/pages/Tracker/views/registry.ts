import { BallGalaxy } from './BallGalaxy';
import { CatchDays } from './CatchDays';
import { ChampionsRoster } from './ChampionsRoster';
import { DexMosaic } from './DexMosaic';
import { FindSketch } from './FindSketch';
import { NameQuiz } from './NameQuiz';
import { NatureGrid } from './NatureGrid';
import { RecordCheck } from './RecordCheck';
import { ReviewSheet } from './ReviewSheet';

import type { ComponentType } from 'react';
import type { ViewKey } from './views-i18n';
import type { ViewProps } from './views-kit';

// the views, in the deck's order (X, then a card or its number). Each is its own file here, its own
// styles/views/_<id>.scss and its own keys in views-i18n.ts: taking one out is those three and its line below
export interface ViewSketch {
  id: string;
  title: ViewKey;
  blurb: ViewKey;
  // one character drawn large on its card
  glyph: string;
  // reads the records, so a checklist (which keeps none) doesn't offer it
  records: boolean;
  // its own key from the dex (index.tsx), beside its number in the deck
  hotkey?: string;
  component: ComponentType<ViewProps>;
}

export const VIEWS: ViewSketch[] = [
  { id: 'galaxy', title: 'galaxy.title', blurb: 'galaxy.blurb', glyph: '球', records: true, hotkey: 'U', component: BallGalaxy },
  { id: 'champions', title: 'champions.title', blurb: 'champions.blurb', glyph: '覧', records: false, component: ChampionsRoster },
  { id: 'mosaic', title: 'mosaic.title', blurb: 'mosaic.blurb', glyph: '壁', records: false, hotkey: 'K', component: DexMosaic },
  { id: 'days', title: 'days.title', blurb: 'days.blurb', glyph: '日', records: true, component: CatchDays },
  { id: 'quiz', title: 'quiz.title', blurb: 'quiz.blurb', glyph: '名', records: false, component: NameQuiz },
  { id: 'check', title: 'check.title', blurb: 'check.blurb', glyph: '検', records: true, component: RecordCheck },
  { id: 'sheet', title: 'sheet.title', blurb: 'sheet.blurb', glyph: '表', records: true, component: ReviewSheet },
  { id: 'find', title: 'find.title', blurb: 'find.blurb', glyph: '探', records: false, component: FindSketch },
  { id: 'nature', title: 'nature.title', blurb: 'nature.blurb', glyph: '性', records: true, component: NatureGrid },
];

export type ViewSceneId = 'views' | `view:${string}`;

export const isViewScene = (scene: string | null): scene is ViewSceneId => scene === 'views' || Boolean(scene?.startsWith('view:'));

export const viewSketch = (scene: ViewSceneId): ViewSketch | undefined => VIEWS.find((sketch) => `view:${sketch.id}` === scene);
