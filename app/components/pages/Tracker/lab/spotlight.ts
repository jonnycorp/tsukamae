import { labText } from './lab-i18n';

import type { Locale } from '../../../../i18n/translations';

// how long the room stays dimmed round it, and how long the ring stays once it's lifted; any press or key lets it go
const DIM_MS = 1600;
const HOLD_MS = 9000;
const COLUMNS = 6;

let current: (() => void) | null = null;

// where a tile sits in the boxes, as its box draws it: the box's number and title, its row and column (a list row has
// none of these: its box's title alone, or nothing)
function placeOf (tile: Element, locale: Locale): string {
  const box = tile.closest('.box');
  if (!box) {
    return '';
  }
  const boxes = [...document.querySelectorAll('.dex .box-grid > .box')];
  const title = box.querySelector('.box-header h1')?.textContent ?? '';
  const slots = [...(tile.parentElement?.children ?? [])];
  const slot = slots.indexOf(tile);
  return [
    labText(locale, 'find.box', { n: boxes.indexOf(box) + 1 }),
    title,
    slot >= 0 ? labText(locale, 'find.slot', { row: Math.floor(slot / COLUMNS) + 1, column: (slot % COLUMNS) + 1 }) : '',
  ].filter(Boolean).join(' · ');
}

// a mon shown where it's filed, rather than opened (the search's Enter, lab/FindSketch.tsx): the room dimmed round its
// tile for a moment, a ring of the accent left round it and its place in the boxes named under it, following it as the
// dex scrolls, till a press, a key or a few seconds let it go. Its own element over the page, so the dex is untouched
export function spotlight (tile: Element, locale: Locale) {
  current?.();
  const spot = document.createElement('div');
  spot.className = 'lab-spot';
  const label = document.createElement('span');
  label.textContent = placeOf(tile, locale);
  spot.appendChild(label);
  document.body.appendChild(spot);

  let frame = 0;
  const follow = () => {
    const rect = tile.getBoundingClientRect();
    spot.style.transform = `translate(${rect.left}px, ${rect.top}px)`;
    spot.style.width = `${rect.width}px`;
    spot.style.height = `${rect.height}px`;
    // the name under it, centred, but kept inside the window
    const width = label.offsetWidth;
    label.style.left = `${Math.max(8 - rect.left, Math.min((rect.width - width) / 2, window.innerWidth - 8 - rect.left - width))}px`;
    frame = requestAnimationFrame(follow);
  };
  follow();
  const lift = window.setTimeout(() => spot.classList.add('lifted'), DIM_MS);
  const done = window.setTimeout(() => stop(), HOLD_MS);

  const stop = () => {
    cancelAnimationFrame(frame);
    window.clearTimeout(lift);
    window.clearTimeout(done);
    document.removeEventListener('pointerdown', stop, true);
    document.removeEventListener('keydown', stop, true);
    spot.classList.add('gone');
    window.setTimeout(() => spot.remove(), 300);
    if (current === stop) {
      current = null;
    }
  };
  current = stop;
  // after this press's own events have gone by
  window.setTimeout(() => {
    document.addEventListener('pointerdown', stop, true);
    document.addEventListener('keydown', stop, true);
  });
}
