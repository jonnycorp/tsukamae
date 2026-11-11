import { useEffect } from 'react';

// Ink's pond, its water stirred by drops (styles/themes.scss). Every second or two a drop falls somewhere on the pond in
// view, in the water between one row of boxes and the next, now and then right on a koi, and its ripple runs out as a
// real one does: a dent where it struck, filled in at once, rings spreading from it at an even pace and a smaller set
// after them, their waves lengthening as they go, the light caught on the slopes facing it and lost on the others, and a
// koi under them bent through their slopes. Each drop is a small WebGL canvas laid over its spot, under the boxes as the
// pond is, its water worked out for every pixel on the GPU from a handful of numbers a frame, so the page does next to
// nothing while drops run; the canvases are made while the page is idle and moved from drop to drop. A drop whose rings
// reach a koi draws the koi too, exactly where the stylesheet lays it, and stands in for it only while its water moves:
// the canvas shown and the koi put away in one frame as it starts, while the water is still flat, and the koi given back
// the same way once it's flat again, so the koi never shows twice. Never in still mode, the narrow list, or a hidden
// window

// a drop every so long, somewhere in view; one in so many on a koi; so many at once at most
const EVERY_MS: [number, number] = [1000, 2300];
const ON_KOI = 3;
const MAX_DROPS = 3;
// how long one runs, and how far its rings go before they're gone (the dex's px)
const LIFE_MS = 2800;
const REACH = 130;
// the rings: their spacing, how many crests ride together, how fast they spread (px a second) and their steepest slope;
// how far a slope of 1 bends what's under it (px), and how strongly the slopes catch the light
const WAVELENGTH = 7;
const BAND = 1.6;
const SPEED = 46;
const SLOPE = 0.9;
const REFRACT = 3.3;
const LIGHT = 1.7;
// the dent a drop strikes (its px), and how long the water takes to fill it (s)
const DENT = 2.4;
const DENT_S = 0.3;
// how far in from the water's ends between the rows its rings fade out (px)
const EDGE = 14;

const VERTEX = `
attribute vec2 p;
varying vec2 v;
void main () {
  v = p * 0.5 + 0.5;
  gl_Position = vec4(p, 0.0, 1.0);
}`;

// in device px from the canvas's top left; the koi's picture premultiplied, as what's drawn is
const FRAGMENT = `
precision highp float;
varying vec2 v;
uniform sampler2D koi;
uniform float hasKoi;
uniform vec2 size;
uniform vec2 centre;
uniform float t;
uniform float life;
uniform float lambda;
uniform float band;
uniform float speed;
uniform float slope;
uniform float reach;
uniform float dent;
uniform float bend;
uniform float light;
uniform float edge;
const vec3 SUMI = vec3(0.149, 0.125, 0.118);
const vec3 SHEEN = vec3(1.0, 0.992, 0.969);

// the slope, outward, of a set of rings that set off age s ago: the height env(u) sin(ku) / k at u = r - front, its
// band widening and its waves lengthening as it goes
float rings (float r, float age) {
  if (age <= 0.0) {
    return 0.0;
  }
  float k = 6.2831853 / (lambda * (1.0 + 0.3 * age));
  float b = band * (1.0 + 0.45 * age);
  float u = r - speed * age;
  return exp(-(u * u) / (b * b)) * (cos(k * u) - 2.0 * u / (b * b * k) * sin(k * u));
}

void main () {
  vec2 px = vec2(v.x, 1.0 - v.y) * size;
  vec2 d = px - centre;
  float r = max(length(d), 0.5);
  // struck at once, then fading as it spreads and as it ages, gone by its reach and by its end; flat at its very centre
  float left = clamp(1.0 - t / life, 0.0, 1.0);
  float fall = (1.0 - smoothstep(reach * 0.62, reach, r)) / sqrt(1.0 + r / (8.0 * lambda));
  // and gone by the canvas's top and foot, where the water ends between the rows (seen only between their columns)
  fall *= smoothstep(0.0, edge, px.y) * smoothstep(0.0, edge, size.y - px.y);
  float s = slope * smoothstep(0.0, 0.06, t) * pow(left, 1.4) * fall * (rings(r, t) + 0.45 * rings(r, t - 0.22));
  // the dent where it struck, filled in again within a moment
  float q = r / dent;
  s += 1.86 * smoothstep(0.0, 0.03, t) * max(0.0, 1.0 - t / ${DENT_S.toFixed(2)}) * q * exp(-q * q);
  s *= 1.0 - exp(-q * q * 4.0);
  vec2 g = s * d / r;
  vec4 base = hasKoi > 0.5 ? texture2D(koi, (px + g * bend) / size) : vec4(0.0);
  // lit where the water faces the light, from the upper left, its glints sharper than its shade, and shaded where it
  // faces away
  float lit = dot(g, vec2(0.6, 0.8)) * light;
  float shine = pow(clamp(lit, 0.0, 1.0), 1.5) * 0.6;
  float shade = clamp(-lit, 0.0, 1.0) * 0.38;
  vec4 c = vec4(SHEEN * shine, shine) + base * (1.0 - shine);
  gl_FragColor = vec4(SUMI * shade, shade) + c * (1.0 - shade);
}`;

const UNIFORMS = ['koi', 'hasKoi', 'size', 'centre', 't', 'life', 'lambda', 'band', 'speed', 'slope', 'reach', 'dent', 'bend', 'light', 'edge'] as const;
// KHR_parallel_shader_compile's, asked so the page never waits on the GPU to finish building the program
const COMPLETION_STATUS = 0x91B1;

interface Water {
  canvas: HTMLCanvasElement;
  gl: WebGLRenderingContext;
  program: WebGLProgram;
  parallel: boolean;
  uniforms: Record<(typeof UNIFORMS)[number], WebGLUniformLocation | null> | null;
  texture: WebGLTexture | null;
  busy: boolean;
  dead: boolean;
}

// a koi as the stylesheet lays it (its header's ::before), in the header's own px: its box from the header's left and
// bottom, and its turn
interface Koi {
  src: string;
  left: number;
  bottom: number;
  w: number;
  h: number;
  rotate: number;
}

interface Spot {
  header: HTMLElement;
  // where it falls, in the header's own px: from its left, and up from its bottom
  x: number;
  y: number;
  // the koi its rings reach, which it then draws and bends
  koi: Koi | null;
}

const still = () => document.documentElement.hasAttribute('data-still');

const images = new Map<string, Promise<HTMLImageElement>>();

function load (src: string): Promise<HTMLImageElement> {
  if (!images.has(src)) {
    const img = new Image();
    img.src = src;
    images.set(src, img.decode().then(() => img));
  }
  return images.get(src)!;
}

// a canvas and its program, built while the page is idle and kept for drop after drop
function makeWater (): Water | null {
  const canvas = document.createElement('canvas');
  canvas.className = 'ink-drop';
  canvas.setAttribute('aria-hidden', 'true');
  // under the boxes as the koi are, and out of the header's flow whatever the theme, for the frame a switch leaves it
  Object.assign(canvas.style, { position: 'absolute', zIndex: '-1', pointerEvents: 'none', visibility: 'hidden' });
  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false });
  if (!gl) {
    return null;
  }
  const parallel = gl.getExtension('KHR_parallel_shader_compile') !== null;
  const program = gl.createProgram()!;
  for (const [type, source] of [[gl.VERTEX_SHADER, VERTEX], [gl.FRAGMENT_SHADER, FRAGMENT]] as const) {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    gl.attachShader(program, shader);
  }
  gl.linkProgram(program);
  return { canvas, gl, program, parallel, uniforms: null, texture: null, busy: false, dead: false };
}

// whether its program is built, set up once it is
function ready (water: Water): boolean {
  const { gl, program } = water;
  if (water.dead || gl.isContextLost()) {
    water.dead = true;
    return false;
  }
  if (water.uniforms) {
    return true;
  }
  if (water.parallel && !gl.getProgramParameter(program, COMPLETION_STATUS)) {
    return false;
  }
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    water.dead = true;
    return false;
  }
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const at = gl.getAttribLocation(program, 'p');
  gl.enableVertexAttribArray(at);
  gl.vertexAttribPointer(at, 2, gl.FLOAT, false, 0, 0);
  water.texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, water.texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  water.uniforms = Object.fromEntries(UNIFORMS.map((name) => [name, gl.getUniformLocation(program, name)])) as Water['uniforms'];
  gl.uniform1i(water.uniforms!.koi, 0);
  gl.clearColor(0, 0, 0, 0);
  return true;
}

function koiOf (header: HTMLElement, width: number): Koi | null {
  const fish = getComputedStyle(header, '::before');
  const src = /url\("?([^")]+)"?\)/.exec(fish.backgroundImage)?.[1];
  if (fish.content === 'none' || fish.scale === '0' || !src) {
    return null;
  }
  const [w, h] = [parseFloat(fish.width), parseFloat(fish.height)];
  // set from its right (the sumi koi), if that's what the style gives back
  const left = Number.isFinite(parseFloat(fish.left)) ? parseFloat(fish.left) : width - parseFloat(fish.right) - w;
  return { src, left, bottom: parseFloat(fish.bottom), w, h, rotate: parseFloat(fish.rotate) || 0 };
}

// a koi's box once turned: its centre, and half its reach either way (the header's px, up from its bottom)
function koiBounds ({ left, bottom, w, h, rotate }: Koi) {
  const [cos, sin] = [Math.abs(Math.cos((rotate * Math.PI) / 180)), Math.abs(Math.sin((rotate * Math.PI) / 180))];
  return { x: left + w / 2, y: bottom + h / 2, ex: (w * cos + h * sin) / 2, ey: (w * sin + h * cos) / 2 };
}

// a spot on the pond in view: in the water over a box (between its title's line and the row above), in no row's first,
// clear of the title's stroke, where no drop runs already; on its koi when asked and the box has one
function pickSpot (onKoi: boolean): Spot | null {
  const scroller = document.querySelector('.dex-column')?.getBoundingClientRect();
  const [top, bottom] = [Math.max(0, scroller?.top ?? 0) + 20, Math.min(window.innerHeight, scroller?.bottom ?? Infinity) - 20];
  const near = [...document.querySelectorAll<HTMLElement>('.dex .box-grid:not([data-hidden]) > .box > .box-header')].filter((header) => {
    const r = header.getBoundingClientRect();
    return r.top < bottom && r.bottom > top && !header.querySelector(':scope > .ink-drop') &&
      Number(getComputedStyle(header).getPropertyValue('--seal-row')) > 0;
  });
  const withKoi = onKoi ? near.filter((header) => koiOf(header, 1)) : [];
  const headers = withKoi.length > 0 ? withKoi : near;
  for (let tries = 0; tries < 8 && headers.length > 0; tries++) {
    const header = headers[Math.floor(Math.random() * headers.length)];
    const zoom = header.currentCSSZoom || 1;
    const r = header.getBoundingClientRect();
    const [width, height] = [r.width / zoom, r.height / zoom];
    const koi = koiOf(header, width);
    let [x, y] = [0, 0];
    if (onKoi && koi) {
      // somewhere on its body, turned as it's turned
      const [ox, oy] = [koi.w * (0.56 * Math.random() - 0.28), koi.h * (0.36 * Math.random() - 0.18)];
      const [cos, sin] = [Math.cos((koi.rotate * Math.PI) / 180), Math.sin((koi.rotate * Math.PI) / 180)];
      const b = koiBounds(koi);
      x = b.x + ox * cos - oy * sin;
      y = b.y - (ox * sin + oy * cos);
    } else {
      // the water from the middle of the title's line up into the gap over the box
      const gap = parseFloat(getComputedStyle(header.closest('.box-grid')!).rowGap) || 60;
      x = width * (0.04 + 0.92 * Math.random());
      y = height * 0.3 + (height * 0.7 + gap * 0.8) * Math.random();
      const title = header.querySelector('h1')?.getBoundingClientRect();
      if (title) {
        const pad = header.closest('.box-complete') ? 48 : 12;
        const [tl, tr] = [(title.left - r.left) / zoom - 12, (title.right - r.left) / zoom + pad];
        const [tb, tt] = [(r.bottom - title.bottom) / zoom - 12, (r.bottom - title.top) / zoom + 12];
        if (x > tl && x < tr && y > tb && y < tt) {
          continue;
        }
      }
    }
    const clientY = r.bottom - y * zoom;
    if (clientY < top || clientY > bottom) {
      continue;
    }
    // a koi its rings reach comes into the water with it
    const b = koi && koiBounds(koi);
    const reaches = b && Math.abs(x - b.x) < b.ex + REACH * 0.7 && Math.abs(y - b.y) < b.ey + REACH * 0.7;
    return { header, x, y, koi: reaches ? koi : null };
  }
  return null;
}

// a canvas the drawing of the koi's picture goes through, once per drop on one
let paper: HTMLCanvasElement | null = null;

// one drop at `spot` on `water`: the canvas laid there, its rings run out, the koi given back. Returns a stop
function drop (water: Water, spot: Spot, done: () => void): () => void {
  const { canvas, gl } = water;
  const uniforms = water.uniforms!;
  const { header, x, y, koi } = spot;
  // device px to the dex's px, through its zoom
  const zoom = header.currentCSSZoom || 1;
  const res = zoom * window.devicePixelRatio;
  // the canvas's box in the header's px (from its left, up from its bottom): round the rings' reach, and the koi's, but
  // only in the water between the rows, from the box's own tiles up to the row above's. Kept off every tile, as each
  // one it overlapped would be lifted into a layer of its own over it, a frame's work as the drop came and went (the
  // rings pass under the tiles unseen anyway). Its edges on whole device px and its pixels the screen's, so the koi it
  // draws lands exactly on the stylesheet's
  const b = koi && koiBounds(koi);
  const at = header.getBoundingClientRect();
  const dpr = window.devicePixelRatio;
  const tiles = header.parentElement?.querySelector(':scope > .box-container')?.getBoundingClientRect();
  const gap = parseFloat(getComputedStyle(header.closest('.box-grid')!).rowGap) || 0;
  const floor = (tiles ? (at.bottom - tiles.top) / zoom : 0) + 1 / res;
  const ceiling = at.height / zoom + gap - 1 / res;
  const left = (Math.round((at.left + Math.min(x - REACH, b ? b.x - b.ex - 4 : Infinity) * zoom) * dpr) / dpr - at.left) / zoom;
  const lowest = Math.max(floor, Math.min(y - REACH, b ? b.y - b.ey - 4 : Infinity));
  const low = (at.bottom - Math.floor((at.bottom - lowest * zoom) * dpr) / dpr) / zoom;
  const W = Math.ceil((Math.max(x + REACH, b ? b.x + b.ex + 4 : -Infinity) - left) * res);
  const H = Math.floor((Math.min(ceiling, Math.max(y + REACH, b ? b.y + b.ey + 4 : -Infinity)) - low) * res);
  const high = low + H / res;
  if (H < 8) {
    done();
    return () => undefined;
  }
  Object.assign(canvas.style, { left: `${left}px`, bottom: `${low}px`, width: `${W / res}px`, height: `${H / res}px`, visibility: 'hidden' });
  header.append(canvas);
  water.busy = true;
  let stopped = false;
  let frame = 0;

  const finish = () => {
    if (stopped) {
      return;
    }
    stopped = true;
    window.cancelAnimationFrame(frame);
    // the koi back, and the canvas away, in the one frame
    delete header.dataset.stirred;
    canvas.style.visibility = 'hidden';
    canvas.remove();
    water.busy = false;
    done();
  };

  const start = (img: HTMLImageElement | null) => {
    if (stopped) {
      return;
    }
    if (!canvas.isConnected || gl.isContextLost()) {
      finish();
      return;
    }
    canvas.width = W;
    canvas.height = H;
    gl.viewport(0, 0, W, H);
    if (img && koi && b) {
      // the koi as the stylesheet draws it: its box's centre where it is, turned as it's turned, its picture (made at
      // twice the size) smoothed as it's drawn smaller
      paper ??= document.createElement('canvas');
      paper.width = W;
      paper.height = H;
      const ctx = paper.getContext('2d')!;
      ctx.imageSmoothingQuality = 'medium';
      ctx.translate((b.x - left) * res, (high - b.y) * res);
      ctx.rotate((koi.rotate * Math.PI) / 180);
      ctx.drawImage(img, (-koi.w / 2) * res, (-koi.h / 2) * res, koi.w * res, koi.h * res);
      gl.bindTexture(gl.TEXTURE_2D, water.texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, paper);
      // let go of its pixels till the next
      paper.width = paper.height = 1;
    }
    const wavelength = WAVELENGTH * res;
    gl.uniform1f(uniforms.hasKoi, img && koi ? 1 : 0);
    gl.uniform2f(uniforms.size, W, H);
    gl.uniform2f(uniforms.centre, (x - left) * res, (high - y) * res);
    gl.uniform1f(uniforms.life, LIFE_MS / 1000);
    gl.uniform1f(uniforms.lambda, wavelength);
    gl.uniform1f(uniforms.band, BAND * wavelength);
    gl.uniform1f(uniforms.speed, SPEED * res);
    gl.uniform1f(uniforms.slope, SLOPE);
    gl.uniform1f(uniforms.reach, REACH * res);
    gl.uniform1f(uniforms.dent, DENT * res);
    gl.uniform1f(uniforms.bend, REFRACT * res);
    gl.uniform1f(uniforms.light, LIGHT);
    gl.uniform1f(uniforms.edge, EDGE * res);
    const draw = (time: number) => {
      gl.uniform1f(uniforms.t, time);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
    // the water flat as it's shown, so the canvas's koi and the stylesheet's trade places unseen
    draw(0);
    canvas.style.visibility = 'visible';
    if (img && koi) {
      header.dataset.stirred = '';
    }
    const t0 = performance.now();
    const tick = (now: number) => {
      if (stopped) {
        return;
      }
      const time = Math.max(0, now - t0) / 1000;
      if (time * 1000 >= LIFE_MS || still() || !pondOn() || !canvas.isConnected || gl.isContextLost()) {
        finish();
        return;
      }
      draw(time);
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
  };

  if (koi) {
    load(koi.src).then(start, finish);
  } else {
    start(null);
  }
  return finish;
}

let narrowList: MediaQueryList | null = null;

function pondOn (): boolean {
  narrowList ??= window.matchMedia('(max-width: 750px)');
  return document.documentElement.dataset.theme === 'ink' && !still() && !document.hidden && !narrowList.matches;
}

// the pond's drops, while Ink's dex is up
export function useInkPond () {
  useEffect(() => {
    const pool: Water[] = [];
    const running = new Set<() => void>();
    let timer = 0;
    let idle = 0;
    let count = 0;
    const tick = () => {
      if (pondOn()) {
        // another canvas made while the page is idle, till there are enough
        if (pool.length < MAX_DROPS && !idle) {
          idle = window.requestIdleCallback(() => {
            idle = 0;
            const water = makeWater();
            if (water) {
              pool.push(water);
            }
          }, { timeout: 1000 });
        }
        const water = running.size < MAX_DROPS ? pool.find((w) => !w.busy && ready(w)) : undefined;
        const spot = water && pickSpot(count % ON_KOI === 0);
        if (water && spot) {
          count++;
          const stop: () => void = drop(water, spot, () => running.delete(stop));
          running.add(stop);
        }
        pool.splice(0, pool.length, ...pool.filter((w) => !w.dead));
      }
      timer = window.setTimeout(tick, EVERY_MS[0] + Math.random() * (EVERY_MS[1] - EVERY_MS[0]));
    };
    timer = window.setTimeout(tick, EVERY_MS[0]);
    return () => {
      window.clearTimeout(timer);
      window.cancelIdleCallback(idle);
      running.forEach((stop) => stop());
      pool.forEach(({ gl }) => gl.getExtension('WEBGL_lose_context')?.loseContext());
    };
  }, []);
}
