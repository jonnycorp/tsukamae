import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPause, faPlay } from '@fortawesome/free-solid-svg-icons';
import { useEffect, useMemo, useRef, useState } from 'react';

import { BALL_NAMES } from '../../../../utils/capture-fields';
import { LabTip } from './LabTip';
import { Scene, SceneMon } from '../Scene';
import { ScopeSwitch, useLabScope, useScopedRecords } from './LabScope';
import { displayName } from '../../../library/PokemonName';
import { alpha, easeOut, fitCanvas, token, useCalm, useFrameLoop } from './lab-kit';
import { localizeBall } from '../../../../i18n/names';
import { useLabText } from './lab-i18n';

import type { LabProps } from './lab-kit';
import type { LabRecord } from './LabScope';
import type { PointerEvent as ReactPointerEvent, WheelEvent } from 'react';

// the spiral the balls sit along, by the order they were first used: its start out from the heart, and the room
// between two balls along it
const SPIRAL_START = 30;
const SPIRAL_ROOM = 16;
// the room the scrubber takes at the foot, which the galaxy is centred above
const FOOT = 130;
// a ball's mons in rings round it: the first ring's gap from the ball, the step out, and how close they pack
const RING_GAP = 9;
const RING_STEP = 5.5;
const RING_PITCH = 7;
// one turn of the whole galaxy, and of a mon round its ball (an outer ring slower)
const GALAXY_TURN = 420_000;
const ORBIT_TURN = 26_000;
// the replay runs through your catches in order, not through the calendar, so a year with none passes in no time: each
// catch its own step, the whole run at least MIN_REPLAY_MS and at most MAX_REPLAY_MS; a newly caught mon flies out to
// its ring in FLY_MS
const STEP_MS = 14;
const MIN_REPLAY_MS = 5000;
const MAX_REPLAY_MS = 16_000;
const FLY_MS = 900;
// how long a newly reached ball is named under the date
const ARRIVAL_MS = 2200;
// the zoom the camera keeps to while it follows the replay out, at most
const TIP_MONS = 24;

const FOLLOW_ZOOM = 2.2;

interface Mote {
  record: LabRecord;
  // its place in the order of your catches
  index: number;
  ring: number;
  angle: number;
  radius: number;
}

interface Body {
  ball: string;
  // how far round the spiral (radians)
  theta: number;
  mons: LabRecord[];
  motes: Mote[];
  // its first mon's place in the order of catches, and its first and last days
  firstIndex: number;
  first: string;
  last: string;
  pitch: number;
  x: number;
  y: number;
  size: number;
  reach: number;
}

// the records in the order they were caught, each ball's by its first, the earliest ball first
function buildBodies (ordered: LabRecord[]): Body[] {
  const index = new Map(ordered.map((record, i) => [record, i]));
  const groups = new Map<string, LabRecord[]>();
  for (const record of ordered) {
    groups.set(record.capture.ball!, [...(groups.get(record.capture.ball!) ?? []), record]);
  }
  const bodies = [...groups.entries()].map(([ball, mons]) => ({
    ball,
    mons,
    firstIndex: index.get(mons[0])!,
    first: mons[0].capture.catch_date!,
    last: mons[mons.length - 1].capture.catch_date!,
  })).sort((a, b) => a.firstIndex - b.firstIndex);

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
        const record = body.mons[placed + k];
        motes.push({ record, index: index.get(record)!, ring, angle: (2 * Math.PI * k) / here + ring * 0.6, radius });
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

// the ball galaxy: the balls you've used as a spiral galaxy, the first one ever used at its heart and each after it
// further out along the arm, so the spiral is the order your balls came into your life; a ball's size is how many mons
// it holds, each mon a mote circling it in its first type's colour. It opens by replaying your catches in order (a
// step each, so a quiet year takes no longer than a busy day), the date large at the top, each ball named as it first
// turns up and lit in the row of balls at the foot, the camera drawing back as the galaxy grows. The scrubber takes it
// to any point. Drag to look around, wheel to zoom; a ball pointed at shows its mons (close enough, a mote shows its
// mon) and pressed filters the dex to it. The open dex's balls, or every dex's together
export function BallGalaxy ({ back, onClose, onFilter, onLocate }: LabProps) {
  const { lt, locale } = useLabText();
  const calm = useCalm();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scope, setScope] = useLabScope('galaxy');
  const records = useScopedRecords(scope);

  const ordered = useMemo(() => records.filter(({ capture }) => capture.captured && capture.status !== 'unobtainable' &&
    capture.ball && capture.ball !== 'unknown' && capture.catch_date)
  .sort((a, b) => a.capture.catch_date!.localeCompare(b.capture.catch_date!) || a.key.localeCompare(b.key)), [records]);
  const bodies = useMemo(() => buildBodies(ordered), [ordered]);
  const total = ordered.length;

  const images = useMemo(() => {
    const map = new Map<string, HTMLImageElement>();
    for (const body of bodies) {
      const img = new Image();
      img.src = `/balls/${body.ball}.png`;
      map.set(body.ball, img);
    }
    return map;
  }, [bodies]);

  // how many catches the replay has shown, and whether it's playing; opened from the dex, or calm, it starts at the end
  const [cursor, setCursor] = useState(() => (back || calm ? total : 0));
  const [playing, setPlaying] = useState(() => !back && !calm && total > 0);
  const cursorRef = useRef(cursor);
  cursorRef.current = cursor;
  // a scope switched starts the galaxy over, whole
  const [shownScope, setShownScope] = useState(scope);
  if (shownScope !== scope) {
    setShownScope(scope);
    setCursor(total);
    setPlaying(false);
  }
  // the ball the replay last reached for the first time, named for a moment under the date
  const [arrival, setArrival] = useState<{ ball: string; at: number } | null>(null);

  const [hot, setHot] = useState<{ body: Body; mote: Mote | null; x: number; y: number } | null>(null);
  const hotRef = useRef(hot);
  hotRef.current = hot;

  // the camera, eased toward where it's asked to be; following the replay out till it's moved by hand
  const camera = useRef({ x: 0, y: 0, zoom: 1, tx: 0, ty: 0, tzoom: 1 });
  const follow = useRef(true);
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  // when each mote and ball came into view in the replay (performance.now()), for its flight out
  const revealed = useRef(new Map<LabRecord, number>());
  const ballsShown = useRef(new Map<string, number>());
  const spin = useRef(0);
  // the motes' clock, which the picking reads to find them where they're drawn
  const clock = useRef(0);
  const stars = useRef<{ x: number; y: number; r: number; a: number }[]>([]);

  // the zoom that fits the balls reached so far in the window, above the foot
  const fitZoom = (reachedCount: number) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return 1;
    }
    const extent = bodies.filter((body) => body.firstIndex < reachedCount)
    .reduce((most, body) => Math.max(most, Math.hypot(body.x, body.y) + body.reach), 90);
    return Math.min(FOLLOW_ZOOM, Math.min(canvas.clientWidth, canvas.clientHeight - FOOT) / (2 * extent + 80));
  };

  useEffect(() => {
    const zoom = fitZoom(cursorRef.current || total);
    Object.assign(camera.current, { x: 0, y: 0, tx: 0, ty: 0, zoom: zoom * 0.85, tzoom: zoom });
    follow.current = true;
    stars.current = Array.from({ length: 220 }, () => ({ x: Math.random(), y: Math.random(), r: Math.random() * 1.2 + 0.2, a: Math.random() * 0.5 + 0.1 }));
  // set once per galaxy built
  }, [bodies]);

  // the replay: a catch every STEP_MS, the run kept between its floor and its ceiling
  const replayMs = Math.min(MAX_REPLAY_MS, Math.max(MIN_REPLAY_MS, total * STEP_MS));
  useFrameLoop((_, dt) => {
    const before = Math.floor(cursorRef.current);
    const next = Math.min(total, cursorRef.current + (total / replayMs) * dt);
    const reached = bodies.find((body) => body.firstIndex >= before && body.firstIndex < Math.floor(next));
    if (reached) {
      setArrival({ ball: reached.ball, at: performance.now() });
    }
    setCursor(next);
    if (next >= total) {
      setPlaying(false);
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
    if (follow.current) {
      cam.tzoom = fitZoom(Math.max(1, cursorRef.current));
    }
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
    const reached = bodies.filter((body) => body.firstIndex < cursorRef.current).pop();
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
      if (body.firstIndex >= cursorRef.current) {
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
        if (mote.index >= cursorRef.current) {
          continue;
        }
        if (!revealed.current.has(mote.record)) {
          revealed.current.set(mote.record, playing ? now : now - 10_000);
        }
        const fly = easeOut((now - revealed.current.get(mote.record)!) / FLY_MS);
        const period = ORBIT_TURN * (1 + mote.ring * 0.35);
        const a = mote.angle + (calm ? 0 : ((t / period) * Math.PI * 2) * (mote.ring % 2 ? -1 : 1));
        const r = mote.radius * fly * lift * cam.zoom;
        const mx = bx + Math.cos(a) * r;
        const my = by + Math.sin(a) * r * 0.92;
        const color = typeColor(mote.record.capture.pokemon.types?.[0] ?? 'normal');
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
      if (body.firstIndex >= cursorRef.current || Math.hypot(wx - body.x, wy - body.y) > body.reach) {
        continue;
      }
      const sx = rect.left + rect.width / 2 + ((body.x * Math.cos(turn) - body.y * Math.sin(turn)) - cam.x) * cam.zoom;
      const sy = rect.top + (rect.height - FOOT) / 2 + ((body.x * Math.sin(turn) + body.y * Math.cos(turn)) - cam.y) * cam.zoom;
      let mote: Mote | null = null;
      // a mote is near enough to pick once the galaxy's zoomed in on it, found where it's drawn
      if (cam.zoom > 1.8) {
        let best = 8;
        for (const candidate of body.motes) {
          if (candidate.index >= cursorRef.current) {
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
        follow.current = false;
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
      if (found.mote.record.here) {
        onLocate(found.mote.record.capture.pokemon.id);
      }
    } else if (found) {
      onFilter({ view: 'all', facets: { ball: [found.body.ball] } }, { scroll: 0 });
    }
  };
  const onWheel = (e: WheelEvent<HTMLCanvasElement>) => {
    const cam = camera.current;
    follow.current = false;
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
    if (cursor >= total) {
      revealed.current.clear();
      ballsShown.current.clear();
      setCursor(0);
    }
    follow.current = true;
    setPlaying(true);
  };

  const ballName = (ball: string) => localizeBall(locale, ball, BALL_NAMES.get(ball) ?? ball);
  const tag = locale === 'ja' ? 'ja-JP' : 'en-US';
  const dateLabel = (iso: string) => new Intl.DateTimeFormat(tag, { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(`${iso}T00:00:00`));
  const shown = Math.floor(cursor);
  const current = ordered[Math.max(0, Math.min(total, shown) - 1)];
  const shownBalls = bodies.filter((body) => body.firstIndex < shown).length;
  const arriving = arrival && performance.now() - arrival.at < ARRIVAL_MS ? arrival : null;

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
            <b>{current ? dateLabel(current.capture.catch_date!) : '—'}</b>
            <span>{lt('galaxy.readout', { mons: Math.min(shown, total), balls: shownBalls })}</span>
            {arriving && (
              <span className="lg-arrival" key={arriving.ball}>
                <img alt="" height={24} src={`/balls/${arriving.ball}.png`} width={24} />
                {lt('galaxy.newBall', { ball: ballName(arriving.ball) })}
              </span>
            )}
          </div>
          <div className="lg-scope" style={{ zoom: scale }}>
            <ScopeSwitch onChange={setScope} scope={scope} />
          </div>
          {bodies.length > 0 && (
            <div className="lg-foot" style={{ zoom: scale }}>
              <div className="lg-balls">
                {bodies.map((body) => (
                  <img
                    alt={ballName(body.ball)}
                    className={body.firstIndex < shown ? 'on' : undefined}
                    height={26}
                    key={body.ball}
                    src={`/balls/${body.ball}.png`}
                    title={ballName(body.ball)}
                    width={26}
                  />
                ))}
              </div>
              <div className="lg-scrub">
                <button aria-label={lt(playing ? 'galaxy.pause' : 'galaxy.play')} onClick={toggle} type="button">
                  <FontAwesomeIcon icon={playing ? faPause : faPlay} />
                </button>
                <input
                  aria-label={lt('galaxy.scrub')}
                  max={total}
                  min={1}
                  onChange={(e) => {
                    setPlaying(false);
                    setCursor(Number(e.target.value));
                  }}
                  step={1}
                  type="range"
                  value={Math.max(1, Math.min(shown, total))}
                />
              </div>
              <span className="lg-legend">{lt('galaxy.legend')}</span>
            </div>
          )}
          {hot && (
            <LabTip scale={scale} x={hot.x} y={hot.y}>
              {hot.mote
                ? (
                  <>
                    <span className="lg-tip-head">
                      <SceneMon pokemon={hot.mote.record.capture.pokemon} />
                      <strong>{displayName(hot.mote.record.capture.pokemon.name, hot.mote.record.capture.pokemon.name_ja, locale)}</strong>
                    </span>
                    <small>{dateLabel(hot.mote.record.capture.catch_date!)}{scope === 'all' ? ` · ${hot.mote.record.dex.title}` : ''}</small>
                    {hot.mote.record.here && <em>{lt('galaxy.pressMon')}</em>}
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
                      {hot.body.mons.slice(-TIP_MONS).reverse().map((record) => <SceneMon key={record.key} pokemon={record.capture.pokemon} />)}
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
