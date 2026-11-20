import classNames from 'classnames';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { createPortal } from 'react-dom';
import { faArrowLeft, faCheck, faHouse } from '@fortawesome/free-solid-svg-icons';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { GameChip, LangTag } from './review-fields';
import { ORIGIN_GAME_NAMES } from '../../../utils/capture-fields';
import { PokemonName } from '../../library/PokemonName';
import { asksLevel, dexPlacesFor, placeKey, placeLabel, placeOf, placesFor, samePlace, shownPlace } from '../../../utils/location-moves';
import { iconClass } from '../../../utils/pokemon';
import { localizeOriginGame } from '../../../i18n/names';
import { useDexContext } from '../../../hooks/contexts/use-dex-context';
import { useTrackerActions, useTrackerState } from './use-tracker';
import { useTranslation } from '../../../hooks/use-translation';

import type { CSSProperties, ReactNode } from 'react';
import type { GameSave, Place } from '../../../types';
import type { MoveTarget } from './use-tracker';

const EDGE = 8;
const GAP = 6;
const MAX_LEVEL = 100;

// HOME and Champions, drawn large; a free-form dex's checklist boxes in HOME; your games
const isBig = (place: Place) => place.location === 'champions' || (place.location === 'home' && !place.location_save);
const isBox = (place: Place) => place.location === 'home' && Boolean(place.location_save);
const isGame = (place: Place) => place.location === 'game';

// a place's picture: HOME's house, Champions' mark, a game's chip in its box art's colour
function PlacePicture ({ place, saves }: { place: Place; saves: GameSave[] }) {
  if (place.location === 'champions') {
    return <span className="move-picture"><img alt="" src="/marks/champions.png" /></span>;
  }
  if (place.location === 'home') {
    return <span className="move-picture"><FontAwesomeIcon icon={faHouse} /></span>;
  }
  return <GameChip game={saves.find((save) => save.id === place.location_save)?.game} />;
}

// where a sealed mon can be moved, a menu at its tile (S, or L, over it) or at its place under W's lens: the mon
// and where it is, then HOME and Champions large, a free-form dex's checklist boxes, and your games as W's chips (box
// art, mark, name, language), each its number; where it is ticked. Coming home from a game (asksLevel) asks the level
// it's back at first, at least the floor it kept. Q E (or the arrows) move, Space or Enter picks, 1 to 9 a game; S or L
// again, Escape, a press outside, a scroll or a resize close it
export function MoveMenu () {
  const { captures } = useTrackerState();
  const { moveTo, moveMenuHost } = useTrackerActions();
  const { saves, activeDexView, activeDex, dexes } = useDexContext();
  const { t, locale } = useTranslation();
  const [target, setTarget] = useState<MoveTarget | null>(null);
  const [active, setActive] = useState(0);
  // the level step: where the mon is coming home to, and the level typed for it
  const [coming, setComing] = useState<Place | null>(null);
  const [draft, setDraft] = useState('');
  const [style, setStyle] = useState<CSSProperties>({ visibility: 'hidden' });
  const panelRef = useRef<HTMLDivElement>(null);
  const levelRef = useRef<HTMLInputElement>(null);
  const homeDex = activeDexView?.game.id === 'home';

  useEffect(() => {
    moveMenuHost.current = (next) => {
      setTarget(next);
      setComing(null);
    };
    return () => {
      moveMenuHost.current = null;
    };
  }, [moveMenuHost]);

  const capture = target ? captures.find((cap) => cap.pokemon.id === target.pokemon) : undefined;
  const open = Boolean(target && capture?.sealed);
  const here = capture ? placeOf(capture) : null;
  // the games that can hold it (placesFor: in a HOME dex, those HOME can send it to), and the one it's in whatever it
  // is, so where it is stays ticked
  const places = useMemo(() => (open && capture
    ? placesFor(saves, capture, homeDex, dexPlacesFor(activeDex, dexes ?? []))
    : []), [open, capture, saves, homeDex, activeDex, dexes]);
  const [big, boxes, games] = useMemo(() => [places.filter(isBig), places.filter(isBox), places.filter(isGame)], [places]);
  // the order the keys walk them in, as they stand
  const order = useMemo(() => [...big, ...boxes, ...games], [big, boxes, games]);
  const floor = capture?.level ?? null;
  const typed = Number(draft);
  const levelOk = draft !== '' && Number.isInteger(typed) && typed >= (floor ?? 1) && typed <= MAX_LEVEL;

  const close = () => {
    setTarget(null);
    setComing(null);
  };

  const pick = (place: Place | undefined) => {
    if (!place || !capture) {
      return;
    }
    if (here && samePlace(place, here)) {
      close();
    } else if (asksLevel(capture, place, homeDex)) {
      setComing(place);
      setDraft(floor === null ? '' : String(floor));
    } else {
      moveTo(capture.pokemon.id, place);
      close();
    }
  };

  const bringHome = () => {
    if (capture && coming && levelOk) {
      moveTo(capture.pokemon.id, coming, typed);
      close();
    } else {
      levelRef.current?.select();
    }
  };

  // beside a tile, to its right where there's room and else to its left, its top at the tile's, so the tile stays in
  // sight; under a control (W's place chip), or over it where there's no room under: inside the window either way. At
  // the zoom of what it was opened over (the dex's tiles, W's stage), measured as drawn. Opened at where the mon is, as
  // the dropdowns open at their selection
  useLayoutEffect(() => {
    if (!open || !target) {
      return;
    }
    const { anchor, beside } = target;
    const panel = panelRef.current?.getBoundingClientRect();
    const width = panel?.width ?? 0;
    const height = panel?.height ?? 0;
    const fitTop = (top: number) => Math.max(EDGE, Math.min(top, window.innerHeight - height - EDGE));
    const toRight = anchor.right + GAP + width <= window.innerWidth - EDGE;
    const toLeft = anchor.left - GAP - width >= EDGE;
    if (beside && (toRight || toLeft)) {
      setStyle({ left: toRight ? anchor.right + GAP : anchor.left - GAP - width, top: fitTop(anchor.top) });
      return;
    }
    const left = Math.max(EDGE, Math.min(anchor.left, window.innerWidth - width - EDGE));
    const below = anchor.bottom + GAP + height <= window.innerHeight - EDGE;
    setStyle({ left, top: below ? anchor.bottom + GAP : fitTop(anchor.top - GAP - height) });
  }, [open, target, coming]);
  useLayoutEffect(() => {
    if (open && !coming) {
      setActive(Math.max(0, order.findIndex((place) => here !== null && samePlace(place, here))));
    }
  }, [open, target]);
  useLayoutEffect(() => {
    if (coming) {
      levelRef.current?.focus();
      levelRef.current?.select();
    }
  }, [coming]);

  // the keys the open menu takes are claimed, so none reaches the page's hotkeys (Space's walk, Space's pause)
  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) {
        return;
      }
      const letter = e.key.toLowerCase();
      if (coming) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setComing(null);
        } else if (e.key === 'Enter') {
          e.preventDefault();
          bringHome();
        }
        return;
      }
      if (e.key === 'Escape' || e.key === 'Tab') {
        if (e.key === 'Escape') {
          e.preventDefault();
        }
        close();
      } else if (['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'].includes(e.key) || letter === 'q' || letter === 'e') {
        // ↑ ↓ (or ← →), or Q E from the left hand
        e.preventDefault();
        const on = e.key === 'ArrowDown' || e.key === 'ArrowRight' || letter === 'e';
        setActive((index) => (index + (on ? 1 : -1) + order.length) % order.length);
      } else if (e.key === 'Home' || e.key === 'End') {
        e.preventDefault();
        setActive(e.key === 'Home' ? 0 : order.length - 1);
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        pick(order[active]);
      } else if (/^[1-9]$/.test(e.key)) {
        e.preventDefault();
        pick(games[Number(e.key) - 1]);
      } else if (letter === 's' || letter === 'l') {
        e.preventDefault();
        if (!e.repeat) {
          close();
        }
      }
    };
    const handlePointerDown = (e: PointerEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) {
        close();
      }
    };
    const handleScroll = (e: Event) => {
      if (!(e.target instanceof Node && panelRef.current?.contains(e.target))) {
        close();
      }
    };
    document.addEventListener('keydown', handleKeydown, true);
    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('scroll', handleScroll, { capture: true, passive: true });
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('keydown', handleKeydown, true);
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', close);
    };
  }, [open, order, active, target, coming, draft]);

  if (!open || !capture || !target) {
    return null;
  }

  const shown = shownPlace(capture, saves);
  // a press on one, its picture, its name, and what it holds after: where it is ticked, a game's number key, and a
  // level asked on the way home
  const option = (place: Place, body: ReactNode, after?: ReactNode) => {
    const index = order.indexOf(place);
    const current = here !== null && samePlace(place, here);
    return (
      <button
        aria-current={current || undefined}
        className={classNames('move-option', { active: index === active, current })}
        data-place={placeKey(place)}
        key={placeKey(place)}
        onClick={() => pick(place)}
        onMouseEnter={() => setActive(index)}
        type="button"
      >
        <PlacePicture place={place} saves={saves} />
        {body}
        {current ? <FontAwesomeIcon className="move-tick" icon={faCheck} /> : after}
      </button>
    );
  };
  const levelHint = (place: Place) => (asksLevel(capture, place, homeDex)
    ? <span className="move-level-hint">{floor === null ? 'Lv.?' : t('level.floor', { n: floor })}</span>
    : null);

  return createPortal(
    <div aria-label={t('move.title')} className="move-menu" role="dialog" style={style}>
      <div className="move-panel" ref={panelRef} style={{ zoom: target.zoom }}>
        <header className="move-head">
          <span className="move-mon"><i className={iconClass(capture.pokemon, activeDexView!)} /></span>
          <span className="move-head-text">
            <strong><PokemonName name={capture.pokemon.name} nameJa={capture.pokemon.name_ja} /></strong>
            <span className="move-now">{t('move.now', { place: shown ? placeLabel(shown, saves, locale) : '—' })}</span>
          </span>
        </header>
        {coming
          ? (
            <div className="move-level">
              <p className="move-level-to"><PlacePicture place={coming} saves={saves} />{placeLabel(coming, saves, locale)}</p>
              <label className="move-level-label" htmlFor="move-level">{t('move.level')}</label>
              <div className="move-level-row">
                <span className="move-level-lv">Lv.</span>
                <input
                  autoComplete="off"
                  className="form-control move-level-input"
                  id="move-level"
                  inputMode="numeric"
                  onChange={(e) => setDraft(e.target.value.normalize('NFKC').replace(/\D/g, '').slice(0, 3))}
                  ref={levelRef}
                  value={draft}
                />
                {floor !== null && <span className="move-level-min">{t('move.levelMin', { n: floor })}</span>}
              </div>
              <div className="move-level-acts">
                <button className="move-back" onClick={() => setComing(null)} type="button">
                  <FontAwesomeIcon icon={faArrowLeft} />{t('move.back')}<kbd>Esc</kbd>
                </button>
                <button className="move-confirm" disabled={!levelOk} onClick={bringHome} type="button">
                  {t('move.confirm')}<kbd>Enter</kbd>
                </button>
              </div>
            </div>
          )
          : (
            <>
              <div className="move-big">
                {big.map((place) => option(place, <span className="move-name">{t(place.location === 'champions' ? 'move.champions' : 'move.home')}</span>, levelHint(place)))}
              </div>
              {boxes.length > 0 &&
                <div className="move-group">
                  <p className="move-group-title">{t('move.boxes')}</p>
                  {boxes.map((place) => option(place, <span className="move-name">{placeLabel(place, saves, locale)}</span>, levelHint(place)))}
                </div>
              }
              <div className="move-group">
                <p className="move-group-title">{t('move.games')}</p>
                {games.length === 0 && <p className="move-none">{t('move.noGames')}</p>}
                {games.map((place, i) => {
                  const save = saves.find((entry) => entry.id === place.location_save);
                  // two files of one game in one language told apart by their ID No., as My Games tells them
                  const twin = Boolean(save?.tid) && saves.some((other) => other.id !== save!.id && other.game === save!.game && other.language === save!.language);
                  const name = save ? localizeOriginGame(locale, save.game, ORIGIN_GAME_NAMES.get(save.game) ?? save.game) : placeLabel(place, saves, locale);
                  return option(
                    place,
                    <>
                      <span className="move-name">{name}{twin && <span className="move-id">ID {save!.tid}</span>}</span>
                      <LangTag language={save?.language} />
                    </>,
                    i < 9 ? <kbd className="move-key">{i + 1}</kbd> : <span className="move-key" />,
                  );
                })}
              </div>
            </>
          )}
      </div>
    </div>,
    document.body,
  );
}
