import classNames from 'classnames';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLongArrowAltRight, faTrash, faXmark } from '@fortawesome/free-solid-svg-icons';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { LANGUAGES, ORIGIN_GAMES } from '../../../utils/local-data';
import { PokemonName } from '../../library/PokemonName';
import { iconClass } from '../../../utils/pokemon';
import { localizeCaptureLanguage, localizeOriginGame } from '../../../i18n/names';
import { nationalId, padding, serebiiLink } from '../../../utils/formatting';
import { useDeleteCapture, useUpdateCapture } from '../../../hooks/queries/captures';
import { useDexContext } from '../../../hooks/contexts/use-dex-context';
import { useDismissable } from '../../../hooks/use-dismissable';
import { useTrackerContext } from './use-tracker';
import { useTranslation } from '../../../hooks/use-translation';

import type { CaptureStatus } from '../../../types';
import type { ChangeEvent } from 'react';
import type { TranslationKey } from '../../../i18n/translations';

// Guardrail: status/origin/language/release only — this app is a visualizer, not HOME bookkeeping.

const SEREBII_LINKS: Record<string, string> = {
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
  // Serebii's Gen-9 dex covers both SV and Legends: Z-A.
  legends_za: 'pokedex-sv',
  home: 'pokedex-sv',
};

const STATUS_OPTIONS: { value: CaptureStatus; labelKey: TranslationKey }[] = [
  { value: 'caught', labelKey: 'status.caught' },
  { value: 'temporary', labelKey: 'status.temporary' },
  { value: 'locked', labelKey: 'status.locked' },
];

// Gap between the popover and its anchor tile / the viewport edges.
const GAP = 8;

interface Props {
  // Unmounts the popover (fade already played — see useDismissable).
  onClose: () => void;
  selectedPokemon: number;
}

// Anchored to the clicked tile via position: fixed; the box grid never reflows.
export function PokemonPopover ({ onClose, selectedPokemon }: Props) {
  const { activeDex, activeDexView } = useDexContext();
  const { captures, setCaptures } = useTrackerContext();
  const { t, locale } = useTranslation();

  const updateCaptureMutation = useUpdateCapture(activeDex!.id);
  const deleteCaptureMutation = useDeleteCapture(activeDex!.id);

  const capture = useMemo(() => captures.find((cap) => cap.pokemon.id === selectedPokemon), [captures, selectedPokemon]);

  const popoverRef = useRef<HTMLDivElement>(null);
  const { closing, dismiss } = useDismissable({ onDismissed: onClose, ref: popoverRef });

  // null until measured (renders hidden one commit so real size can position it).
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [above, setAbove] = useState(false);

  useLayoutEffect(() => {
    const el = popoverRef.current;
    const anchor = document.querySelector(`[data-pokemon-id='${selectedPokemon}']`);
    if (!el || !anchor) {
      // No tile to anchor to (filtered out between click and mount) — bail.
      onClose();
      return;
    }

    const rect = anchor.getBoundingClientRect();
    const popW = el.offsetWidth;
    const popH = el.offsetHeight;

    // Below the tile; flip above when cramped; pin on-screen when neither side fits.
    const fitsBelow = rect.bottom + GAP + popH <= window.innerHeight - GAP;
    const fitsAbove = rect.top - GAP - popH >= GAP;

    let top = rect.bottom + GAP;
    let flipped = false;
    if (!fitsBelow && fitsAbove) {
      top = rect.top - popH - GAP;
      flipped = true;
    } else if (!fitsBelow && !fitsAbove) {
      top = Math.max(GAP, window.innerHeight - popH - GAP);
    }
    const left = Math.max(GAP, Math.min(rect.left + rect.width / 2 - popW / 2, window.innerWidth - popW - GAP));

    setPosition({ top, left });
    setAbove(flipped);
    // capture?.captured changes the content (selects vs. note) and thus the height.
  }, [selectedPokemon, capture?.captured]);

  // Scroll/resize dismisses — fixed positioning would drift from the tile.
  useEffect(() => {
    const close = () => dismiss();

    document.addEventListener('scroll', close, { capture: true, passive: true });
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [dismiss]);

  const handleOriginGameChange = (e: ChangeEvent<HTMLSelectElement>) => {
    if (!capture) {
      return;
    }

    const originGame = e.target.value || null;

    setCaptures((prev) => prev.map((cap) => {
      if (cap.pokemon.id !== capture.pokemon.id) {
        return cap;
      }
      return { ...cap, origin_game: originGame };
    }));

    updateCaptureMutation.mutate({ payload: { pokemon: capture.pokemon.id, origin_game: originGame } });
  };

  const handleLanguageChange = (e: ChangeEvent<HTMLSelectElement>) => {
    if (!capture) {
      return;
    }

    const language = e.target.value || null;

    setCaptures((prev) => prev.map((cap) => {
      if (cap.pokemon.id !== capture.pokemon.id) {
        return cap;
      }
      return { ...cap, language };
    }));

    updateCaptureMutation.mutate({ payload: { pokemon: capture.pokemon.id, language } });
  };

  const handleStatusChange = (e: ChangeEvent<HTMLSelectElement>) => {
    if (!capture) {
      return;
    }

    const status = e.target.value as CaptureStatus;

    setCaptures((prev) => prev.map((cap) => {
      if (cap.pokemon.id !== capture.pokemon.id) {
        return cap;
      }
      return { ...cap, status };
    }));

    updateCaptureMutation.mutate({ payload: { pokemon: capture.pokemon.id, status } });
  };

  // Release removes the mon and its metadata; the popover goes with it.
  const handleRelease = () => {
    if (!capture) {
      return;
    }

    setCaptures((prev) => prev.map((cap) => {
      if (cap.pokemon.id !== capture.pokemon.id) {
        return cap;
      }
      return { ...cap, captured: false, status: null, origin_game: null, language: null };
    }));

    deleteCaptureMutation.mutate({ payload: { pokemon: [capture.pokemon.id] } });
    dismiss();
  };

  if (!capture) {
    return null;
  }

  const { pokemon } = capture;
  const dexView = activeDexView!;
  const regional = dexView.dex_type.tags.includes('regional');
  const idToDisplay = regional ? (pokemon.dex_number === -1 ? '---' : pokemon.dex_number) : nationalId(pokemon.national_id);

  return (
    <div
      className={classNames('pokemon-popover', { 'popover-above': above, closing })}
      ref={popoverRef}
      style={position ?? { visibility: 'hidden' }}
    >
      <div className="popover-header">
        <i className={iconClass(pokemon, dexView)} />
        <h1><PokemonName name={pokemon.name} nameJa={pokemon.name_ja} /></h1>
        <h2>#{padding(idToDisplay, dexView.total >= 1000 ? 4 : 3)}</h2>
        <button aria-label={t('popover.close')} className="popover-close" onClick={dismiss} title={t('popover.close')} type="button">
          <FontAwesomeIcon icon={faXmark} />
        </button>
      </div>

      <div className="popover-body">
        {capture.captured ?
          <>
            <div className="form-group">
              <label htmlFor="origin-game">{t('info.originGame')}</label>
              <select
                className="form-control"
                id="origin-game"
                name="origin-game"
                onChange={handleOriginGameChange}
                value={capture.origin_game || ''}
              >
                <option value="">—</option>
                {ORIGIN_GAMES.map((game) => <option key={game.id} value={game.id}>{localizeOriginGame(locale, game.id, game.name)}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="language">{t('info.language')}</label>
              <select
                className="form-control"
                id="language"
                name="language"
                onChange={handleLanguageChange}
                value={capture.language || ''}
              >
                <option value="">—</option>
                {LANGUAGES.map((language) => <option key={language.id} value={language.id}>{localizeCaptureLanguage(locale, language.id, language.name)}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="status">{t('info.status')}</label>
              <select
                className="form-control"
                id="status"
                name="status"
                onChange={handleStatusChange}
                value={capture.status || 'caught'}
              >
                {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{t(option.labelKey)}</option>)}
              </select>
            </div>
          </> :
          <p className="popover-uncaught-note">{t('info.notCaught')}</p>
        }

        <div className="popover-links">
          <a
            href={`http://bulbapedia.bulbagarden.net/wiki/${encodeURI(pokemon.name)}_(Pok%C3%A9mon)`}
            rel="noopener noreferrer"
            target="_blank"
          >
            Bulbapedia <FontAwesomeIcon icon={faLongArrowAltRight} />
          </a>
          <a
            href={serebiiLink(SEREBII_LINKS[dexView.game.game_family.id], pokemon.national_id)}
            rel="noopener noreferrer"
            target="_blank"
          >
            Serebii <FontAwesomeIcon icon={faLongArrowAltRight} />
          </a>
        </div>
      </div>

      {capture.captured &&
        <div className="popover-footer">
          <button className="popover-release" onClick={handleRelease} type="button">
            <FontAwesomeIcon icon={faTrash} /> {t('info.release')}
          </button>
        </div>
      }
    </div>
  );
}
