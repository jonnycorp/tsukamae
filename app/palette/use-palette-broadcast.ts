import { useEffect, useMemo } from 'react';

import { TESTING } from '../utils/testing';
import { applyTheme, setRootTokens } from './apply-theme';

const CHANNEL = 'tsukamae-palette';

// token → css value, or null to fall back to the active theme
type PaletteMessage = Record<string, string> | null;

export function usePaletteBroadcastReceiver (theme: string) {
  useEffect(() => {
    if (!TESTING) {
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
  const channel = useMemo(() => new BroadcastChannel(CHANNEL), []);

  useEffect(() => () => channel.close(), [channel]);

  return (values: PaletteMessage) => channel.postMessage(values);
}
