import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { useDexContext } from '../../../hooks/contexts/use-dex-context';
import { useThemeContext } from '../../../hooks/contexts/use-local-storage-context';
import { useTranslation } from '../../../hooks/use-translation';

// in step with styles/title-card.scss: the card clears from 1050ms over 300ms. What's under it starts fading in just
// before that, once the dex's name has landed (950ms) and nothing on the card moves: its first paint comes in a burst
// that holds the frames back, unseen while all stands still
const CARD_MS = 1350;
const REVEAL_MS = 960;
// a scene's first frames carry its first paint (its stage or its body newly on the page, rastered in a burst that
// holds the frames back): its motion waits till the frames come steadily again, the last few each within a share of
// their middle one and none slower than a stall's floor (a 30, 60 or 144 Hz display alike), or at most MAX_GATE_MS
const CALM_FRAMES = 3;
const CALM_SPREAD = 0.35;
const STALL_MS = 50;
const MAX_GATE_MS = 600;
// a modifier alone (an Alt+Tab begun) skips nothing, here or on the timeline
export const MODIFIERS = ['Shift', 'Control', 'Alt', 'Meta'];
// the most of the card's width a scene's name takes: a long one (Trainer Cards) set smaller in a narrow window, on its
// one line, rather than broken onto two
const NAME_SHARE = 0.92;

// true once a scene's first frames have gone by (CALM_FRAMES): till then it holds all its motion at its start
// (data-gate, styles/title-card.scss), so its title card never starts in a stall and jumps. A new run (the timeline's
// replay, its stage built anew) waits out its own first frames
export function useCalmStart (run = 0): boolean {
  const [calmRun, setCalmRun] = useState<number | null>(null);

  useEffect(() => {
    const start = performance.now();
    const recent: number[] = [];
    let last = 0;
    let frame = 0;
    const steady = () => {
      const middle = [...recent].sort((a, b) => a - b)[Math.floor(CALM_FRAMES / 2)];
      return recent.length === CALM_FRAMES && recent.every((interval) => interval < STALL_MS && Math.abs(interval - middle) <= middle * CALM_SPREAD);
    };
    const tick = (now: number) => {
      if (last) {
        recent.push(now - last);
        if (recent.length > CALM_FRAMES) {
          recent.shift();
        }
      }
      last = now;
      if (steady() || now - start > MAX_GATE_MS) {
        setCalmRun(run);
      } else {
        frame = requestAnimationFrame(tick);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [run]);

  return calmRun === run;
}

// a scene's title card (the timeline, the review, the almanac, a page in the scene frame): its name slammed onto a
// slash of the accent with a flash and a shake, the dex's name sliding in under it, then cleared
export function TitleCard ({ title }: { title: string }) {
  const { activeDex } = useDexContext();
  const { t } = useTranslation();
  const cardRef = useRef<HTMLDivElement>(null);

  // the name's size (--fit, styles/title-card.scss) as it's laid out, before its first frame
  useLayoutEffect(() => {
    const card = cardRef.current;
    const name = card?.querySelector<HTMLElement>('.title-card-title span');
    if (card && name) {
      card.style.removeProperty('--fit');
      card.style.setProperty('--fit', String(Math.min(1, (card.clientWidth * NAME_SHARE) / name.offsetWidth)));
    }
  }, [title]);

  return (
    <div aria-hidden="true" className="title-card" ref={cardRef}>
      <div className="title-card-flash" />
      <div className="title-card-slash" />
      <div className="title-card-title"><span>{title}</span></div>
      <div className="title-card-sub"><span>{activeDex!.title}</span></div>
      <div className="title-card-skip">{t('scene.skip')}</div>
    </div>
  );
}

// a scene opening on its title card (the review, the almanac, a page in the scene frame): its motion held (gate) till
// its first frames have gone by (useCalmStart), what's under its bar out of sight with its entrance held (intro) till
// the card's about to clear, then faded in as it does; the card gone once it has (titleCard). A key (Escape aside,
// which still closes the scene) or a click skips to the end, the key claimed so it does nothing else. Still mode, or a
// scene come back to (quiet): no card, the scene there at once
export function useTitleCard (quiet = false): { titleCard: boolean; intro: boolean; gate: boolean } {
  const { still } = useThemeContext();
  const calm = useCalmStart();
  const [card, setCard] = useState(!still && !quiet);
  const [intro, setIntro] = useState(!still && !quiet);

  // the card's keys and clicks from its first frame, its motion held or not, so none reaches the scene still hidden
  // under it
  useEffect(() => {
    if (!card) {
      return undefined;
    }
    const skip = () => {
      setIntro(false);
      setCard(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || MODIFIERS.includes(e.key)) {
        return;
      }
      e.preventDefault();
      e.stopImmediatePropagation();
      if (!e.repeat) {
        skip();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('pointerdown', skip, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('pointerdown', skip, true);
    };
  }, [card]);

  // its clock from the calm
  useEffect(() => {
    if (!card || !calm) {
      return undefined;
    }
    const reveal = window.setTimeout(() => setIntro(false), REVEAL_MS);
    const done = window.setTimeout(() => setCard(false), CARD_MS);
    return () => {
      window.clearTimeout(reveal);
      window.clearTimeout(done);
    };
  }, [card, calm]);

  return { titleCard: card, intro, gate: card && !calm };
}
