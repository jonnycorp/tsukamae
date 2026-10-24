import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';

// how far a press travels before it's a drag rather than a click
const THRESHOLD = 6;

// the items the list holds now (refs of removed ones linger past its end)
const placedOf = (items: (HTMLElement | null)[], count: number) => items.slice(0, count);

interface Press {
  index: number;
  pointerId: number;
  startY: number;
  // where the pointer is now, kept for a scroll that carries the list under a pointer standing still
  y: number;
  dragging: boolean;
  // the place it would drop into now
  to: number;
  // every item's box as the drag began, and the list's top then, which a scroll during the drag is measured from
  rects: DOMRect[];
  listTop: number;
}

// a list put in order by dragging its items, as objects: a press (on the item's grip, where it has one) that travels
// past THRESHOLD picks the item up, which follows the pointer up and down inside the list while the others step aside
// to open its slot, and let go it's moved there (onMove). A press that doesn't travel is a click as before; one that
// dragged isn't. Escape puts a dragged item back, and Alt+↑/↓ moves the focused one a place. Only transforms move
// during the drag, so nothing re-renders till the drop, and the drop's render (the new order) clears them before it
// paints
export function useDragReorder (count: number, onMove: (from: number, to: number) => void) {
  const items = useRef<(HTMLElement | null)[]>([]);
  const press = useRef<Press | null>(null);
  const swallowClick = useRef(false);
  // set by a drop or a key: the item to give focus back to once the new order is in, if any
  const settle = useRef<{ focus: number | null } | null>(null);
  const moveRef = useRef(onMove);
  moveRef.current = onMove;
  const countRef = useRef(count);
  countRef.current = count;
  const [dragging, setDragging] = useState<number | null>(null);

  // the new order is in the page: the offsets go at once (not eased back from where the old order had them), then the
  // items' own transitions return for the next drag
  useLayoutEffect(() => {
    if (!settle.current) {
      return;
    }
    const { focus } = settle.current;
    settle.current = null;
    placedOf(items.current, countRef.current).forEach((el) => {
      if (el) {
        el.style.transition = 'none';
        el.style.transform = '';
      }
    });
    if (items.current[0]) {
      // a reflow, so the cleared offsets land before the transitions come back
      void items.current[0].offsetHeight;
    }
    placedOf(items.current, countRef.current).forEach((el) => {
      if (el) {
        el.style.transition = '';
      }
    });
    if (focus !== null) {
      items.current[focus]?.focus();
    }
  });

  useEffect(() => {
    // the carried item under the pointer and the others stepped aside, all in the list's own frame as the drag began:
    // a scroll that carries the list under the pointer is travel too, so the item stays under it
    const place = (current: Press) => {
      const { rects, index } = current;
      const own = rects[index];
      const zoom = items.current[index]?.currentCSSZoom ?? 1;
      const listTop = items.current[index]?.parentElement?.getBoundingClientRect().top ?? current.listTop;
      const dy = current.y - (listTop - current.listTop) - current.startY;
      // kept inside the list
      const offset = Math.max(rects[0].top - own.top, Math.min(rects[rects.length - 1].bottom - own.bottom, dy));
      const centre = own.top + own.height / 2 + offset;
      let to = index;
      rects.forEach((rect, i) => {
        const middle = rect.top + rect.height / 2;
        if (i < index && centre < middle) {
          to = Math.min(to, i);
        } else if (i > index && centre > middle) {
          to = Math.max(to, i);
        }
      });
      current.to = to;
      // those it has passed step over by its height and the gap, into the slot it left
      const gap = rects.length > 1 ? rects[1].top - rects[0].bottom : 0;
      const step = (own.height + gap) / zoom;
      placedOf(items.current, countRef.current).forEach((el, i) => {
        if (!el) {
          return;
        }
        let shift = 0;
        if (i === index) {
          shift = offset / zoom;
        } else if (i > index && i <= to) {
          shift = -step;
        } else if (i < index && i >= to) {
          shift = step;
        }
        el.style.transform = shift ? `translateY(${shift}px)` : '';
      });
    };

    // released lets go of the click that follows the release at once; put back by Escape, the button's still down, and
    // the click its release makes (on the item, if it's let go there) is swallowed too
    const finish = (commit: boolean, released = true) => {
      const current = press.current;
      press.current = null;
      if (!current?.dragging) {
        return;
      }
      // the click that follows the release, on the item that was carried, isn't one
      swallowClick.current = true;
      const spent = () => setTimeout(() => {
        swallowClick.current = false;
      }, 0);
      if (released) {
        spent();
      } else {
        window.addEventListener('pointerup', spent, { once: true });
      }
      setDragging(null);
      if (commit && current.to !== current.index) {
        // focus goes with the item it was on, which the new order can take out of the page and put back
        settle.current = { focus: document.activeElement === items.current[current.index] ? current.to : null };
        moveRef.current(current.index, current.to);
      } else {
        // put back: they ease home
        placedOf(items.current, countRef.current).forEach((el) => {
          if (el) {
            el.style.transform = '';
          }
        });
      }
    };

    const handleMove = (e: PointerEvent) => {
      const current = press.current;
      if (!current || e.pointerId !== current.pointerId) {
        return;
      }
      // its release went unheard (let go over another window, or a menu): over, and put back
      if (e.buttons === 0) {
        finish(false);
        return;
      }
      current.y = e.clientY;
      if (!current.dragging) {
        if (Math.abs(current.y - current.startY) < THRESHOLD) {
          return;
        }
        current.dragging = true;
        current.rects = placedOf(items.current, countRef.current).map((el) => el!.getBoundingClientRect());
        current.listTop = items.current[current.index]?.parentElement?.getBoundingClientRect().top ?? 0;
        setDragging(current.index);
      }
      e.preventDefault();
      place(current);
    };

    const handleScroll = () => {
      if (press.current?.dragging) {
        place(press.current);
      }
    };
    const handleUp = (e: PointerEvent) => {
      if (press.current && e.pointerId === press.current.pointerId) {
        finish(true);
      }
    };
    const handleCancel = (e: PointerEvent) => {
      if (press.current && e.pointerId === press.current.pointerId) {
        finish(false);
      }
    };
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && press.current?.dragging) {
        e.preventDefault();
        e.stopPropagation();
        finish(false, false);
      }
    };

    window.addEventListener('pointermove', handleMove, { passive: false });
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleCancel);
    window.addEventListener('keydown', handleKeydown, true);
    window.addEventListener('scroll', handleScroll, { capture: true, passive: true });
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleCancel);
      window.removeEventListener('keydown', handleKeydown, true);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, []);

  const itemProps = (index: number) => ({
    ref: (el: HTMLElement | null) => {
      items.current[index] = el;
    },
    // an item with a grip (data-drag-handle) is picked up by it alone, so a press anywhere else stays a click; a press
    // on one of its own buttons (edit, delete) is that button's
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
      // a new press: whatever release an Escape left the click waiting on has come and gone
      swallowClick.current = false;
      const target = e.target as Element;
      const handle = e.currentTarget.querySelector('[data-drag-handle]');
      if (e.button !== 0 || (handle && !handle.contains(target)) || target.closest('button, input, a, select, textarea')) {
        return;
      }
      press.current = { index, pointerId: e.pointerId, startY: e.clientY, y: e.clientY, dragging: false, to: index, rects: [], listTop: 0 };
    },
    onClickCapture: (e: ReactMouseEvent<HTMLElement>) => {
      if (swallowClick.current) {
        e.stopPropagation();
        e.preventDefault();
      }
    },
    onKeyDown: (e: ReactKeyboardEvent<HTMLElement>) => {
      if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') || e.target !== e.currentTarget) {
        return;
      }
      e.preventDefault();
      const to = index + (e.key === 'ArrowUp' ? -1 : 1);
      if (to >= 0 && to < countRef.current) {
        settle.current = { focus: to };
        moveRef.current(index, to);
      }
    },
    'data-dragging': dragging === index || undefined,
  });

  return { itemProps, dragging };
}
