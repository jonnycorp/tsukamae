import classNames from 'classnames';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleExclamation, faLock, faLongArrowAltRight, faTrash, faXmark } from '@fortawesome/free-solid-svg-icons';
import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';

import { CAPTURE_FIELDS, formatFieldValue, statusOptions, unansweredFields } from '../../../utils/capture-fields';
import { CaptureFieldControl } from '../../library/CaptureFieldControl';
import { Dropdown } from '../../library/Dropdown';
import { PokemonName, displayName } from '../../library/PokemonName';
import { dexNumber, iconClass } from '../../../utils/pokemon';
import { destinations, placeFromKey, placeKey, placeLabel, placeOf } from '../../../utils/location-moves';
import { serebiiLink } from '../../../utils/formatting';
import { useDexContext } from '../../../hooks/contexts/use-dex-context';
import { useDismissable } from '../../../hooks/use-dismissable';
import { usePatchRecords } from './use-patch';
import { useTrackerActions, useTrackerState } from './use-tracker';
import { useTranslation } from '../../../hooks/use-translation';

import type { CaptureStatus } from '../../../types';
import type { RecordPatch } from './use-patch';

// a family missing here (a dataset newer than this list) falls back to the newest dex, home's
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

const GAP = 8;
const DOCK_GAP = 12;
const MIN_DOCK_WIDTH = 250;

const SPLIT = CAPTURE_FIELDS.findIndex((field) => field.id === 'ball');
const FORM_COLUMNS = [CAPTURE_FIELDS.slice(0, SPLIT), CAPTURE_FIELDS.slice(SPLIT)];
const RECORD_COLUMNS = FORM_COLUMNS.map((fields) => fields.filter((field) => field.kind !== 'save'));

interface Props {
  onClose: () => void;
  // the dex's zoom; the popover sits outside it, so it re-docks when this moves the tiles
  scale: number;
  selectedPokemon: number;
}

export function PokemonPopover ({ onClose, scale, selectedPokemon }: Props) {
  const { activeDexView, saves } = useDexContext();
  const { captures } = useTrackerState();
  const { releaseCaptures, moveTo } = useTrackerActions();
  const patchRecords = usePatchRecords();
  const { t, locale } = useTranslation();

  const capture = useMemo(() => captures.find((cap) => cap.pokemon.id === selectedPokemon), [captures, selectedPokemon]);

  const popoverRef = useRef<HTMLDivElement>(null);
  // a tile's or a ledger row's click retargets the popover rather than closing it
  const { closing, dismiss, revive } = useDismissable({ onDismissed: onClose, ref: popoverRef, keepOpenOn: '.pokemon:not(.empty), .ledger-row' });

  useEffect(() => revive(), [selectedPokemon, revive]);

  const missing = capture ? unansweredFields(capture, capture.pokemon.gender_lock) : [];

  // the edit as storage will keep it, mirrored here (use-patch: shared with the ledger's batch edits)
  const patch = (changes: RecordPatch) => {
    if (capture) {
      patchRecords([capture], changes);
    }
  };

  // beside the tile's box, or where there's no room for that, clear of the tile's row
  const place = useCallback((refit: boolean) => {
    const el = popoverRef.current;
    if (!el) {
      return;
    }
    const anchor = document.querySelector(`[data-pokemon-id='${selectedPokemon}']`);
    if (!anchor) {
      // no tile to anchor to, filtered out between click and mount
      onClose();
      return;
    }
    // set outside react: selecting re-renders no tile, and a tile's own re-render leaves it alone
    if (!anchor.hasAttribute('data-selected')) {
      anchor.setAttribute('data-selected', '');
    }

    // a box, or a box-sized chunk of results: a whole results list can run for screens, and docking to it pinned the
    // popover to the top and never let it go. A ledger row spans the table, so it names the part to dock beside (its
    // name and status), and the popover covers the columns after them rather than the row
    const frame = (anchor.closest('.box-container, .results-chunk') ?? anchor.querySelector('[data-dock]') ?? anchor).getBoundingClientRect();
    const viewTop = anchor.closest('.dex-column')?.getBoundingClientRect().top ?? 0;
    if (frame.bottom < viewTop || frame.top > window.innerHeight) {
      dismiss();
      return;
    }

    const roomRight = window.innerWidth - GAP - DOCK_GAP - frame.right;
    const roomLeft = frame.left - DOCK_GAP - GAP;
    const room = Math.max(roomLeft, roomRight);
    if (refit) {
      el.style.width = '';
      if (el.offsetWidth > room && room >= MIN_DOCK_WIDTH) {
        el.style.width = `${room}px`;
      }
    }

    const width = el.offsetWidth;
    const height = el.offsetHeight;
    const minTop = Math.max(GAP, Math.min(viewTop, window.innerHeight - GAP - height));
    const clampTop = (top: number) => Math.max(minTop, Math.min(top, window.innerHeight - GAP - height));

    if (width <= room) {
      el.style.left = `${roomRight >= roomLeft ? frame.right + DOCK_GAP : frame.left - DOCK_GAP - width}px`;
      el.style.top = `${clampTop(frame.top)}px`;
      return;
    }
    const row = anchor.getBoundingClientRect();
    const below = window.innerHeight - GAP - row.bottom - GAP;
    const above = row.top - GAP - viewTop;
    el.style.left = `${Math.max(GAP, Math.min(row.left + row.width / 2 - width / 2, window.innerWidth - GAP - width))}px`;
    el.style.top = `${clampTop(below >= height || below >= above ? row.bottom + GAP : row.top - GAP - height)}px`;
  }, [selectedPokemon, onClose, dismiss]);

  useLayoutEffect(() => () => {
    document.querySelector('[data-pokemon-id][data-selected]')?.removeAttribute('data-selected');
  }, [selectedPokemon]);

  // its own size changing (a field opening up, a longer value) refits it the frame after: its width is set in place(),
  // and set inside its own observer's callback, that changes what the observer watches, which the browser reports as a
  // "ResizeObserver loop" error. One observer for as long as it's open, as each new one reports at once
  useLayoutEffect(() => {
    const el = popoverRef.current;
    if (!el) {
      return;
    }

    place(true);
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => place(true));
    });
    observer.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [place]);

  // a zoom, or the dex rescaling to a resized window, moves its tile: placed beside it at once, so no frame shows it off
  // the tile, and refitted the frame after, as a resize renders this inside the dex's own observer callback (useDexScale)
  useLayoutEffect(() => {
    place(false);
    const frame = requestAnimationFrame(() => place(true));
    return () => cancelAnimationFrame(frame);
  }, [place, scale]);

  useEffect(() => {
    let frame = 0;
    const follow = (e: Event) => {
      if (e.target instanceof Node && popoverRef.current?.contains(e.target)) {
        return;
      }
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => place(false));
    };
    const refit = () => place(true);

    // the dex reflowing under it without a scroll (a search typed, a filter, a tile leaving its view) moves the tile too
    const dex = document.querySelector('.dex');
    const reflow = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => place(false));
    });
    if (dex) {
      reflow.observe(dex);
    }

    document.addEventListener('scroll', follow, { capture: true, passive: true });
    window.addEventListener('resize', refit);
    return () => {
      cancelAnimationFrame(frame);
      reflow.disconnect();
      document.removeEventListener('scroll', follow, true);
      window.removeEventListener('resize', refit);
    };
  }, [place]);

  const handleSealClick = () => {
    if (!capture) {
      return;
    }
    const name = displayName(capture.pokemon.name, capture.pokemon.name_ja, locale);
    if (window.confirm(t('seal.confirm', { name }))) {
      patch({ sealed: true });
    }
  };

  const handleRelease = () => {
    if (!capture) {
      return;
    }

    // closed at once, as D does: a fade would show the card collapse to 'not marked' and jump as it went
    releaseCaptures([capture.pokemon.id]);
    onClose();
  };

  if (!capture) {
    return null;
  }

  const { pokemon } = capture;
  const { sealed } = capture;
  const dexView = activeDexView!;
  const fields = capture.status !== 'unobtainable';
  const stale = new Set(sealed ? missing.map((field) => field.id) : []);
  // where a sealed mon is, and where it can be moved
  const here = placeOf(capture);
  const moveOptions = destinations(saves, activeDexView!.game.id === 'home').map((place) => ({ value: placeKey(place), label: placeLabel(place, saves, locale) }));

  return (
    <div
      className={classNames('pokemon-popover', { closing, wide: capture.captured && (sealed || fields) })}
      ref={popoverRef}
    >
      <Fragment key={pokemon.id}>
        <div className="popover-header">
          <i className={iconClass(pokemon, dexView)} />
          <div className="popover-title">
            <h1 data-copy-name={displayName(pokemon.name, pokemon.name_ja, locale)}><PokemonName name={pokemon.name} nameJa={pokemon.name_ja} /></h1>
            <p className="popover-meta">
              #{dexNumber(pokemon, dexView)}
              {!sealed &&
                <>
                  <a
                    href={`http://bulbapedia.bulbagarden.net/wiki/${encodeURI(pokemon.name)}_(Pok%C3%A9mon)`}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    Bulbapedia <FontAwesomeIcon icon={faLongArrowAltRight} />
                  </a>
                  <a
                    href={serebiiLink(SEREBII_LINKS[dexView.game.game_family.id] ?? SEREBII_LINKS.home, pokemon.national_id)}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    Serebii <FontAwesomeIcon icon={faLongArrowAltRight} />
                  </a>
                </>
              }
            </p>
          </div>
          <button aria-label={t('popover.close')} className="popover-close" onClick={dismiss} title={t('popover.close')} type="button">
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>

        <div className="popover-body">
          {!capture.captured && <p className="popover-uncaught-note">{t('info.notCaught')}</p>}

          {capture.captured && sealed &&
            <div className="popover-columns">
              {RECORD_COLUMNS.map((column, index) => (
                <dl className="popover-column popover-record" key={index}>
                  {index === 0 &&
                    <div className="popover-record-row">
                      <dt>{t('info.status')}</dt>
                      <dd>{t('seal.sealed')}</dd>
                    </div>
                  }
                  {column.map((field) => (
                    <div className={classNames('popover-record-row', { stale: stale.has(field.id) })} key={field.id}>
                      <dt>{t(field.labelKey)}</dt>
                      <dd>
                        {stale.has(field.id) && <FontAwesomeIcon icon={faCircleExclamation} />}
                        {/* the one thing a sealed record still changes: where the mon is (utils/location-moves) */}
                        {field.id === 'location'
                          ? <Dropdown
                            align="end"
                            blankLabel={here ? undefined : formatFieldValue(field, capture, locale, saves)}
                            id="popover_move"
                            onSelect={(key) => {
                              if (key) {
                                moveTo(pokemon.id, placeFromKey(key));
                              }
                            }}
                            options={moveOptions}
                            triggerClassName="popover-move"
                            value={here ? placeKey(here) : ''}
                          />
                          : formatFieldValue(field, capture, locale, saves)
                        }
                      </dd>
                    </div>
                  ))}
                </dl>
              ))}
            </div>
          }

          {capture.captured && !sealed &&
            <div className="popover-columns">
              {(fields ? FORM_COLUMNS : FORM_COLUMNS.slice(0, 1)).map((column, index) => (
                <div className="popover-column" key={index}>
                  {index === 0 &&
                    <div className="form-group">
                      <label htmlFor="status">{t('info.status')}</label>
                      <Dropdown
                        id="status"
                        onSelect={(next) => patch({ status: next as CaptureStatus })}
                        options={statusOptions(locale)}
                        value={capture.status || 'caught'}
                      />
                    </div>
                  }
                  {fields && column.map((field) => (
                    <CaptureFieldControl
                      field={field}
                      genderLock={pokemon.gender_lock}
                      idPrefix="capture"
                      key={field.id}
                      onChange={patch}
                      value={capture}
                    />
                  ))}
                </div>
              ))}
            </div>
          }
        </div>

        {capture.captured && !sealed &&
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
      </Fragment>
    </div>
  );
}
