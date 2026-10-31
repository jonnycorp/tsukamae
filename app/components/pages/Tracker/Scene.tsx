import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { createPortal } from 'react-dom';
import { faXmark } from '@fortawesome/free-solid-svg-icons';
import { useEffect, useLayoutEffect, useRef } from 'react';

import { TitleCard, useTitleCard } from './TitleCard';
import { iconClass } from '../../../utils/pokemon';
import { useDexContext } from '../../../hooks/contexts/use-dex-context';
import { useInertPage } from '../../../hooks/use-inert-page';
import { useSceneScale } from './use-scene-scale';
import { useTranslation } from '../../../hooks/use-translation';

import type { CapturePokemon } from '../../../types';
import type { ReactNode, RefObject } from 'react';

// the scenes on this shell, one up at a time: journeys (J), the red pen (P), the atlas (G), the trainer cards (C) and
// the ball orrery (B)
export type LabScene = 'journeys' | 'redpen' | 'atlas' | 'trainers' | 'orrery';

// how a scene that filters the dex was left, to be come back to as it was (index.tsx's layer): how far down it was, and
// whatever else it keeps (Journeys' split, the orrery's orbits)
export interface SceneView {
  scroll: number;
}

// how far down the scene that `el` is in has been scrolled
export function sceneScroll (el: Element | null): number {
  return el?.closest('.scene-body')?.scrollTop ?? 0;
}

// a scene come back to from the dex: as far down as it was left, once what it draws has its height (`ready`)
export function useScrollBack (ref: RefObject<Element>, back: SceneView | null, ready: boolean) {
  const scrolled = useRef(false);
  useLayoutEffect(() => {
    const body = ref.current?.closest('.scene-body');
    if (back && ready && body && !scrolled.current) {
      scrolled.current = true;
      body.scrollTop = back.scroll;
    }
  }, [ref, back, ready]);
}

// a scene's tooltip beside a point in the window: `gap` to its right, or flipped to its left where the window ends,
// level with it, kept inside the window; set in the tip's own pixels, which the scene's zoom scales
export function placeBeside (tip: HTMLElement, x: number, y: number, gap: number) {
  const zoom = tip.currentCSSZoom;
  const w = tip.offsetWidth * zoom;
  const h = tip.offsetHeight * zoom;
  const left = x + gap + w <= window.innerWidth ? x + gap : x - gap - w;
  const top = Math.min(window.innerHeight - h - 8, Math.max(8, y - h / 2));
  tip.style.left = `${Math.max(8, left) / zoom}px`;
  tip.style.top = `${top / zoom}px`;
}

interface Props {
  // the scene's own class beside .scene, which every shortcut and the dex's zoom stand down under (use-hotkey)
  name: string;
  title: string;
  hint: string;
  onClose: () => void;
  // come back to rather than opened (from the dex its press filtered): no title card, and no entrance
  quiet?: boolean;
  // what the scene shows: laid out for 1400px and zoomed up to a wider window by `scale` (use-scene-scale)
  children: (view: { scale: number }) => ReactNode;
}

// a scene: over the window as the almanac is, under the same bar (its name in the accent, the dex's beside it, a hint
// and the close), opening on its title card. Escape closes it, unless something in it (a menu) has claimed the key first
export function Scene ({ name, title, hint, onClose, quiet = false, children }: Props) {
  const { activeDex } = useDexContext();
  const { t } = useTranslation();
  const rootRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const scale = useSceneScale();
  const { titleCard, intro, gate } = useTitleCard(quiet);

  useInertPage();

  // quiet: every entrance (the banners, the cards rising, what the scene draws in as it opens) at its end before the
  // first frame, each render till then, as the scene's own parts come in over its first renders; only the scene's
  // fade over the dex is left. What moves after (a toggle, a tooltip) moves as ever
  const opening = useRef(quiet);
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!opening.current || !root) {
      return;
    }
    for (const animation of root.getAnimations({ subtree: true })) {
      if ((animation.effect as KeyframeEffect | null)?.target !== root && animation.effect?.getTiming().iterations !== Infinity) {
        animation.finish();
      }
    }
  });
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      opening.current = false;
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    bodyRef.current?.focus({ preventScroll: true });
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  }, [onClose]);

  return createPortal(
    <div aria-label={title} aria-modal="true" className={`scene ${name}`} data-gate={gate || undefined} ref={rootRef} role="dialog">
      <header className="scene-top">
        <span className="scene-logo"><span>{title}</span></span>
        <h1>{activeDex!.title}</h1>
        <span className="scene-hint">{hint}</span>
        <button aria-label={t('scene.close')} className="scene-close" onClick={onClose} title={t('scene.close')} type="button">
          <FontAwesomeIcon icon={faXmark} />
        </button>
      </header>
      <div className="scene-body" data-intro={intro || undefined} ref={bodyRef} tabIndex={-1}>
        {children({ scale })}
      </div>
      {titleCard && <TitleCard title={title} />}
    </div>,
    document.body,
  );
}

// a mon's sprite at a scene's size (`zoom` times the sheet's), its box as tall as the tallest of them so a row of
// mons stands on one line
export function SceneMon ({ pokemon, zoom = 1 }: { pokemon: CapturePokemon; zoom?: number }) {
  const { activeDexView } = useDexContext();
  return (
    <span className="scene-mon" style={{ zoom }}>
      <i className={iconClass(pokemon, activeDexView!)} />
    </span>
  );
}
