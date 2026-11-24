import classNames from 'classnames';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { createPortal } from 'react-dom';
import { faArrowLeft, faCheck, faHouse, faLock } from '@fortawesome/free-solid-svg-icons';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { GameChip, LangTag } from './review-fields';
import { ORIGIN_GAME_NAMES } from '../../../utils/capture-fields';
import { PokemonName } from '../../library/PokemonName';
import { asksLevel, asksSoup, dexPlacesFor, placeKey, placeLabel, placeOf, placesFor, samePlace, shownPlace } from '../../../utils/location-moves';
import { monIcon } from '../../../utils/pokemon';
import { localizeOriginGame } from '../../../i18n/names';
import { offersChampions } from '../../../utils/champions';
import { useDexContext } from '../../../hooks/contexts/use-dex-context';
import { useTrackerActions, useTrackerState } from './use-tracker';
import { useTranslation } from '../../../hooks/use-translation';

import type { CSSProperties, ReactNode } from 'react';
import type { GameSave, Place } from '../../../types';
import type { MoveTarget } from './use-tracker';

const EDGE = 8;
const GAP = 6;
const MAX_LEVEL = 100;
const CHAMPIONS: Place = { location: 'champions', location_save: null };
// what would scroll the page under a step with nothing to type into, which closes the menu
const SCROLL_KEYS = new Set(['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'PageDown', 'PageUp', 'Home', 'End']);

// HOME, drawn large; a free-form dex's checklist boxes in HOME; your games
const isBig = (place: Place) => place.location === 'home' && !place.location_save;
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

// where a sealed mon can be checked out to, a menu at its tile (S, or L, over it) or at its place under W's lens: the
// mon and where it is, then HOME large, a free-form dex's checklist boxes, and your games as W's chips (box art, mark,
// name, language), each its number; where it is ticked. Champions is past them, an operation of its own (C) offered in
// HOME, as it's for good (been to Champions) and locks the mon in HOME till it's back out, offered nothing but HOME. A
// pick that asks something first opens a step: coming home from a game, the level it's back at, at least the floor it
// kept; leaving Sword or Shield, the Gigantamax factor (G), which Max Soup may have changed; into Champions, a yes. Q E
// (or the arrows) move, Space or Enter picks, 1 to 9 a game; S or L again, Escape, a press outside, a scroll or a
// resize close it
export function MoveMenu () {
  const { captures } = useTrackerState();
  const { moveTo, moveMenuHost } = useTrackerActions();
  const { saves, activeDexView, activeDex, dexes } = useDexContext();
  const { t, locale } = useTranslation();
  const [target, setTarget] = useState<MoveTarget | null>(null);
  const [active, setActive] = useState(0);
  // the step a pick opened: where the mon is going, the level typed for it and the factor said for it
  const [step, setStep] = useState<Place | null>(null);
  const [draft, setDraft] = useState('');
  const [factor, setFactor] = useState(false);
  const [style, setStyle] = useState<CSSProperties>({ visibility: 'hidden' });
  const panelRef = useRef<HTMLDivElement>(null);
  const levelRef = useRef<HTMLInputElement>(null);
  const homeDex = activeDexView?.game.id === 'home';

  useEffect(() => {
    moveMenuHost.current = (next) => {
      setTarget(next);
      setStep(null);
    };
    return () => {
      moveMenuHost.current = null;
    };
  }, [moveMenuHost]);

  const capture = target ? captures.find((cap) => cap.pokemon.id === target.pokemon) : undefined;
  const open = Boolean(target && capture?.sealed);
  const here = capture ? placeOf(capture) : null;
  // the games it can go to from where it is (placesFor), and the one it's in whatever it is, so where it is stays ticked
  const places = useMemo(() => (open && capture
    ? placesFor(saves, capture, dexPlacesFor(activeDex, dexes ?? []))
    : []), [open, capture, saves, activeDex, dexes]);
  const [big, boxes, games] = useMemo(() => [places.filter(isBig), places.filter(isBox), places.filter(isGame)], [places]);
  const champions = open && capture ? offersChampions(capture, homeDex) : false;
  // the order the keys walk them in, as they stand
  const order = useMemo(() => [...big, ...boxes, ...games, ...(champions ? [CHAMPIONS] : [])], [big, boxes, games, champions]);
  const floor = capture?.level ?? null;
  const typed = Number(draft);
  const levelOk = draft !== '' && Number.isInteger(typed) && typed >= (floor ?? 1) && typed <= MAX_LEVEL;
  // what the step asks: the level coming home, the factor leaving Sword or Shield (wherever it's going)
  const level = Boolean(step && capture && asksLevel(capture, step, homeDex));
  const soup = Boolean(capture && asksSoup(capture, saves));
  const ready = !level || levelOk;

  const close = () => {
    setTarget(null);
    setStep(null);
  };

  const pick = (place: Place | undefined) => {
    if (!place || !capture) {
      return;
    }
    if (here && samePlace(place, here)) {
      close();
    } else if (place.location === 'champions' || soup || asksLevel(capture, place, homeDex)) {
      setStep(place);
      setDraft(floor === null ? '' : String(floor));
      setFactor(capture.gigantamax === true);
    } else {
      moveTo(capture.pokemon.id, place);
      close();
    }
  };

  const confirm = () => {
    if (capture && step && ready) {
      moveTo(capture.pokemon.id, step, { level: level ? typed : undefined, gigantamax: soup ? factor : undefined });
      close();
    } else if (level && !levelOk) {
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
  }, [open, target, step]);
  useLayoutEffect(() => {
    if (open && !step) {
      setActive(Math.max(0, order.findIndex((place) => here !== null && samePlace(place, here))));
    }
  }, [open, target]);
  useLayoutEffect(() => {
    if (level) {
      levelRef.current?.focus();
      levelRef.current?.select();
    }
  }, [step]);

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
      if (step) {
        const typing = e.target === levelRef.current;
        if (e.key === 'Escape') {
          e.preventDefault();
          setStep(null);
        } else if (e.key === 'Enter') {
          e.preventDefault();
          confirm();
        } else if (letter === 'g' && soup) {
          e.preventDefault();
          if (!e.repeat) {
            setFactor((on) => !on);
          }
        } else if ((e.key === ' ' && !(e.target instanceof HTMLButtonElement)) || (!typing && SCROLL_KEYS.has(e.key))) {
          e.preventDefault();
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
      } else if (letter === 'c' && champions) {
        e.preventDefault();
        pick(CHAMPIONS);
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
  }, [open, order, active, target, step, draft, factor]);

  if (!open || !capture || !target) {
    return null;
  }

  const shown = shownPlace(capture, saves);
  const gameName = (save: GameSave) => localizeOriginGame(locale, save.game, ORIGIN_GAME_NAMES.get(save.game) ?? save.game);
  // a press on one, its picture, its name, and what it holds after: where it is ticked, a game's number key, Champions'
  // C, and a level asked on the way home
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
          <span className="move-mon"><i className={monIcon(capture, activeDexView!)} /></span>
          <span className="move-head-text">
            <strong><PokemonName name={capture.pokemon.name} nameJa={capture.pokemon.name_ja} /></strong>
            <span className="move-now">{t('move.now', { place: shown ? placeLabel(shown, saves, locale) : '—' })}</span>
          </span>
        </header>
        {step
          ? (
            <div className="move-step">
              <p className="move-step-to"><PlacePicture place={step} saves={saves} />{placeLabel(step, saves, locale)}</p>
              {level &&
                <div className="move-step-part">
                  <label className="move-step-label" htmlFor="move-level">{t('move.level')}</label>
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
                </div>
              }
              {soup &&
                <div className="move-step-part">
                  <span className="move-step-label">
                    {t('move.factor')}<span className="move-step-note">{t('move.soup')}</span><kbd className="move-key">G</kbd>
                  </span>
                  <div aria-label={t('move.factor')} className="move-factor" role="radiogroup">
                    {[false, true].map((on) => (
                      <button
                        aria-checked={factor === on}
                        className={classNames('move-factor-option', { picked: factor === on })}
                        key={String(on)}
                        onClick={() => setFactor(on)}
                        role="radio"
                        type="button"
                      >
                        <img alt="" className={classNames('move-factor-mark', { off: !on })} src="/marks/gigantamax.png" />
                        {t(on ? 'common.yes' : 'common.no')}
                      </button>
                    ))}
                  </div>
                </div>
              }
              {step.location === 'champions' &&
                <ul className="move-terms">
                  {capture.been_to_champions !== true &&
                    <li><img alt="" className="move-terms-mark" src="/marks/champions.png" />{t('move.championsBeen')}</li>
                  }
                  <li><FontAwesomeIcon className="move-terms-mark" icon={faLock} />{t('move.championsLock')}</li>
                </ul>
              }
              <div className="move-step-acts">
                <button className="move-back" onClick={() => setStep(null)} type="button">
                  <FontAwesomeIcon icon={faArrowLeft} />{t('move.back')}<kbd>Esc</kbd>
                </button>
                <button className="move-confirm" disabled={!ready} onClick={confirm} type="button">
                  {t(step.location === 'champions' ? 'move.send' : 'move.confirm')}<kbd>Enter</kbd>
                </button>
              </div>
            </div>
          )
          : (
            <>
              <div className="move-big">
                {big.map((place) => option(place, <span className="move-name">{t('move.home')}</span>, levelHint(place)))}
              </div>
              {boxes.length > 0 &&
                <div className="move-group">
                  <p className="move-group-title">{t('move.boxes')}</p>
                  {boxes.map((place) => option(place, <span className="move-name">{placeLabel(place, saves, locale)}</span>, levelHint(place)))}
                </div>
              }
              {capture.location === 'champions'
                ? <p className="move-locked"><FontAwesomeIcon icon={faLock} />{t('move.locked')}</p>
                : (
                  <div className="move-group">
                    <p className="move-group-title">{t('move.games')}</p>
                    {games.length === 0 && <p className="move-none">{t('move.noGames')}</p>}
                    {games.map((place, i) => {
                      const save = saves.find((entry) => entry.id === place.location_save);
                      // two files of one game in one language told apart by their ID No., as My Games tells them
                      const twin = Boolean(save?.tid) && saves.some((other) => other.id !== save!.id && other.game === save!.game && other.language === save!.language);
                      return option(
                        place,
                        <>
                          <span className="move-name">{save ? gameName(save) : placeLabel(place, saves, locale)}{twin && <span className="move-id">ID {save!.tid}</span>}</span>
                          <LangTag language={save?.language} />
                        </>,
                        i < 9 ? <kbd className="move-key">{i + 1}</kbd> : <span className="move-key" />,
                      );
                    })}
                  </div>
                )}
              {champions &&
                <div className="move-op">
                  {option(CHAMPIONS, <span className="move-name">{t('move.intoChampions')}</span>, <kbd className="move-key">C</kbd>)}
                </div>
              }
            </>
          )}
      </div>
    </div>,
    document.body,
  );
}
