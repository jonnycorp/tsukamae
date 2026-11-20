// textures a scene makes for itself as it starts, so nothing is drawn ahead and committed: value noise and the canvases
// it's laid on, and a canvas handed to the stylesheet as a custom property on the root

// a seeded generator, so a texture comes out the same every launch
export function rng (seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// tiling value noise, `cells` across a `size` square, summed over `octaves`, each twice as fine and half as strong: 0..1
export function fbm (size: number, cells: number, octaves: number, seed: number, stretch = 1): Float32Array {
  const out = new Float32Array(size * size);
  let amp = 1;
  let total = 0;
  const random = rng(seed);
  for (let o = 0; o < octaves; o++) {
    const cx = Math.max(1, Math.round(cells * stretch * 2 ** o));
    const cy = Math.max(1, Math.round(cells * 2 ** o));
    const grid = Float32Array.from({ length: cx * cy }, random);
    for (let y = 0; y < size; y++) {
      const gy = (y / size) * cy;
      const y0 = Math.floor(gy);
      const fy = gy - y0;
      const sy = fy * fy * (3 - 2 * fy);
      for (let x = 0; x < size; x++) {
        const gx = (x / size) * cx;
        const x0 = Math.floor(gx);
        const fx = gx - x0;
        const sx = fx * fx * (3 - 2 * fx);
        const a = grid[(y0 % cy) * cx + (x0 % cx)];
        const b = grid[(y0 % cy) * cx + ((x0 + 1) % cx)];
        const c = grid[((y0 + 1) % cy) * cx + (x0 % cx)];
        const d = grid[((y0 + 1) % cy) * cx + ((x0 + 1) % cx)];
        out[y * size + x] += amp * ((a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sy);
      }
    }
    total += amp;
    amp /= 2;
  }
  for (let i = 0; i < out.length; i++) {
    out[i] /= total;
  }
  return out;
}

export function canvas (width: number, height = width): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  return [c, c.getContext('2d')!];
}

// a canvas as a background for the stylesheet (--name), taken off again with what this returns
export function toProperty (name: string, c: HTMLCanvasElement): () => void {
  const root = document.documentElement;
  root.style.setProperty(name, `url(${c.toDataURL('image/png')})`);
  return () => root.style.removeProperty(name);
}
