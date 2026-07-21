// Minimal geometric pokéball for small toggles; strokes ride currentColor, the top fills when checked.
export function PokeballIcon () {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path className="pokeball-top" d="M2 12a10 10 0 0 1 20 0z" />
      <circle className="pokeball-outline" cx="12" cy="12" r="10" />
      <line className="pokeball-band" x1="2" x2="22" y1="12" y2="12" />
      <circle className="pokeball-button" cx="12" cy="12" r="3.5" />
    </svg>
  );
}
