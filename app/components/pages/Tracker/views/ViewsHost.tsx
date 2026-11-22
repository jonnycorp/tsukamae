import { useEffect, useState } from 'react';

import { VIEWS, viewSketch } from './registry';
import { Scene } from '../Scene';
import { viewText, useViewText } from './views-i18n';

import type { CSSProperties, PointerEvent } from 'react';
import type { ViewProps } from './views-kit';
import type { ViewSceneId } from './registry';
import type { Locale } from '../../../../i18n/translations';
import type { SceneView } from '../Scene';
import type { TrackerFilters } from '../filters';

interface Props extends Omit<ViewProps, 'onFilter'> {
  scene: ViewSceneId;
  checklist: boolean;
  onOpen: (scene: ViewSceneId) => void;
  onFilter: (filters: TrackerFilters, view: SceneView, scene: ViewSceneId) => void;
}

// the name on the filters' row tab that goes back to a view (index.tsx's layer)
export function viewTitle (locale: Locale, scene: ViewSceneId): string {
  const sketch = viewSketch(scene);
  return viewText(locale, sketch ? sketch.title : 'views.title');
}

// a card leaning toward the pointer, a little
function lean (e: PointerEvent<HTMLButtonElement>) {
  const rect = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty('--lx', ((e.clientX - rect.left) / rect.width - 0.5).toFixed(3));
  e.currentTarget.style.setProperty('--ly', ((e.clientY - rect.top) / rect.height - 0.5).toFixed(3));
}

function unlean (e: PointerEvent<HTMLButtonElement>) {
  e.currentTarget.style.removeProperty('--lx');
  e.currentTarget.style.removeProperty('--ly');
}

// the views deck (X): a deck of the views, each opening over the dex as any scene does. A menu, so no title card of its
// own: X then a number, typed straight on, opens the view rather than skipping the card
function ViewDeck ({ checklist, onClose, onOpen }: Pick<Props, 'checklist' | 'onClose' | 'onOpen'>) {
  const { lt } = useViewText();
  const sketches = VIEWS.filter((sketch) => !checklist || !sketch.records);

  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (e.defaultPrevented || e.repeat || e.metaKey || e.ctrlKey || e.altKey || !Number.isInteger(n) || n < 1 || n > sketches.length) {
        return;
      }
      e.preventDefault();
      onOpen(`view:${sketches[n - 1].id}`);
    };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [sketches, onOpen]);

  return (
    <Scene hint={lt('views.hint')} name="view-deck" onClose={onClose} quiet title={lt('views.title')}>
      {({ scale }) => (
        <div className="view-deck-page" style={{ zoom: scale }}>
          <div className="view-cards">
            {sketches.map((sketch, i) => (
              <button
                className="view-card"
                key={sketch.id}
                onClick={() => onOpen(`view:${sketch.id}`)}
                onPointerLeave={unlean}
                onPointerMove={lean}
                style={{ '--i': i } as CSSProperties}
                type="button"
              >
                <span aria-hidden="true" className="view-card-glyph">{sketch.glyph}</span>
                <kbd>{i + 1}</kbd>
                {sketch.hotkey && <kbd className="view-card-hotkey">{sketch.hotkey}</kbd>}
                <strong>{lt(sketch.title)}</strong>
                <small>{lt(sketch.blurb)}</small>
              </button>
            ))}
          </div>
        </div>
      )}
    </Scene>
  );
}

// a view as it was left for a filter's layer, and whether it came from the deck, which coming back to it (a remount)
// would otherwise forget
type HostView = SceneView & { deck?: boolean };

// the deck, or the view it opened; a view closed goes back to the deck it came from, or to the dex when its own key
// opened it there; the deck closed goes back to the dex
export function ViewsHost ({ scene, checklist, back, onOpen, onClose, onFilter, onLocate, onReview, onSpot }: Props) {
  const sketch = viewSketch(scene);
  const [viaDeck, setViaDeck] = useState(!sketch || Boolean((back as HostView | null)?.deck));
  if (!sketch && !viaDeck) {
    setViaDeck(true);
  }
  if (!sketch) {
    return <ViewDeck checklist={checklist} onClose={onClose} onOpen={onOpen} />;
  }
  const Sketch = sketch.component;
  return (
    <Sketch
      back={back}
      onClose={() => {
        if (!viaDeck) {
          onClose();
          return;
        }
        onOpen('views');
      }}
      onFilter={(filters, view) => {
        const left: HostView = viaDeck ? { ...view, deck: true } : view;
        onFilter(filters, left, scene);
      }}
      onLocate={onLocate}
      onReview={onReview}
      onSpot={onSpot}
    />
  );
}
