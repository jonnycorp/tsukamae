// the box sprites for a canvas: each icon's cut of the sheet (pokesprite.scss), read once from the stylesheet's own
// rules by laying the icons out unseen, and the sheet twice over, as itself and as a silhouette in one colour
export interface SpriteCut {
  x: number;
  y: number;
  w: number;
  h: number;
}

const SHEET = '/pokesprite-v13.png';
const cuts = new Map<string, SpriteCut | null>();
let sheet: HTMLImageElement | null = null;
const shadows = new Map<string, HTMLCanvasElement>();

// the cuts for these icon classes, measured together (one layout for the lot)
export function spriteCuts (classes: string[]): Map<string, SpriteCut | null> {
  const fresh = [...new Set(classes)].filter((name) => !cuts.has(name));
  if (fresh.length > 0) {
    const host = document.createElement('div');
    host.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden;contain:strict;width:1px;height:1px';
    const icons = fresh.map((name) => {
      const icon = document.createElement('i');
      icon.className = name;
      host.appendChild(icon);
      return icon;
    });
    document.body.appendChild(host);
    icons.forEach((icon, i) => {
      const style = getComputedStyle(icon);
      const [x, y] = style.backgroundPosition.split(' ').map((part) => -parseFloat(part));
      const w = parseFloat(style.width);
      const h = parseFloat(style.height);
      cuts.set(fresh[i], w > 0 && h > 0 ? { x, y, w, h } : null);
    });
    host.remove();
  }
  return new Map(classes.map((name) => [name, cuts.get(name) ?? null]));
}

// the sheet, calling back once it's in (at once if it already is)
export function spriteSheet (onLoad: () => void): HTMLImageElement {
  if (!sheet) {
    sheet = new Image();
    sheet.src = SHEET;
  }
  if (!sheet.complete) {
    sheet.addEventListener('load', onLoad, { once: true });
  }
  return sheet;
}

// the sheet as a silhouette in this colour, made once a colour (null till the sheet is in)
export function spriteShadow (color: string): HTMLCanvasElement | null {
  if (!sheet?.complete || !sheet.naturalWidth) {
    return null;
  }
  let shadow = shadows.get(color);
  if (!shadow) {
    shadow = document.createElement('canvas');
    shadow.width = sheet.naturalWidth;
    shadow.height = sheet.naturalHeight;
    const ctx = shadow.getContext('2d')!;
    ctx.drawImage(sheet, 0, 0);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, shadow.width, shadow.height);
    shadows.set(color, shadow);
  }
  return shadow;
}
