export function padding (number: number, digits: number): string {
  return String(number).padStart(digits, '0');
}

export function serebiiLink (serebiiPath: string, nationalId: number) {
  return `http://www.serebii.net/${serebiiPath}/${padding(nationalId, 3)}.shtml`;
}

// serebii's dex for a game family; a family missing here (a dataset newer than this list) falls back to the newest dex,
// home's
const SEREBII_DEXES: Record<string, string> = {
  x_y: 'pokedex-xy',
  omega_ruby_alpha_sapphire: 'pokedex-xy',
  sun_moon: 'pokedex-sm',
  ultra_sun_ultra_moon: 'pokedex-sm',
  lets_go_pikachu_eevee: 'pokedex-sm',
  sword_shield: 'pokedex-swsh',
  sword_shield_expansion_pass: 'pokedex-swsh',
  brilliant_diamond_shining_pearl: 'pokedex-swsh',
  legends_arceus: 'pokedex-swsh',
  scarlet_violet: 'pokedex-sv',
  scarlet_violet_expansion_pass: 'pokedex-sv',
  // serebii's gen-9 dex covers both SV and Legends: Z-A
  legends_za: 'pokedex-sv',
  home: 'pokedex-sv',
};

// a species' pages on Bulbapedia and Serebii (in the dex of the game family it's viewed in)
export function monLinks (pokemon: { name: string; national_id: number }, family: string): { bulbapedia: string; serebii: string } {
  return {
    bulbapedia: `https://bulbapedia.bulbagarden.net/wiki/${encodeURI(pokemon.name)}_(Pok%C3%A9mon)`,
    serebii: serebiiLink(SEREBII_DEXES[family] ?? SEREBII_DEXES.home, pokemon.national_id),
  };
}
