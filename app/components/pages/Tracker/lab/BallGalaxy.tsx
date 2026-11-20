import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPause, faPlay } from '@fortawesome/free-solid-svg-icons';
import { useEffect, useMemo, useRef, useState } from 'react';

import { BALL_NAMES } from '../../../../utils/capture-fields';
import { LabTip } from './LabTip';
import { Scene, SceneMon } from '../Scene';
import { displayName } from '../../../library/PokemonName';
import { alpha, easeOut, fitCanvas, token, useCalm, useFrameLoop } from './lab-kit';
import { localizeBall } from '../../../../i18n/names';
import { useLabText } from './lab-i18n';
import { useTrackerState } from '../use-tracker';

import type { Capture } from '../../../../types';
import type { LabProps } from './lab-kit';
import type { PointerEvent as ReactPointerEvent, WheelEvent } from 'react';

const DAY_MS = 86_400_000;
// the spiral the balls sit along, by the order they were first used: its start out from the heart, and the room
// between two balls along it
const SPIRAL_START = 30;
const SPIRAL_ROOM = 16;
// the room the scrubber takes at the foot, which the galaxy is centred above
const FOOT = 96;
// a ball's mons in rings round it: the first ring's gap from the ball, the step out, and how close they pack
const RING_GAP = 9;
const RING_STEP = 5.5;
const RING_PITCH = 7;
// one turn of the whole galaxy, and of a mon round its ball (an outer ring slower)
const GALAXY_TURN = 420_000;
const ORBIT_TURN = 26_000;
// the replay on opening: the whole history in this long, a newly caught mon flying out to its ring in FLY_MS
const REPLAY_MS = 7000;
const FLY_MS = 900;
const TIP_MONS = 24;

interface Mote {
  capture: Capture;
  born: number;
  ring: number;
  angle: number;
  radius: number;
}

interface Body {
  ball: string;
  // how far round the spiral (radians)
  theta: number;
  mons: Capture[];
  motes: Mote[];
  first: number;
  last: number;
  pitch: number;
  x: number;
  y: number;
  size: number;
  reach: number;
}

const dayOf = (capture: Capture) => Date.parse(`${capture.catch_date}T00:00:00`);

function buildBodies (captures: Capture[]): Body[] {
  const groups = new Map<string, Capture[]>();
  for (const capture of captures) {
    groups.set(capture.ball!, [...(groups.get(capture.ball!) ?? []), capture]);
  }
  const bodies = [...groups.entries()].map(([ball, mons]) => {
    const sorted = [...mons].sort((a, b) => dayOf(a) - dayOf(b));
    return { ball, mons: sorted, first: dayOf(sorted[0]), last: dayOf(sorted[sorted.length - 1]) };
  }).sort((a, b) => a.first - b.first || b.mons.length - a.mons.length);

  const sized = bodies.map((body) => {
    const size = Math.round(16 + 7 * Math.log2(1 + body.mons.length));
    const motes: Mote[] = [];
    let ring = 0;
    let placed = 0;
    let radius = size / 2 + RING_GAP;
    while (placed < body.mons.length) {
      radius = size / 2 + RING_GAP + ring * RING_STEP;
      const fits = Math.max(6, Math.floor((2 * Math.PI * radius) / RING_PITCH));
      const here = Math.min(fits, body.mons.length - placed);
      for (let k = 0; k < here; k++) {
        const capture = body.mons[placed + k];
        motes.push({ capture, born: dayOf(capture), ring, angle: (2 * Math.PI * k) / here + ring * 0.6, radius });
      }
      placed += here;
      ring++;
    }
    return { ...body, motes, size, reach: radius + 4 };
  });
  // an Archimedean spiral (r = start + pitch × θ), its turns far enough apart for the biggest ball, each ball its own
  // reach and the last one's on from the one before
  const pitch = (2 * Math.max(40, ...sized.map((body) => body.reach)) + SPIRAL_ROOM) / (2 * Math.PI);
  let theta = 0;
  return sized.map((body, i) => {
    if (i > 0) {
      const room = sized[i - 1].reach + body.reach + SPIRAL_ROOM;
      theta += room / (SPIRAL_START + pitch * theta + room / 2);
    }
    const r = spiralRadius(theta, pitch);
    return { ...body, theta, pitch, x: Math.cos(theta) * r, y: Math.sin(theta) * r };
  });
}

const spiralRadius = (theta: number, pitch: number) => SPIRAL_START + pitch * theta;

// the ball galaxy: the balls you've used as a spiral galaxy, the first one ever used at its heart and each after it a
// golden turn further out, so the spiral is the order your balls came into your life; a ball's size is how many mons
// it holds, each mon a mote circling it in its first type's colour. It opens by replaying your history, every mon
// flying out to its ball on the day it was caught; the bar at the foot scrubs or replays it. Drag to look around, wheel
// to zoom; a ball pointed at shows its mons (close enough, a mote shows its mon) and pressed filters the dex to it
export function BallGalaxy ({ back, onClose, onFilter, onLocate }: LabProps) {
  const { captures } = useTrackerState();
  const { lt, locale } = useLabText();
  const calm = useCalm();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const usable = useMemo(() => captures.filter((capture) => capture.captured && capture.status !== 'unobtainable' &&
    capture.ball && capture.ball !== 'unknown' && capture.catch_date), [captures]);
  const bodies = useMemo(() => buildBodies(usable), [usable]);
  const start = bodies.reduce((min, body) => Math.min(min, body.first), Infinity);
  const end = bodies.reduce((max, body) => Math.max(max, body.last), -Infinity) + DAY_MS;

  const images = useMemo(() => {
    const map = new Map<string, HTMLImageElement>();
    for (const body of bodies) {
      const img = new Image();
      img.src = `/balls/${body.ball}.png`;
      map.set(body.ball, img);
    }
    return map;
  }, [bodies]);

  // the replay's day (ms), and whether it's playing; opened from the dex, or calm, it starts at the end
  const [cursor, setCursor] = useState(() => (back || calm ? end : start));
  const [playing, setPlaying] = useState(() => !back && !calm && bodies.length > 0);
  const cursorRef = useRef(cursor);
  cursorRef.current = cursor;

  const [hot, setHot] = useState<{ body: Body; mote: Mote | null; x: number; y: number } | null>(null);
  const hotRef = useRef(hot);
  hotRef.current = hot;

  // the camera, eased toward where it's asked to be
  const camera = useRef({ x: 0, y: 0, zoom: 1, tx: 0, ty: 0, tzoom: 1 });
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  // when each mote and ball came into view in the replay (performance.now()), for its flight out
  const revealed = useRef(new Map<Capture, number>());
  const ballsShown = useRef(new Map<string, number>());
  const spin = useRef(0);
  // the motes' clock, which the picking reads to find them where they're drawn
  const clock = useRef(0);
  const stars = useRef<{ x: number; y: number; r: number; a: number }[]>([]);

  // the extent fitted to the window as it opens
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const extent = bodies.reduce((most, body) => Math.max(most, Math.hypot(body.x, body.y) + body.reach), 200);
    const fit = Math.min(1.6, Math.min(canvas.clientWidth, canvas.clientHeight - FOOT) / (2 * extent + 60));
    Object.assign(camera.current, { zoom: fit * 0.8, tzoom: fit });
    stars.current = Array.from({ length: 220 }, () => ({ x: Math.random(), y: Math.random(), r: Math.random() * 1.2 + 0.2, a: Math.random() * 0.5 + 0.1 }));
  }, [bodies]);

  // the replay: the cursor runs from the first day to the last over REPLAY_MS
  useFrameLoop((_, dt) => {
    const next = cursorRef.current + ((end - start) / REPLAY_MS) * dt;
    if (next >= end) {
      setCursor(end);
      setPlaying(false);
    } else {
      setCursor(next);
    }
  }, playing);

  useFrameLoop((t, dt) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    clock.current = t;
    const ctx = fitCanvas(canvas);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const cam = camera.current;
    const ease = 1 - Math.pow(0.001, dt / 1000);
    cam.x += (cam.tx - cam.x) * ease * 3;
    cam.y += (cam.ty - cam.y) * ease * 3;
    cam.zoom += (cam.tzoom - cam.zoom) * ease * 3;
    // the turn holds while a ball's pointed at, so it stays under the pointer
    if (!hotRef.current && !calm) {
      spin.current += dt;
    }
    const now = performance.now();
    const dark = document.documentElement.dataset.mode === 'dark';
    const accent = token('--accent');
    const ink = token('--ink');
    const typeColors = new Map<string, string>();
    const typeColor = (type: string) => typeColors.get(type) ?? typeColors.set(type, token(`--type-${type}`)).get(type)!;

    ctx.clearRect(0, 0, w, h);
    // the far stars, still, and a glow at the heart in the theme's accent
    for (const star of stars.current) {
      ctx.globalAlpha = star.a * (dark ? 1 : 0.5);
      ctx.fillStyle = ink;
      ctx.beginPath();
      ctx.arc(star.x * w, star.y * h, star.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    const cx = w / 2 - cam.x * cam.zoom;
    const cy = (h - FOOT) / 2 - cam.y * cam.zoom;
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 420 * cam.zoom);
    glow.addColorStop(0, alpha(accent, dark ? 0.28 : 0.16));
    glow.addColorStop(1, alpha(accent, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    const turn = calm ? 0 : (spin.current / GALAXY_TURN) * Math.PI * 2;
    const cos = Math.cos(turn);
    const sin = Math.sin(turn);
    const toScreen = (x: number, y: number) => [cx + (x * cos - y * sin) * cam.zoom, cy + (x * sin + y * cos) * cam.zoom];
    const hotBody = hotRef.current?.body;

    // the spiral's arm, out as far as the newest ball the replay has reached, fading toward the heart
    const reached = bodies.filter((body) => body.first <= cursorRef.current).pop();
    if (reached) {
      ctx.strokeStyle = accent;
      ctx.lineWidth = Math.max(1, 1.5 * cam.zoom);
      ctx.lineCap = 'round';
      const steps = Math.max(2, Math.ceil(reached.theta / 0.08));
      let [lx, ly] = toScreen(spiralRadius(0, reached.pitch), 0);
      for (let k = 1; k <= steps; k++) {
        const theta = (reached.theta * k) / steps;
        const r = spiralRadius(theta, reached.pitch);
        const [sx, sy] = toScreen(Math.cos(theta) * r, Math.sin(theta) * r);
        ctx.globalAlpha = 0.06 + 0.22 * (k / steps);
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(sx, sy);
        ctx.stroke();
        lx = sx;
        ly = sy;
      }
      ctx.globalAlpha = 1;
    }

    for (const body of bodies) {
      if (body.first > cursorRef.current) {
        continue;
      }
      if (!ballsShown.current.has(body.ball)) {
        ballsShown.current.set(body.ball, playing ? now : now - 10_000);
      }
      const grow = easeOut((now - ballsShown.current.get(body.ball)!) / 700);
      const [bx, by] = toScreen(body.x, body.y);
      const dim = hotBody && hotBody !== body ? 0.35 : 1;
      const lift = hotBody === body ? 1.15 : 1;

      for (const mote of body.motes) {
        if (mote.born > cursorRef.current) {
          continue;
        }
        if (!revealed.current.has(mote.capture)) {
          revealed.current.set(mote.capture, playing ? now : now - 10_000);
        }
        const fly = easeOut((now - revealed.current.get(mote.capture)!) / FLY_MS);
        const period = ORBIT_TURN * (1 + mote.ring * 0.35);
        const a = mote.angle + (calm ? 0 : ((t / period) * Math.PI * 2) * (mote.ring % 2 ? -1 : 1));
        const r = mote.radius * fly * lift * cam.zoom;
        const mx = bx + Math.cos(a) * r;
        const my = by + Math.sin(a) * r * 0.92;
        const color = typeColor(mote.capture.pokemon.types?.[0] ?? 'normal');
        const hotMote = hotRef.current?.mote === mote;
        ctx.globalAlpha = dim * (0.4 + 0.6 * fly);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(mx, my, Math.max(1.2, (hotMote ? 4.2 : 2.3) * Math.min(1.4, cam.zoom)), 0, Math.PI * 2);
        ctx.fill();
        // a newly caught mon's spark, once, as it lands
        if (fly < 1) {
          ctx.globalAlpha = (1 - fly) * 0.7;
          ctx.strokeStyle = color;
          ctx.beginPath();
          ctx.arc(mx, my, 3 + 10 * fly, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      const img = images.get(body.ball);
      const size = body.size * cam.zoom * grow * lift;
      ctx.globalAlpha = dim;
      if (hotBody === body) {
        ctx.fillStyle = alpha(accent, 0.35);
        ctx.beginPath();
        ctx.arc(bx, by, size * 0.75, 0, Math.PI * 2);
        ctx.fill();
      }
      if (img?.complete && img.naturalWidth > 0) {
        ctx.imageSmoothingEnabled = size < 32;
        ctx.drawImage(img, bx - size / 2, by - size / 2, size, size);
      }
      ctx.globalAlpha = 1;
    }
  });

  // the ball (and, close enough, the mote) under a point in the window
  const pick = (clientX: number, clientY: number): { body: Body; mote: Mote | null; x: number; y: number } | null => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const cam = camera.current;
    const turn = calm ? 0 : (spin.current / GALAXY_TURN) * Math.PI * 2;
    const px = (clientX - rect.left - rect.width / 2) / cam.zoom + cam.x;
    const py = (clientY - rect.top - (rect.height - FOOT) / 2) / cam.zoom + cam.y;
    // into the galaxy's own turn
    const wx = px * Math.cos(-turn) - py * Math.sin(-turn);
    const wy = px * Math.sin(-turn) + py * Math.cos(-turn);
    for (const body of bodies) {
      if (body.first > cursorRef.current || Math.hypot(wx - body.x, wy - body.y) > body.reach) {
        continue;
      }
      const sx = rect.left + rect.width / 2 + ((body.x * Math.cos(turn) - body.y * Math.sin(turn)) - cam.x) * cam.zoom;
      const sy = rect.top + (rect.height - FOOT) / 2 + ((body.x * Math.sin(turn) + body.y * Math.cos(turn)) - cam.y) * cam.zoom;
      let mote: Mote | null = null;
      // a mote is near enough to pick once the galaxy's zoomed in on it, found where it's drawn
      if (cam.zoom > 1.8) {
        let best = 8;
        for (const candidate of body.motes) {
          if (candidate.born > cursorRef.current) {
            continue;
          }
          const period = ORBIT_TURN * (1 + candidate.ring * 0.35);
          const a = candidate.angle + (calm ? 0 : ((clock.current / period) * Math.PI * 2) * (candidate.ring % 2 ? -1 : 1));
          const r = candidate.radius * cam.zoom * (hotRef.current?.body === body ? 1.15 : 1);
          const d = Math.hypot(clientX - sx - Math.cos(a) * r, clientY - sy - Math.sin(a) * r * 0.92);
          if (d < best) {
            best = d;
            mote = candidate;
          }
        }
      }
      return { body, mote, x: sx + (body.reach * cam.zoom) / 2, y: sy };
    }
    return null;
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, moved: false };
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const held = drag.current;
    if (held) {
      const dx = e.clientX - held.x;
      const dy = e.clientY - held.y;
      if (held.moved || Math.hypot(dx, dy) > 4) {
        held.moved = true;
        const cam = camera.current;
        cam.tx -= dx / cam.zoom;
        cam.ty -= dy / cam.zoom;
        cam.x = cam.tx;
        cam.y = cam.ty;
        held.x = e.clientX;
        held.y = e.clientY;
        setHot(null);
        return;
      }
    }
    const found = pick(e.clientX, e.clientY);
    if (found?.body !== hot?.body || found?.mote !== hot?.mote) {
      setHot(found);
    }
  };
  const onPointerUp = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const held = drag.current;
    drag.current = null;
    if (held?.moved) {
      return;
    }
    const found = pick(e.clientX, e.clientY);
    if (found?.mote) {
      onLocate(found.mote.capture.pokemon.id);
    } else if (found) {
      onFilter({ view: 'all', facets: { ball: [found.body.ball] } }, { scroll: 0 });
    }
  };
  const onWheel = (e: WheelEvent<HTMLCanvasElement>) => {
    const cam = camera.current;
    cam.tzoom = Math.min(6, Math.max(0.3, cam.tzoom * Math.exp(-e.deltaY * 0.0015)));
  };

  // Space plays or pauses the replay
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.key === ' ' && !e.repeat) {
        e.preventDefault();
        toggle();
      }
    };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  });

  const toggle = () => {
    if (playing) {
      setPlaying(false);
      return;
    }
    if (cursor >= end) {
      revealed.current.clear();
      ballsShown.current.clear();
      setCursor(start);
    }
    setPlaying(true);
  };

  const ballName = (ball: string) => localizeBall(locale, ball, BALL_NAMES.get(ball) ?? ball);
  const tag = locale === 'ja' ? 'ja-JP' : 'en-US';
  const dateLabel = (ms: number) => new Intl.DateTimeFormat(tag, { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(Math.min(ms, end - DAY_MS)));
  const shownCount = usable.filter((capture) => dayOf(capture) <= cursor).length;
  const shownBalls = bodies.filter((body) => body.first <= cursor).length;

  return (
    <Scene hint={lt('galaxy.hint')} name="lab-galaxy" onClose={onClose} quiet={Boolean(back)} title={lt('galaxy.title')}>
      {({ scale }) => (
        <div className="lg-page">
          <canvas
            className="lg-canvas"
            onPointerDown={onPointerDown}
            onPointerLeave={() => setHot(null)}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onWheel={onWheel}
            ref={canvasRef}
            style={{ cursor: hot ? 'pointer' : 'grab' }}
          />
          {bodies.length === 0 && <p className="lg-empty">{lt('galaxy.empty')}</p>}
          <div className="lg-readout" style={{ zoom: scale }}>
            <b>{bodies.length > 0 ? dateLabel(cursor) : '—'}</b>
            <span>{lt('galaxy.readout', { mons: shownCount, balls: shownBalls })}</span>
          </div>
          {bodies.length > 0 && (
            <div className="lg-scrub" style={{ zoom: scale }}>
              <button aria-label={lt(playing ? 'galaxy.pause' : 'galaxy.play')} onClick={toggle} type="button">
                <FontAwesomeIcon icon={playing ? faPause : faPlay} />
              </button>
              <input
                aria-label={lt('galaxy.scrub')}
                max={end}
                min={start}
                onChange={(e) => {
                  setPlaying(false);
                  setCursor(Number(e.target.value));
                }}
                step={DAY_MS}
                type="range"
                value={Math.min(cursor, end)}
              />
              <span>{lt('galaxy.legend')}</span>
            </div>
          )}
          {hot && (
            <LabTip scale={scale} x={hot.x} y={hot.y}>
              {hot.mote
                ? (
                  <>
                    <span className="lg-tip-head">
                      <SceneMon pokemon={hot.mote.capture.pokemon} />
                      <strong>{displayName(hot.mote.capture.pokemon.name, hot.mote.capture.pokemon.name_ja, locale)}</strong>
                    </span>
                    <small>{ballName(hot.body.ball)} · {dateLabel(hot.mote.born)}</small>
                    <em>{lt('galaxy.pressMon')}</em>
                  </>
                )
                : (
                  <>
                    <span className="lg-tip-head">
                      <img alt="" height={32} src={`/balls/${hot.body.ball}.png`} width={32} />
                      <strong>{ballName(hot.body.ball)}</strong>
                    </span>
                    <small>{lt('galaxy.ballFacts', { n: hot.body.mons.length, first: dateLabel(hot.body.first), last: dateLabel(hot.body.last) })}</small>
                    <span className="lab-tip-mons">
                      {hot.body.mons.slice(-TIP_MONS).reverse().map((capture) => <SceneMon key={capture.pokemon.id} pokemon={capture.pokemon} />)}
                    </span>
                    <em>{lt('galaxy.press')}</em>
                  </>
                )}
            </LabTip>
          )}
        </div>
      )}
    </Scene>
  );
}
