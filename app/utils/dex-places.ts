// free-form dexes: a mon in HOME can be in one of your checklist dexes' boxes there, which its location_save
// names by that dex's id (a save's id names a game, and a dex's starts dex-)
export const isDexPlaceId = (id: string | null | undefined): id is string => typeof id === 'string' && id.startsWith('dex-');
