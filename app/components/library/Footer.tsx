import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircle } from '@fortawesome/free-solid-svg-icons';

export function Footer () {
  return (
    <footer className="main-footer">
      <span>Tsukamae</span>
      <FontAwesomeIcon icon={faCircle} />
      <a className="link" href="https://pokedextracker.com" rel="noopener noreferrer" target="_blank">Based on PokédexTracker</a>
    </footer>
  );
}
