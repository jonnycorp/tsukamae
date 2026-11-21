import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPause, faPlay } from '@fortawesome/free-solid-svg-icons';
import { useEffect, useMemo, useRef, useState } from 'react';

import { BALL_NAMES, ORIGIN_GAME_NAMES } from '../../../../utils/capture-fields';
import { GalaxyPanel } from './GalaxyPanel';
import { Scene } from '../Scene';
import { ScopeSwitch, useViewScope, useScopedRecords } from './ViewScope';
import { alpha, easeOut, fitCanvas, token, useCalm, useFrameLoop, useKeys } from './views-kit';
import { displayName } from '../../../library/PokemonName';
import { localizeBall, localizeOriginGame } from '../../../../i18n/names';
import { useViewText } from './views-i18n';
import { useLocalStorage } from '../../../../hooks/use-local-storage';

import type { ViewProps } from './views-kit';
import type { ViewRecord } from './ViewScope';
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
// the zoom the camera keeps to while it follows the replay out, at most
const FOLLOW_ZOOM = 2.2;
// with a star picked, the galaxy and its orbits slow to this share of their speed, and what isn't picked dims to this
const FOCUS_SPEED = 0.12;
const FOCUS_DIM = 0.22;
// the constellation: the stars caught just before and after the picked one, joined in order
const TRAIL = 8;
// the room the side panel takes at the right, which the galaxy's centre moves out of the way of
const PANEL = 380;

// three ways to look at a picked star (the switch at the top): its constellation with a panel at the side, the day it
// was caught with every other star of that day lit, or its art large behind the whole galaxy
export type GalaxyMode = 'constellation' | 'day' | 'backdrop';
const MODES: GalaxyMode[] = ['constellation', 'day', 'backdrop'];

interface Mote {
  record: ViewRecord;
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
  mons: ViewRecord[];
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
function buildBodies (ordered: ViewRecord[]): Body[] {
  const index = new Map(ordered.map((record, i) => [record, i]));
  const groups = new Map<string, ViewRecord[]>();
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
// it holds, each mon a star circling it in its first type's colour. It opens by replaying your catches in order (a step
// each, so a quiet year takes no longer than a busy day), the date large at the top, each ball lit in the row at the
// foot as it first turns up. Drag to look around, wheel to zoom; pointing at a star or a ball only names it, lightly.
// Pressing a star picks it: the galaxy slows and dims round it, and Q and E step to the star caught before or after,
// in the order you caught them. What a picked star shows is the mode's (MODES); a press on empty space, or Escape,
// lets it go. Nothing here goes to the dex on its own; the panel offers it
export function BallGalaxy ({ back, onClose, onFilter, onLocate }: ViewProps) {
  const { lt, locale } = useViewText();
  const calm = useCalm();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scope, setScope] = useViewScope('galaxy');
  const records = useScopedRecords(scope);
  const [mode, setMode] = useLocalStorage<GalaxyMode>('viewGalaxy.mode', 'constellation');

  const ordered = useMemo(() => records.filter(({ capture }) => capture.captured && capture.status !== 'unobtainable' &&
    capture.ball && capture.ball !== 'unknown' && capture.catch_date)
  .sort((a, b) => a.capture.catch_date!.localeCompare(b.capture.catch_date!) || a.key.localeCompare(b.key)), [records]);
  const bodies = useMemo(() => buildBodies(ordered), [ordered]);
  const total = ordered.length;
  // each star by its place in the order of catches, with its ball
  const stars = useMemo(() => {
    const list: { body: Body; mote: Mote }[] = [];
    for (const body of bodies) {
      for (const mote of body.motes) {
        list[mote.index] = { body, mote };
      }
    }
    return list;
  }, [bodies]);

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
  // the replay's place to the fraction, which the canvas draws from every frame; the state above moves only as a whole
  // catch is reached, so the page around the canvas re-renders a catch at a time rather than every frame
  const cursorRef = useRef(cursor);
  const moveCursor = (to: number) => {
    cursorRef.current = to;
    setCursor(to);
  };
  // the picked star, by its place in the order of catches
  const [focus, setFocus] = useState<number | null>(null);
  const focusRef = useRef(focus);
  focusRef.current = focus;
  const modeRef = useRef(mode);
  modeRef.current = mode;
  // a scope switched starts the galaxy over, whole, nothing picked
  const [shownScope, setShownScope] = useState(scope);
  if (shownScope !== scope) {
    setShownScope(scope);
    cursorRef.current = total;
    setCursor(total);
    setPlaying(false);
    setFocus(null);
  }

  // what the pointer's over: a star or a ball, named lightly beside it on the canvas
  const hover = useRef<{ body: Body; mote: Mote | null } | null>(null);
  const [pointing, setPointing] = useState(false);

  // the camera, eased toward where it's asked to be; following the replay out till it's moved by hand
  const camera = useRef({ x: 0, y: 0, zoom: 1, tx: 0, ty: 0, tzoom: 1, shift: 0 });
  const follow = useRef(true);
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  // when each star and ball came into view in the replay (performance.now()), for its flight out
  const revealed = useRef(new Map<ViewRecord, number>());
  const ballsShown = useRef(new Map<string, number>());
  // the galaxy's turn and the orbits' clock, each run at the speed of the moment (slowed with a star picked)
  const spin = useRef(0);
  const clock = useRef(0);
  const speed = useRef(1);
  const focusFade = useRef(0);
  const sky = useRef<{ x: number; y: number; r: number; a: number }[]>([]);

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
    sky.current = Array.from({ length: 220 }, () => ({ x: Math.random(), y: Math.random(), r: Math.random() * 1.2 + 0.2, a: Math.random() * 0.5 + 0.1 }));
  // set once per galaxy built
  }, [bodies]);

  // the replay: a catch every STEP_MS, the run kept between its floor and its ceiling
  const replayMs = Math.min(MAX_REPLAY_MS, Math.max(MIN_REPLAY_MS, total * STEP_MS));
  useFrameLoop((_, dt) => {
    const before = Math.floor(cursorRef.current);
    const next = Math.min(total, cursorRef.current + (total / replayMs) * dt);
    cursorRef.current = next;
    if (Math.floor(next) !== before || next >= total) {
      setCursor(next);
    }
    if (next >= total) {
      setPlaying(false);
    }
  }, playing);

  // a star's place on the screen, as it's drawn this frame
  const view = (w: number, h: number) => {
    const cam = camera.current;
    const turn = calm ? 0 : (spin.current / GALAXY_TURN) * Math.PI * 2;
    const cos = Math.cos(turn);
    const sin = Math.sin(turn);
    const cx = (w - cam.shift) / 2 - cam.x * cam.zoom;
    const cy = (h - FOOT) / 2 - cam.y * cam.zoom;
    const toScreen = (x: number, y: number): [number, number] => [cx + (x * cos - y * sin) * cam.zoom, cy + (x * sin + y * cos) * cam.zoom];
    const lift = (body: Body) => (hover.current?.body === body && !hover.current.mote ? 1.12 : 1);
    const starAt = (body: Body, mote: Mote, fly = 1): [number, number] => {
      const [bx, by] = toScreen(body.x, body.y);
      const period = ORBIT_TURN * (1 + mote.ring * 0.35);
      const a = mote.angle + (calm ? 0 : ((clock.current / period) * Math.PI * 2) * (mote.ring % 2 ? -1 : 1));
      const r = mote.radius * fly * lift(body) * cam.zoom;
      return [bx + Math.cos(a) * r, by + Math.sin(a) * r * 0.92];
    };
    return { cx, cy, toScreen, starAt, lift };
  };

  useFrameLoop((_t, dt) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const ctx = fitCanvas(canvas);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const cam = camera.current;
    const picked = focusRef.current !== null ? stars[focusRef.current] : undefined;
    const ease = 1 - Math.pow(0.001, dt / 1000);
    // slowed and dimmed round a picked star, the galaxy's centre moved out from under the panel
    speed.current += ((picked ? FOCUS_SPEED : 1) - speed.current) * ease * 2;
    focusFade.current += ((picked ? 1 : 0) - focusFade.current) * ease * 3;
    cam.shift += ((picked && modeRef.current === 'constellation' ? Math.min(PANEL, w * 0.32) : 0) - cam.shift) * ease * 3;
    if (follow.current) {
      cam.tzoom = fitZoom(Math.max(1, cursorRef.current));
    }
    cam.x += (cam.tx - cam.x) * ease * 3;
    cam.y += (cam.ty - cam.y) * ease * 3;
    cam.zoom += (cam.tzoom - cam.zoom) * ease * 3;
    if (!calm) {
      spin.current += dt * speed.current;
      clock.current += dt * speed.current;
    }
    const now = performance.now();
    const dark = document.documentElement.dataset.mode === 'dark';
    const accent = token('--accent');
    const ink = token('--ink');
    const typeColors = new Map<string, string>();
    const typeColor = (type: string) => typeColors.get(type) ?? typeColors.set(type, token(`--type-${type}`)).get(type)!;
    const { cx, cy, toScreen, starAt, lift } = view(w, h);
    const fade = focusFade.current;
    // what stays lit with a star picked: its constellation's run, or every star of its day
    const pickedDay = picked?.mote.record.capture.catch_date;
    const lit = (mote: Mote) => !picked || mote === picked.mote ||
      (modeRef.current === 'day' ? mote.record.capture.catch_date === pickedDay
        : modeRef.current === 'constellation' && Math.abs(mote.index - picked.mote.index) <= TRAIL);

    ctx.clearRect(0, 0, w, h);
    // the far stars, still, and a glow at the heart in the theme's accent
    for (const star of sky.current) {
      ctx.globalAlpha = star.a * (dark ? 1 : 0.5);
      ctx.fillStyle = ink;
      ctx.beginPath();
      ctx.arc(star.x * w, star.y * h, star.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 420 * cam.zoom);
    glow.addColorStop(0, alpha(accent, (dark ? 0.28 : 0.16) * (1 - fade * 0.5)));
    glow.addColorStop(1, alpha(accent, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

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
        ctx.globalAlpha = (0.06 + 0.22 * (k / steps)) * (1 - fade * 0.6);
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(sx, sy);
        ctx.stroke();
        lx = sx;
        ly = sy;
      }
      ctx.globalAlpha = 1;
    }

    // where each lit star is this frame, for the lines between them
    const placed = new Map<number, [number, number]>();
    for (const body of bodies) {
      if (body.firstIndex >= cursorRef.current) {
        continue;
      }
      if (!ballsShown.current.has(body.ball)) {
        ballsShown.current.set(body.ball, playing ? now : now - 10_000);
      }
      const grow = easeOut((now - ballsShown.current.get(body.ball)!) / 700);
      const [bx, by] = toScreen(body.x, body.y);
      const ballLit = !picked || body === picked.body || body.motes.some((mote) => lit(mote) && mote.index < cursorRef.current);

      for (const mote of body.motes) {
        if (mote.index >= cursorRef.current) {
          continue;
        }
        if (!revealed.current.has(mote.record)) {
          revealed.current.set(mote.record, playing ? now : now - 10_000);
        }
        const fly = easeOut((now - revealed.current.get(mote.record)!) / FLY_MS);
        const [mx, my] = starAt(body, mote, fly);
        const on = lit(mote);
        if (on && picked) {
          placed.set(mote.index, [mx, my]);
        }
        const color = typeColor(mote.record.capture.pokemon.types?.[0] ?? 'normal');
        const hovered = hover.current?.mote === mote;
        ctx.globalAlpha = (on ? 1 : 1 - fade * (1 - FOCUS_DIM)) * (0.4 + 0.6 * fly);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(mx, my, Math.max(1.2, (hovered ? 3.6 : 2.3) * Math.min(1.4, cam.zoom)), 0, Math.PI * 2);
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
      const size = body.size * cam.zoom * grow * lift(body);
      ctx.globalAlpha = ballLit ? 1 : 1 - fade * (1 - FOCUS_DIM - 0.1);
      if (img?.complete && img.naturalWidth > 0) {
        ctx.imageSmoothingEnabled = size < 32;
        ctx.drawImage(img, bx - size / 2, by - size / 2, size, size);
      }
      ctx.globalAlpha = 1;
    }

    // a picked star: its constellation (the run caught before and after it, joined in order) or its day (a line out to
    // every star caught that day), then the star itself ringed
    if (picked && placed.has(picked.mote.index)) {
      const [px, py] = placed.get(picked.mote.index)!;
      ctx.lineWidth = 1;
      ctx.strokeStyle = ink;
      if (modeRef.current === 'constellation') {
        let last: [number, number] | null = null;
        for (let k = picked.mote.index - TRAIL; k <= picked.mote.index + TRAIL; k++) {
          const at = placed.get(k);
          if (!at) {
            continue;
          }
          if (last) {
            ctx.globalAlpha = fade * 0.5 * (1 - Math.abs(k - 0.5 - picked.mote.index) / (TRAIL + 1));
            ctx.beginPath();
            ctx.moveTo(last[0], last[1]);
            ctx.lineTo(at[0], at[1]);
            ctx.stroke();
          }
          last = at;
        }
      } else if (modeRef.current === 'day') {
        for (const [k, at] of placed) {
          if (k !== picked.mote.index) {
            ctx.globalAlpha = fade * 0.3;
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(at[0], at[1]);
            ctx.stroke();
          }
        }
      }
      const pulse = calm ? 0 : (Math.sin(now / 420) + 1) / 2;
      ctx.globalAlpha = fade;
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(px, py, 7 + pulse * 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = fade * 0.25;
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(px, py, 14 + pulse * 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // what's pointed at, named in a whisper beside it
    const pointed = hover.current;
    if (pointed && !drag.current?.moved) {
      const [x, y] = pointed.mote ? starAt(pointed.body, pointed.mote) : toScreen(pointed.body.x, pointed.body.y);
      const { capture } = pointed.mote?.record ?? {};
      const label = capture
        ? `${displayName(capture.pokemon.name, capture.pokemon.name_ja, locale)}  ${capture.catch_date}`
        : `${localizeBall(locale, pointed.body.ball, BALL_NAMES.get(pointed.body.ball) ?? pointed.body.ball)}  ${pointed.body.mons.length}`;
      ctx.font = '12px sans-serif';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = ink;
      ctx.globalAlpha = 0.85;
      const off = pointed.mote ? 10 : (pointed.body.size * cam.zoom) / 2 + 8;
      ctx.fillText(label, x + off, y);
      ctx.globalAlpha = 1;
    }
  });

  // the star (or, failing one near enough, the ball) under a point in the window, found where it's drawn
  const pick = (clientX: number, clientY: number): { body: Body; mote: Mote | null } | null => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const { toScreen, starAt } = view(rect.width, rect.height);
    let best: { body: Body; mote: Mote | null } | null = null;
    let bestD = 7;
    for (const body of bodies) {
      if (body.firstIndex >= cursorRef.current) {
        continue;
      }
      const [bx, by] = toScreen(body.x, body.y);
      if (Math.hypot(x - bx, y - by) > body.reach * camera.current.zoom + 8) {
        continue;
      }
      for (const mote of body.motes) {
        if (mote.index >= cursorRef.current) {
          continue;
        }
        const [mx, my] = starAt(body, mote);
        const d = Math.hypot(x - mx, y - my);
        if (d < bestD) {
          bestD = d;
          best = { body, mote };
        }
      }
      if (!best && Math.hypot(x - bx, y - by) < (body.size * camera.current.zoom) / 2 + 4) {
        best = { body, mote: null };
      }
    }
    return best;
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
        hover.current = null;
        return;
      }
    }
    hover.current = pick(e.clientX, e.clientY);
    if (Boolean(hover.current) !== pointing) {
      setPointing(Boolean(hover.current));
    }
  };
  const onPointerUp = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const held = drag.current;
    drag.current = null;
    if (held?.moved) {
      return;
    }
    const found = pick(e.clientX, e.clientY);
    // a ball picks its first star; empty space lets the picked one go
    setFocus(found ? found.mote?.index ?? found.body.firstIndex : null);
    if (found && playing) {
      setPlaying(false);
    }
  };
  const onWheel = (e: WheelEvent<HTMLCanvasElement>) => {
    const cam = camera.current;
    follow.current = false;
    cam.tzoom = Math.min(6, Math.max(0.3, cam.tzoom * Math.exp(-e.deltaY * 0.0015)));
  };

  // Q and E step through the stars in the order you caught them (from nothing picked, E starts at the first and Q at
  // the last), within what the replay has shown; Space plays or pauses; Escape lets a picked star go before it closes
  const shown = Math.floor(cursor);
  const step = (by: number) => {
    const last = Math.max(0, Math.min(shown, total) - 1);
    setFocus(focus === null ? (by > 0 ? 0 : last) : Math.max(0, Math.min(last, focus + by)));
    setPlaying(false);
  };
  useKeys((e) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) {
      return;
    }
    const key = e.key.toLowerCase();
    if (key === ' ' && !e.repeat) {
      toggle();
    } else if ((key === 'q' || key === 'e') && total > 0) {
      step(key === 'e' ? 1 : -1);
    } else if (key === 'escape' && focus !== null) {
      setFocus(null);
    } else {
      return;
    }
    e.preventDefault();
  });

  const toggle = () => {
    if (playing) {
      setPlaying(false);
      return;
    }
    setFocus(null);
    if (cursor >= total) {
      revealed.current.clear();
      ballsShown.current.clear();
      moveCursor(0);
    }
    follow.current = true;
    setPlaying(true);
  };

  const ballName = (ball: string) => localizeBall(locale, ball, BALL_NAMES.get(ball) ?? ball);
  const tag = locale === 'ja' ? 'ja-JP' : 'en-US';
  const dateLabel = (iso: string) => new Intl.DateTimeFormat(tag, { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(`${iso}T00:00:00`));
  const picked = focus !== null ? stars[focus] : undefined;
  // the date at the top: the picked star's, or the replay's
  const current = picked?.mote.record ?? ordered[Math.max(0, Math.min(total, shown) - 1)];
  const shownBalls = bodies.filter((body) => body.firstIndex < shown).length;
  const sameDay = picked ? ordered.filter(({ capture }) => capture.catch_date === picked.mote.record.capture.catch_date) : [];

  return (
    <Scene hint={lt('galaxy.hint')} name="view-galaxy" onClose={onClose} quiet={Boolean(back)} title={lt('galaxy.title')}>
      {({ scale }) => (
        <div className={`lg-page mode-${mode}`}>
          {picked && mode === 'backdrop' && (
            <GalaxyPanel key={`b-${picked.mote.record.key}`} kind="backdrop" record={picked.mote.record} />
          )}
          <canvas
            className="lg-canvas"
            onPointerDown={onPointerDown}
            onPointerLeave={() => {
              hover.current = null;
              setPointing(false);
            }}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onWheel={onWheel}
            ref={canvasRef}
            style={{ cursor: pointing ? 'pointer' : 'grab' }}
          />
          {bodies.length === 0 && <p className="lg-empty">{lt('galaxy.empty')}</p>}
          <div className="lg-readout" style={{ zoom: scale }}>
            <b key={picked ? 'picked' : 'run'}>{current ? dateLabel(current.capture.catch_date!) : '—'}</b>
            <span>
              {picked
                ? lt('galaxy.nth', { n: picked.mote.index + 1, total })
                : lt('galaxy.readout', { mons: Math.min(shown, total), balls: shownBalls })}
            </span>
          </div>
          <div className="lg-controls" style={{ zoom: scale }}>
            <div className="lg-modes" role="group">
              {MODES.map((option) => (
                <button aria-pressed={mode === option} className={mode === option ? 'on' : undefined} key={option} onClick={() => setMode(option)} type="button">
                  {lt(`galaxy.mode.${option}`)}
                </button>
              ))}
            </div>
            <ScopeSwitch onChange={setScope} scope={scope} />
          </div>
          {picked && mode !== 'backdrop' && (
            <GalaxyPanel
              ballName={ballName(picked.body.ball)}
              day={sameDay}
              kind={mode}
              onFilterBall={() => onFilter({ view: 'all', facets: { ball: [picked.body.ball] } }, { scroll: 0 })}
              onLocate={() => onLocate(picked.mote.record.capture.pokemon.id)}
              onPick={(record) => setFocus(ordered.indexOf(record))}
              record={picked.mote.record}
              scale={scale}
            />
          )}
          {picked && mode === 'backdrop' && (
            <div className="lg-caption" style={{ zoom: scale }}>
              <strong>{displayName(picked.mote.record.capture.pokemon.name, picked.mote.record.capture.pokemon.name_ja, locale)}</strong>
              <span>
                <img alt="" height={22} src={`/balls/${picked.body.ball}.png`} width={22} />
                {ballName(picked.body.ball)}
                {picked.mote.record.capture.origin_game &&
                  ` · ${localizeOriginGame(locale, picked.mote.record.capture.origin_game, ORIGIN_GAME_NAMES.get(picked.mote.record.capture.origin_game) ?? '')}`}
              </span>
            </div>
          )}
          {bodies.length > 0 && (
            <div className="lg-foot" style={{ zoom: scale }}>
              <div className="lg-balls">
                {bodies.map((body) => (
                  <img
                    alt={ballName(body.ball)}
                    className={body.firstIndex < shown ? 'on' : undefined}
                    height={34}
                    key={body.ball}
                    src={`/balls/${body.ball}.png`}
                    title={ballName(body.ball)}
                    width={34}
                  />
                ))}
              </div>
              <div className="view-scrub">
                <button aria-label={lt(playing ? 'galaxy.pause' : 'galaxy.play')} onClick={toggle} type="button">
                  <FontAwesomeIcon icon={playing ? faPause : faPlay} />
                </button>
                <input
                  aria-label={lt('galaxy.scrub')}
                  max={total}
                  min={1}
                  onChange={(e) => {
                    setPlaying(false);
                    setFocus(null);
                    moveCursor(Number(e.target.value));
                  }}
                  step={1}
                  type="range"
                  value={Math.max(1, Math.min(shown, total))}
                />
              </div>
              <span className="lg-legend">{lt('galaxy.legend')}</span>
            </div>
          )}
        </div>
      )}
    </Scene>
  );
}
