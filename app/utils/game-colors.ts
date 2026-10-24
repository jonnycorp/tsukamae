// each game's own colour, as its box art wears it: a hue, and how much of the page's chroma it takes (a neutral for
// what isn't a game). The hues are fixed in every theme, as the location tints are; lightness and chroma come from the
// page's mode (--game-l, --game-c in styles/main.scss), so a colour reads on light paper and dark alike
const HUES: Record<string, [hue: number, chroma: number]> = {
  home: [175, 1],
  legends_za: [140, 1],
  scarlet: [32, 1],
  violet: [305, 1],
  legends_arceus: [78, 0.55],
  brilliant_diamond: [235, 1],
  shining_pearl: [345, 0.8],
  sword: [245, 1],
  shield: [352, 1],
  lets_go_pikachu: [95, 1],
  lets_go_eevee: [60, 0.7],
  ultra_sun: [45, 1],
  ultra_moon: [312, 1],
  sun: [68, 1],
  moon: [288, 0.9],
  omega_ruby: [22, 1],
  alpha_sapphire: [255, 1],
  x: [250, 1],
  y: [18, 1],
  // Black and White as a cool and a warm grey, the sequels in their Kyurems' blue and orange
  black_2: [228, 0.7],
  white_2: [28, 0.75],
  black: [255, 0.2],
  white: [70, 0.18],
  heartgold: [85, 1],
  soulsilver: [240, 0.3],
  platinum: [65, 0.35],
  diamond: [250, 0.75],
  pearl: [340, 0.6],
  firered: [30, 1],
  leafgreen: [135, 0.9],
  go: [215, 0.9],
  mystery_gift: [330, 1],
};

// a catalog's expansion (scarlet_expansion_pass) wears its game's colour
export function gameColor (game: string | null | undefined): string {
  const [hue, chroma] = HUES[(game ?? '').replace(/_expansion_pass$/, '')] ?? [0, 0];
  return `oklch(var(--game-l) calc(var(--game-c) * ${chroma}) ${hue})`;
}
