import { useEffect, useMemo } from 'react';

import { TOKEN_NAMES } from './tokens';

// Broadcasts workbench picks to every open app tab (dev aid; nothing persists).

const CHANNEL = 'tsukamae-palette';

// Message: token-name → css value map, or null meaning "clear overrides".
type PaletteMessage = Record<string, string> | null;

function applyToRoot (values: PaletteMessage) {
  const root = document.documentElement;
  if (values === null) {
    for (const name of TOKEN_NAMES) {
      root.style.removeProperty(`--${name}`);
    }
    return;
  }
  for (const [name, value] of Object.entries(values)) {
    root.style.setProperty(`--${name}`, value);
  }
}

// Mounted once in App so every tab follows workbench picks.
export function usePaletteBroadcastReceiver () {
  useEffect(() => {
    if (!('BroadcastChannel' in window)) {
      return;
    }
    const channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = (e: MessageEvent<PaletteMessage>) => applyToRoot(e.data);
    return () => channel.close();
  }, []);
}

export function usePaletteBroadcastSender () {
  const channel = useMemo(() => ('BroadcastChannel' in window ? new BroadcastChannel(CHANNEL) : null), []);

  useEffect(() => {
    return () => channel?.close();
  }, [channel]);

  return (values: PaletteMessage) => channel?.postMessage(values);
}
