import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { BOX_COLUMNS, TILE_SIZE } from '../../../utils/pokemon';
import { isDisplaySealed, tileTint } from './use-tracker';
import { useThemeContext } from '../../../hooks/contexts/use-local-storage-context';

import type { AnimationEvent } from 'react';
import type { Capture } from '../../../types';
import type { LocationTint } from '../../../utils/location-moves';

const TINTS: LocationTint[] = ['champions', 'out', 'home'];

// keep in sync with .seal-material[data-fade] in styles/tracker.scss
const FADE_MS = 700;
// how long past its time a fade is let go of by the clock, where a theme that draws no place's material never runs it
// to its end
const FADE_LAPSE = 1000;

interface Fade {
  key: number;
  tint: LocationTint;
  out: boolean;
  // its tiles, by their index in the grid, and the mon on each, which must still be there to go on fading
  slots: { index: number; id: number }[];
  // ms into its fade it starts, taking a tile over from one turned back part way; its animation's delay, negated
  from: number;
  // as performance.now(), less `from`: when it would have begun from nothing
  begin: number;
}

// a grid's slots (a box's, or a chunk of search results `columns` across), by index, as one path: a seal material's
// clip; null with none. A layer a tile would exhaust GPU memory in a checklist, so a grid draws a material per kind
function slotsPath (slots: number[], columns: number): string | null {
  if (slots.length === 0) {
    return null;
  }
  const holes = slots.map((index) => {
    const x = (index % columns) * TILE_SIZE;
    const y = Math.floor(index / columns) * TILE_SIZE;
    return `M${x} ${y}h${TILE_SIZE}v${TILE_SIZE}h-${TILE_SIZE}Z`;
  });
  return `path('${holes.join('')}')`;
}

// the start every seal flow keeps in step from (the tracker's syncLoops puts each on it as it starts), and the time a
// flow took and the dex's scale when they were last seen
let flowStart = 0;
let flowSeen: { time: number; scale: number } | null = null;

export function sealFlowStart (): number {
  return flowStart;
}

// a flow drawn after the rest (a box's first seal, a mark fading in or settling) put on their clock before it's first
// drawn, where its animationstart comes a frame or two after it has shown its pattern from the start, and jumped
function syncFlow (el: HTMLDivElement | null) {
  el?.getAnimations().forEach((animation) => {
    animation.startTime = flowStart;
  });
}

// the flows held where they are as the dex is drawn at a new scale, run by the dex once it's drawn there: a theme's flow
// that keeps one pace on screen at any zoom (Wisteria's, --flow-time by --dex-scale) takes longer to drift its period
// the larger it's drawn, so its new time would put every flow somewhere else along it at once. Their start is moved so
// they go on from the phase they were at, where the time changed by the scale alone (one changed with the theme too is
// left as it lands)
export function keepFlowPhase (scale: number) {
  const el = document.querySelector('.dex .seal-flow');
  const time = el ? parseFloat(getComputedStyle(el).animationDuration) * 1000 : 0;
  const now = Number(document.timeline.currentTime);
  if (!(time > 0) || !Number.isFinite(now)) {
    return;
  }
  const seen = flowSeen;
  flowSeen = { time, scale };
  if (!seen || seen.scale === scale || Math.abs((time / seen.time) / (scale / seen.scale) - 1) > 1e-3) {
    return;
  }
  const phase = ((((now - flowStart) / seen.time) % 1) + 1) % 1;
  flowStart = now - phase * time;
  for (const animation of document.getAnimations()) {
    if ('animationName' in animation && animation.animationName === 'seal-flow') {
      animation.startTime = flowStart;
    }
  }
}

// a mark fading in as its mon goes away from where its dex keeps them, out as it comes back, across as it goes from one
// place to another: each change a material over its tiles alone, faded by opacity, which hands a tile it brings in to
// the steady one as its fade ends; a change turned back part way takes over at the opacity it had reached. A grid's
// first draw, still mode, a mon moved to another slot, and a mark that comes or goes with its tile's seal (whose own
// material does) change at once
function useMarkFades (captures: Capture[], sealed: boolean[], tints: (LocationTint | null)[], still: boolean) {
  const [fades, setFades] = useState<Fade[]>([]);
  const fading = useRef(fades);
  // each fade's material once its fade has begun, for how far it has got
  const begun = useRef(new Map<number, HTMLDivElement>());
  const seen = useRef<Map<number, { index: number; sealed: boolean; tint: LocationTint | null }> | null>(null);
  const keys = useRef(0);

  const update = (next: Fade[]) => {
    begun.current.forEach((_, key) => {
      if (!next.some((fade) => fade.key === key)) {
        begun.current.delete(key);
      }
    });
    fading.current = next;
    setFades(next);
  };

  useLayoutEffect(() => {
    const was = seen.current;
    seen.current = new Map(captures.map((capture, index) => [capture.pokemon.id, { index, sealed: sealed[index], tint: tints[index] }]));
    if (!was) {
      return;
    }
    const now = performance.now();
    // what's fading on, less the tiles whose mon has left them or whose seal has gone, the mark with it
    const next = fading.current.map((fade) => ({
      ...fade,
      slots: fade.slots.filter(({ index, id }) => captures[index]?.pokemon.id === id && sealed[index]),
    }));
    const added: Fade[] = [];
    // a tile taken out of a fade of `tint` running the other way, if it's in one: how much of the way back it has, by
    // how far that fade has got (its animation's own time, which starts a frame or so after it's drawn)
    const turn = (tint: LocationTint, out: boolean, index: number) => {
      const fade = next.find((one) => one.tint === tint && one.out === out && one.slots.some((slot) => slot.index === index));
      if (!fade) {
        return 0;
      }
      fade.slots = fade.slots.filter((slot) => slot.index !== index);
      const timing = begun.current.get(fade.key)?.getAnimations()[0]?.effect?.getComputedTiming();
      const into = timing ? Number(timing.localTime ?? 0) + fade.from : fade.from;
      return Math.max(0, Math.min(FADE_MS, FADE_MS - into));
    };
    const add = (tint: LocationTint, out: boolean, index: number, id: number, from: number) => {
      const same = added.find((fade) => fade.tint === tint && fade.out === out && fade.from === from);
      if (same) {
        same.slots.push({ index, id });
      } else {
        added.push({ key: keys.current++, tint, out, slots: [{ index, id }], from, begin: now - from });
      }
    };
    if (!still) {
      captures.forEach((capture, index) => {
        const before = was.get(capture.pokemon.id);
        const tint = tints[index];
        if (!before || before.index !== index || before.tint === tint || !before.sealed || !sealed[index]) {
          return;
        }
        if (before.tint) {
          add(before.tint, true, index, capture.pokemon.id, turn(before.tint, false, index));
        }
        if (tint) {
          add(tint, false, index, capture.pokemon.id, turn(tint, true, index));
        }
      });
    }
    const kept = next.filter((fade) => fade.slots.length > 0);
    const moved = kept.length !== fading.current.length ||
      kept.some((fade, i) => fade.slots.length !== fading.current[i].slots.length);
    if (added.length > 0 || moved) {
      update([...kept, ...added]);
    }
  }, [captures, sealed, tints, still]);

  // a fade let go of by the clock where it never runs, in a theme that draws no place's material
  useEffect(() => {
    if (fades.length === 0) {
      return undefined;
    }
    const lapse = Math.min(...fades.map((fade) => fade.begin)) + FADE_MS + FADE_LAPSE;
    const timer = window.setTimeout(() => {
      const now = performance.now() + 1;
      update(fading.current.filter((fade) => fade.begin + FADE_MS + FADE_LAPSE > now));
    }, Math.max(0, lapse - performance.now()) + 1);
    return () => window.clearTimeout(timer);
  }, [fades]);

  const onFade = (key: number) => ({
    onAnimationStart: (e: AnimationEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) {
        begun.current.set(key, e.currentTarget);
      }
    },
    onAnimationEnd: (e: AnimationEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) {
        update(fading.current.filter((fade) => fade.key !== key));
      }
    },
  });

  return { fades, onFade };
}

interface Props {
  captures: Capture[];
  checklist: boolean;
  homeDex: boolean;
  columns?: number;
}

// a grid's seal materials (styles/tracker.scss), under its tiles: one clipped to its sealed slots, and one over it for
// each place its sealed mons away from where the dex keeps them are in (use-tracker's tileTint), which shows only where
// a theme draws a place's material its own way (.seal-material[data-tint]), and the marks fading in or out over them;
// and one clipped to its unobtainable slots, for a theme that draws those a material of their own (data-hole)
export const SealMaterials = memo(function SealMaterials ({ captures, checklist, homeDex, columns = BOX_COLUMNS }: Props) {
  const { still } = useThemeContext();
  const sealed = useMemo(() => captures.map((capture) => isDisplaySealed(capture, checklist)), [captures, checklist]);
  const tints = useMemo(
    () => captures.map((capture, index) => (sealed[index] ? tileTint(capture, checklist, homeDex) : null)),
    [captures, sealed, checklist, homeDex],
  );
  const { fades, onFade } = useMarkFades(captures, sealed, tints, still);

  const clip = useMemo(() => slotsPath(sealed.flatMap((one, index) => (one ? [index] : [])), columns), [sealed, columns]);
  const holes = useMemo(
    () => slotsPath(captures.flatMap((capture, index) => (capture.captured && capture.status === 'unobtainable' ? [index] : [])), columns),
    [captures, columns],
  );
  // a tile fading in is its fade's alone till it's done
  const steady = useMemo(() => TINTS.flatMap((tint) => {
    const coming = new Set(fades.flatMap((fade) => (fade.tint === tint && !fade.out ? fade.slots.map(({ index }) => index) : [])));
    const clip = slotsPath(tints.flatMap((one, index) => (one === tint && !coming.has(index) ? [index] : [])), columns);
    return clip ? [{ tint, clip }] : [];
  }), [tints, fades, columns]);

  return (
    <>
      {clip &&
        <div className="seal-material" style={{ clipPath: clip }}>
          <div className="seal-flow" ref={syncFlow} />
        </div>
      }
      {holes &&
        <div className="seal-material" data-hole="" style={{ clipPath: holes }}>
          <div className="seal-flow" ref={syncFlow} />
        </div>
      }
      {steady.map(({ tint, clip }) => (
        <div className="seal-material" data-tint={tint} key={tint} style={{ clipPath: clip }}>
          <div className="seal-flow" ref={syncFlow} />
        </div>
      ))}
      {fades.map((fade) => (
        <div
          className="seal-material"
          data-fade={fade.out ? 'out' : 'in'}
          data-tint={fade.tint}
          key={`fade-${fade.key}`}
          style={{ animationDelay: `${-fade.from}ms`, clipPath: slotsPath(fade.slots.map(({ index }) => index), columns) ?? undefined }}
          {...onFade(fade.key)}
        >
          <div className="seal-flow" ref={syncFlow} />
        </div>
      ))}
    </>
  );
});
