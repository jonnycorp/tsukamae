import { useEffect, useState } from 'react';

import { useThemeContext } from '../../../hooks/contexts/use-local-storage-context';

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
// a modifier alone (an Alt+Tab begun) skips nothing
const MODIFIERS = ['Shift', 'Control', 'Alt', 'Meta'];

interface Props {
  title: string;
  // the dex's name, under the scene's
  sub: string;
  hint: string;
}

// true once a scene's first frames have gone by (CALM_FRAMES): till then it holds all its motion at its start
// (data-gate, styles/title-card.scss), so its title card never starts in a stall and jumps
export function useCalmStart (): boolean {
  const [calm, setCalm] = useState(false);

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
        setCalm(true);
      } else {
        frame = requestAnimationFrame(tick);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  return calm;
}

// a scene's title card (the timeline, the review, the almanac): its name slammed onto a slash of the accent with a
// flash and a shake, the dex's name sliding in under it, then cleared
export function TitleCard ({ title, sub, hint }: Props) {
  return (
    <div aria-hidden="true" className="title-card">
      <div className="title-card-flash" />
      <div className="title-card-slash" />
      <div className="title-card-title"><span>{title}</span></div>
      <div className="title-card-sub"><span>{sub}</span></div>
      <div className="title-card-skip">{hint}</div>
    </div>
  );
}

// a scene opening on its title card (the review, the almanac): its motion held (gate) till its first frames have
// gone by (useCalmStart), what's under its bar out of sight with its entrance held (intro) till the card's about to
// clear, then faded in as it does; the card gone once it has (titleCard). A key (Escape aside, which still closes the
// scene) or a click skips to the end, the key claimed so it does nothing else. Still mode: no card, the scene there
// at once
export function useTitleCard (): { titleCard: boolean; intro: boolean; gate: boolean } {
  const { still } = useThemeContext();
  const calm = useCalmStart();
  const [card, setCard] = useState(!still);
  const [intro, setIntro] = useState(!still);

  useEffect(() => {
    if (!card || !calm) {
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
    const reveal = window.setTimeout(() => setIntro(false), REVEAL_MS);
    const done = window.setTimeout(() => setCard(false), CARD_MS);
    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('pointerdown', skip, true);
    return () => {
      window.clearTimeout(reveal);
      window.clearTimeout(done);
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('pointerdown', skip, true);
    };
  }, [card, calm]);

  return { titleCard: card, intro, gate: card && !calm };
}
