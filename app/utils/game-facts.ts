// what each origin game (data/games.json) is beyond its name: the generation it came out in, and the day it first came
// out anywhere. HOME, GO, a trade, a gift or "other" can hand on a mon from anywhere, so they have no generation; HOME
// and GO have a day
export interface GameFacts {
  gen?: number;
  release?: string;
}

export const GAME_FACTS: Record<string, GameFacts> = {
  firered: { gen: 3, release: '2004-01-29' },
  leafgreen: { gen: 3, release: '2004-01-29' },
  diamond: { gen: 4, release: '2006-09-28' },
  pearl: { gen: 4, release: '2006-09-28' },
  platinum: { gen: 4, release: '2008-09-13' },
  heartgold: { gen: 4, release: '2009-09-12' },
  soulsilver: { gen: 4, release: '2009-09-12' },
  black: { gen: 5, release: '2010-09-18' },
  white: { gen: 5, release: '2010-09-18' },
  black_2: { gen: 5, release: '2012-06-23' },
  white_2: { gen: 5, release: '2012-06-23' },
  x: { gen: 6, release: '2013-10-12' },
  y: { gen: 6, release: '2013-10-12' },
  omega_ruby: { gen: 6, release: '2014-11-21' },
  alpha_sapphire: { gen: 6, release: '2014-11-21' },
  sun: { gen: 7, release: '2016-11-18' },
  moon: { gen: 7, release: '2016-11-18' },
  ultra_sun: { gen: 7, release: '2017-11-17' },
  ultra_moon: { gen: 7, release: '2017-11-17' },
  lets_go_pikachu: { gen: 7, release: '2018-11-16' },
  lets_go_eevee: { gen: 7, release: '2018-11-16' },
  sword: { gen: 8, release: '2019-11-15' },
  shield: { gen: 8, release: '2019-11-15' },
  brilliant_diamond: { gen: 8, release: '2021-11-19' },
  shining_pearl: { gen: 8, release: '2021-11-19' },
  legends_arceus: { gen: 8, release: '2022-01-28' },
  scarlet: { gen: 9, release: '2022-11-18' },
  violet: { gen: 9, release: '2022-11-18' },
  legends_za: { gen: 9, release: '2025-10-16' },
  go: { release: '2016-07-06' },
  home: { release: '2020-02-11' },
};
