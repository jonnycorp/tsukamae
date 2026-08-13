import classNames from 'classnames';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLock, faLongArrowAltRight, faTrash, faXmark } from '@fortawesome/free-solid-svg-icons';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { CAPTURE_FIELDS, formatFieldValue, unansweredFields, withFieldInvariants } from '../../../utils/capture-fields';
import { CaptureFieldControl } from '../../library/CaptureFieldControl';
import { Dropdown } from '../../library/Dropdown';
import { PokemonName } from '../../library/PokemonName';
import { iconClass } from '../../../utils/pokemon';
import { nationalId, padding, serebiiLink } from '../../../utils/formatting';
import { useDexContext } from '../../../hooks/contexts/use-dex-context';
import { useDismissable } from '../../../hooks/use-dismissable';
import { useTrackerActions, useTrackerState } from './use-tracker';
import { useTranslation } from '../../../hooks/use-translation';

import type { CaptureMetadata, CaptureStatus } from '../../../types';
import type { TranslationKey } from '../../../i18n/translations';

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
  // serebii's gen-9 dex covers both SV and Legends: Z-A
  legends_za: 'pokedex-sv',
  home: 'pokedex-sv',
};

const STATUS_OPTIONS: { value: CaptureStatus; labelKey: TranslationKey }[] = [
  { value: 'caught', labelKey: 'status.caught' },
  { value: 'temporary', labelKey: 'status.temporary' },
  { value: 'unobtainable', labelKey: 'status.unobtainable' },
];

// gap from the anchor tile and the viewport edges
const GAP = 8;

interface Props {
  onClose: () => void;
  selectedPokemon: number;
}

export function PokemonPopover ({ onClose, selectedPokemon }: Props) {
  const { activeDexView, saves } = useDexContext();
  const { captures } = useTrackerState();
  const { setCaptures, sealFx, updateCapture, deleteCaptures } = useTrackerActions();
  const { t, locale } = useTranslation();

  const capture = useMemo(() => captures.find((cap) => cap.pokemon.id === selectedPokemon), [captures, selectedPokemon]);

  const popoverRef = useRef<HTMLDivElement>(null);
  const { closing, dismiss } = useDismissable({ onDismissed: onClose, ref: popoverRef });

  // null until measured — renders hidden for one commit so it can size itself
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [above, setAbove] = useState(false);

  const missing = capture ? unansweredFields(capture) : [];

  const patch = (changes: Partial<CaptureMetadata> & { status?: CaptureStatus; sealed?: boolean }) => {
    if (!capture) {
      return;
    }
    const resolved = { ...changes, ...withFieldInvariants(capture, changes) };
    setCaptures((prev) => prev.map((cap) => (cap.pokemon.id === capture.pokemon.id ? { ...cap, ...resolved } : cap)));
    updateCapture({ pokemon: capture.pokemon.id, ...resolved });
  };

  const reposition = useCallback(() => {
    const el = popoverRef.current;
    const anchor = document.querySelector(`[data-pokemon-id='${selectedPokemon}']`);
    if (!el || !anchor) {
      // no tile to anchor to, filtered out between click and mount
      onClose();
      return;
    }

    const rect = anchor.getBoundingClientRect();
    const popW = el.offsetWidth;
    const popH = el.offsetHeight;

    // below the tile, flipping above when cramped, pinned when neither fits
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
  }, [selectedPokemon, onClose]);

  // observed rather than keyed on deps — content height changes many ways
  useLayoutEffect(() => {
    const el = popoverRef.current;
    if (!el) {
      return;
    }

    reposition();
    // repositioning only moves the element, so this can't feed back
    const observer = new ResizeObserver(reposition);
    observer.observe(el);
    return () => observer.disconnect();
  }, [reposition]);

  // fixed positioning would drift from the tile
  useEffect(() => {
    const close = (e?: Event) => {
      // the popover's own body scrolls; only page scroll should dismiss
      if (e?.target instanceof Node && popoverRef.current?.contains(e.target)) {
        return;
      }
      dismiss();
    };

    document.addEventListener('scroll', close, { capture: true, passive: true });
    // resize targets window, not a Node, so it always dismisses
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [dismiss]);

  const handleSealClick = () => {
    if (!capture) {
      return;
    }
    const name = locale === 'ja' && capture.pokemon.name_ja ? capture.pokemon.name_ja : capture.pokemon.name;
    if (window.confirm(t('seal.confirm', { name }))) {
      patch({ sealed: true });
    }
  };

  // release clears the slot and closes
  const handleRelease = () => {
    if (!capture) {
      return;
    }

    setCaptures((prev) => prev.map((cap) => {
      if (cap.pokemon.id !== capture.pokemon.id) {
        return cap;
      }
      return { ...cap, captured: false, status: null, sealed: false };
    }));

    deleteCaptures([capture.pokemon.id]);
    dismiss();
  };

  if (!capture) {
    return null;
  }

  const { pokemon } = capture;
  // display state: seal fx off (TESTING) opens the form on sealed mons for data fixing
  const sealed = capture.sealed && sealFx;
  const dexView = activeDexView!;
  const regional = dexView.dex_type.tags.includes('regional');
  const idToDisplay = regional ? (pokemon.dex_number === -1 ? '---' : pokemon.dex_number) : nationalId(pokemon.national_id);

  return (
    <>
      <div
        className={classNames('pokemon-popover', { 'popover-above': above, closing, sealed })}
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
          {!capture.captured && <p className="popover-uncaught-note">{t('info.notCaught')}</p>}

          {capture.captured && sealed &&
            <dl className="popover-record">
              <div className="popover-record-row">
                <dt>{t('info.status')}</dt>
                <dd>{t('seal.sealed')}</dd>
              </div>
              {CAPTURE_FIELDS.filter((field) => field.kind !== 'save').map((field) => (
                <div className="popover-record-row" key={field.id}>
                  <dt>{t(field.labelKey)}</dt>
                  <dd>{formatFieldValue(field, capture, locale, saves)}</dd>
                </div>
              ))}
            </dl>
          }

          {capture.captured && !sealed &&
            <>
              <div className="form-group">
                <label htmlFor="status">{t('info.status')}</label>
                <Dropdown
                  id="status"
                  onSelect={(next) => patch({ status: next as CaptureStatus })}
                  options={STATUS_OPTIONS.map((option) => ({ value: option.value, label: t(option.labelKey) }))}
                  value={capture.status || 'caught'}
                />
              </div>
              {CAPTURE_FIELDS.map((field) => (
                <CaptureFieldControl
                  field={field}
                  genderLock={capture.pokemon.gender_lock}
                  idPrefix="capture"
                  key={field.id}
                  onChange={patch}
                  value={capture}
                />
              ))}
            </>
          }

          {!sealed &&
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
          }
        </div>

        {/* keyed on the real flag: editing a sealed mon offers no Seal or Release */}
        {capture.captured && !capture.sealed &&
          <div className="popover-footer">
            {capture.status === 'caught' &&
              <button
                className="popover-seal"
                disabled={missing.length > 0}
                onClick={handleSealClick}
                title={missing.length > 0 ? t('seal.incomplete', { count: missing.length }) : undefined}
                type="button"
              >
                <FontAwesomeIcon icon={faLock} /> {t('seal.action')}
              </button>
            }
            <button className="popover-release" onClick={handleRelease} type="button">
              <FontAwesomeIcon icon={faTrash} /> {t('info.release')}
            </button>
          </div>
        }
      </div>
    </>
  );
}
