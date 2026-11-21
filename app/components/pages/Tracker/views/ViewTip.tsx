import { createPortal } from 'react-dom';
import { useLayoutEffect, useRef } from 'react';

import { placeBeside } from '../Scene';

import type { ReactNode } from 'react';

interface Props {
  // the point it sits beside, in the window's pixels
  x: number;
  y: number;
  // the scene's zoom, which it takes on so it reads at the scene's size
  scale: number;
  gap?: number;
  children: ReactNode;
}

// the views' loupe: a card beside a point, kept in the window, over everything in the scene
export function ViewTip ({ x, y, scale, gap = 16, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (ref.current) {
      placeBeside(ref.current, x, y, gap);
    }
  });
  return createPortal(
    <div className="view-tip-layer" style={{ zoom: scale }}>
      <div className="view-tip" ref={ref} role="status">{children}</div>
    </div>,
    document.body,
  );
}
