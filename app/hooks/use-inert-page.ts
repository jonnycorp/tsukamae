import { useEffect } from 'react';

// how many modals and scenes are up: the page stays inert until the last of them goes
let holders = 0;

// the page behind a modal or the timeline, out of reach of the keyboard and the pointer while either is up; both are
// portalled into body, outside #root, so they stay live. Without it Tab walked the search bar and filters behind them,
// and could switch the dex out from under Edit Dex
export function useInertPage () {
  useEffect(() => {
    const root = document.getElementById('root');
    holders++;
    root?.setAttribute('inert', '');
    return () => {
      holders--;
      if (holders === 0) {
        root?.removeAttribute('inert');
      }
    };
  }, []);
}
