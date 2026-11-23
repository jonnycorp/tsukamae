import classNames from 'classnames';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleExclamation, faXmark } from '@fortawesome/free-solid-svg-icons';
import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';

import { CAPTURE_FIELDS, formatFieldValue, unansweredFields } from '../../../utils/capture-fields';
import { PokemonName, displayName } from '../../library/PokemonName';
import { dexNumber, monIcon } from '../../../utils/pokemon';
import { lookOf } from '../../../utils/looks';
import { asksField } from '../../../utils/review-confirm';
import { inTraining } from '../../../utils/location-moves';
import { levelText } from './review-fields';
import { useDexContext } from '../../../hooks/contexts/use-dex-context';
import { useDismissable } from '../../../hooks/use-dismissable';
import { useTrackerState } from './use-tracker';
import { useTranslation } from '../../../hooks/use-translation';

const GAP = 8;
const DOCK_GAP = 12;
const MIN_DOCK_WIDTH = 250;

const SPLIT = CAPTURE_FIELDS.findIndex((field) => field.id === 'ball');
const RECORD_COLUMNS = [CAPTURE_FIELDS.slice(0, SPLIT), CAPTURE_FIELDS.slice(SPLIT)].map((fields) => fields.filter((field) => field.kind !== 'save'));

interface Props {
  onClose: () => void;
  // the dex's zoom; the popover sits outside it, so it re-docks when this moves the tiles
  scale: number;
  selectedPokemon: number;
}

// a sealed mon's card, read only: its record as it stands, where it is among it (moved by S or L over the
// tile). An open record has none: a press opens it in the review (W), where it's filled in
export function PokemonPopover ({ onClose, scale, selectedPokemon }: Props) {
  const { activeDexView, saves } = useDexContext();
  const { captures } = useTrackerState();
  const { t, locale } = useTranslation();

  const capture = useMemo(() => captures.find((cap) => cap.pokemon.id === selectedPokemon), [captures, selectedPokemon]);

  const popoverRef = useRef<HTMLDivElement>(null);
  // a tile's or a ledger row's click retargets the popover rather than closing it, and a pick in the move menu (S, L,
  // portalled) moves the mon it shows
  const { closing, dismiss, revive } = useDismissable({ onDismissed: onClose, ref: popoverRef, keepOpenOn: '.pokemon:not(.empty), .ledger-row, .move-menu' });

  useEffect(() => revive(), [selectedPokemon, revive]);

  const missing = capture ? unansweredFields(capture, capture.pokemon.gender_lock) : [];
  // one unsealed while it's up (a hold on its tile) has no card
  const sealed = Boolean(capture?.sealed);
  useEffect(() => {
    if (!sealed) {
      onClose();
    }
  }, [sealed, onClose]);

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

  // a record changed anywhere can move its tile: a free-form dex's mon dragged to another slot or box (FreeBoxes) is
  // drawn there anew, and a mon before it released or moved out of a filtered view closes the tiles up, maybe into the
  // results chunk before, where it's drawn anew too: beside it where it's come to, its ring put back
  useLayoutEffect(() => {
    place(false);
  }, [place, captures]);

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

  if (!capture || !sealed) {
    return null;
  }

  const { pokemon } = capture;
  const dexView = activeDexView!;
  const stale = new Set(missing.map((field) => field.id));
  // a mon out in a game still going up: 育成中, at least the level it left at
  const training = inTraining(capture, dexView.game.id === 'home');
  // the form it's shown as, named beside its number
  const look = lookOf(capture, dexView);

  return (
    <div
      className={classNames('pokemon-popover', 'wide', { closing })}
      ref={popoverRef}
    >
      <Fragment key={pokemon.id}>
        <div className="popover-header">
          <i className={monIcon(capture, dexView)} />
          <div className="popover-title">
            <h1 data-copy-name={displayName(pokemon.name, pokemon.name_ja, locale)}><PokemonName name={pokemon.name} nameJa={pokemon.name_ja} /></h1>
            <p className="popover-meta">
              #{dexNumber(pokemon, dexView)}
              {look && <span>{look[locale]}</span>}
            </p>
          </div>
          <button aria-label={t('popover.close')} className="popover-close" onClick={dismiss} title={t('popover.close')} type="button">
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>

        <div className="popover-body">
          <div className="popover-columns">
            {RECORD_COLUMNS.map((column, index) => (
              <dl className="popover-column popover-record" key={index}>
                {index === 0 &&
                  <div className="popover-record-row">
                    <dt>{t('info.status')}</dt>
                    <dd>{t('seal.sealed')}</dd>
                  </div>
                }
                {column.filter((field) => asksField(capture, field, dexView)).map((field) => (
                  <div className={classNames('popover-record-row', { stale: stale.has(field.id) })} key={field.id}>
                    <dt>{t(field.labelKey)}</dt>
                    <dd>
                      {stale.has(field.id) && <FontAwesomeIcon icon={faCircleExclamation} />}
                      {field.id === 'level' && training ? levelText(capture.level, t) : formatFieldValue(field, capture, locale, saves)}
                    </dd>
                  </div>
                ))}
              </dl>
            ))}
          </div>
        </div>
      </Fragment>
    </div>
  );
}
