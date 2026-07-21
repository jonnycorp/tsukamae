import { useEffect, useMemo } from 'react';

import { applyTheme, setRootTokens } from './apply-theme';

// Broadcasts workbench picks to every open app tab (dev aid; nothing persists).

const CHANNEL = 'tsukamae-palette';

// Message: token-name → css value map, or null meaning "clear overrides".
type PaletteMessage = Record<string, string> | null;

// Mounted once in App so every tab follows workbench picks; a reset falls back to the active theme.
export function usePaletteBroadcastReceiver (theme: string) {
  useEffect(() => {
    if (!('BroadcastChannel' in window)) {
      return;
    }
    const channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = (e: MessageEvent<PaletteMessage>) => {
      if (e.data === null) {
        applyTheme(theme);
      } else {
        setRootTokens(e.data);
      }
    };
    return () => channel.close();
  }, [theme]);
}

export function usePaletteBroadcastSender () {
  const channel = useMemo(() => ('BroadcastChannel' in window ? new BroadcastChannel(CHANNEL) : null), []);

  useEffect(() => {
    return () => channel?.close();
  }, [channel]);

  return (values: PaletteMessage) => channel?.postMessage(values);
}
