export const MAC = /Mac|iPhone|iPad/.test(navigator.platform);

// the modifiers as macOS names them by their signs, where the handlers take Cmd for Ctrl and Option is Alt
export const MOD_KEY = MAC ? '⌘' : 'Ctrl';
export const ALT_KEY = MAC ? '⌥' : 'Alt';
