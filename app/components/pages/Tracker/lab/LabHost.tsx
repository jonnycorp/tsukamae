import { useEffect } from 'react';

import { LAB_SKETCHES, labSketch } from './registry';
import { Scene } from '../Scene';
import { labText, useLabText } from './lab-i18n';

import type { CSSProperties, PointerEvent } from 'react';
import type { LabProps } from './lab-kit';
import type { LabSceneId } from './registry';
import type { Locale } from '../../../../i18n/translations';
import type { SceneView } from '../Scene';
import type { TrackerFilters } from '../filters';

interface Props extends Omit<LabProps, 'onFilter'> {
  scene: LabSceneId;
  checklist: boolean;
  onOpen: (scene: LabSceneId) => void;
  onFilter: (filters: TrackerFilters, view: SceneView, scene: LabSceneId) => void;
}

// the name on the filters' row tab that goes back to a sketch (index.tsx's layer)
export function labTitle (locale: Locale, scene: LabSceneId): string {
  const sketch = labSketch(scene);
  return labText(locale, sketch ? sketch.title : 'lab.title');
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

// the lab (X): a deck of the sketches, each opening over the dex as any scene does
function LabDeck ({ checklist, onClose, onOpen }: Pick<Props, 'checklist' | 'onClose' | 'onOpen'>) {
  const { lt } = useLabText();
  const sketches = LAB_SKETCHES.filter((sketch) => !checklist || !sketch.records);

  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (e.defaultPrevented || e.repeat || e.metaKey || e.ctrlKey || e.altKey || !Number.isInteger(n) || n < 1 || n > sketches.length) {
        return;
      }
      e.preventDefault();
      onOpen(`lab:${sketches[n - 1].id}`);
    };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [sketches, onOpen]);

  return (
    <Scene hint={lt('lab.hint')} name="lab-deck" onClose={onClose} title={lt('lab.title')}>
      {({ scale }) => (
        <div className="lab-deck" style={{ zoom: scale }}>
          <div className="lab-cards">
            {sketches.map((sketch, i) => (
              <button
                className="lab-card"
                key={sketch.id}
                onClick={() => onOpen(`lab:${sketch.id}`)}
                onPointerLeave={unlean}
                onPointerMove={lean}
                style={{ '--i': i } as CSSProperties}
                type="button"
              >
                <span aria-hidden="true" className="lab-card-glyph">{sketch.glyph}</span>
                <kbd>{i + 1}</kbd>
                <strong>{lt(sketch.title)}</strong>
                <small>{lt(sketch.blurb)}</small>
              </button>
            ))}
          </div>
          <p className="lab-note">{lt('lab.note')}</p>
        </div>
      )}
    </Scene>
  );
}

// the deck, or the sketch it opened
export function LabHost ({ scene, checklist, back, onOpen, onClose, onFilter, onLocate, onReview }: Props) {
  const sketch = labSketch(scene);
  if (!sketch) {
    return <LabDeck checklist={checklist} onClose={onClose} onOpen={onOpen} />;
  }
  const Sketch = sketch.component;
  return (
    <Sketch
      back={back}
      onClose={onClose}
      onFilter={(filters, view) => onFilter(filters, view, scene)}
      onLocate={onLocate}
      onReview={onReview}
    />
  );
}
