import classNames from 'classnames';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { createPortal } from 'react-dom';
import { faArrowLeft, faArrowRight, faBan, faCheck, faCircleExclamation, faClock, faList, faLock, faLockOpen, faTrash, faXmark } from '@fortawesome/free-solid-svg-icons';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { CAPTURE_FIELDS, formatFieldValue, unansweredFields } from '../../../utils/capture-fields';
import { CaptureFieldControl } from '../../library/CaptureFieldControl';
import { Dropdown } from '../../library/Dropdown';
import { PokemonName, displayName } from '../../library/PokemonName';
import { TitleCard, useTitleCard } from './TitleCard';
import { UNSEAL_HOLD } from './Pokemon';
import { destinations, locationTint, placeFromKey, placeKey, placeLabel, placeOf } from '../../../utils/location-moves';
import { dexNumber, iconClass } from '../../../utils/pokemon';
import { stateOf } from './ledger-model';
import { useDexContext } from '../../../hooks/contexts/use-dex-context';
import { useInertPage } from '../../../hooks/use-inert-page';
import { useLocalStorage } from '../../../hooks/use-local-storage';
import { useLongPress } from '../../../hooks/use-long-press';
import { useMark } from './use-mark';
import { useMediaQuery, useTrackerActions, useTrackerState } from './use-tracker';
import { usePatchRecords } from './use-patch';
import { useSceneScale } from './use-scene-scale';
import { useTranslation } from '../../../hooks/use-translation';

import type { CSSProperties } from 'react';
import type { Capture, CaptureStatus, Dex } from '../../../types';
import type { CaptureField } from '../../../utils/capture-fields';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import type { RecordPatch } from './use-patch';

// the plates either side of the mon: where it came from and where it is, then what it is
const SPLIT = CAPTURE_FIELDS.findIndex((field) => field.id === 'ball');
const SIDES = [CAPTURE_FIELDS.slice(0, SPLIT), CAPTURE_FIELDS.slice(SPLIT)];
// what sealing waits on, a pip each under the mon
const GATES = CAPTURE_FIELDS.filter((field) => field.gatesSeal);
// a field answered from a menu goes on to the next still to fill; one typed into goes on with Enter
const MENU_KINDS = new Set(['select', 'yesno', 'save', 'location']);
const UNDO_MS = 6000;
const LIST_STORAGE_KEY = 'reviewList';
// too narrow for the list beside the mon: it lies over it instead, and only while it's wanted
const NARROW_QUERY = '(width < 1000px)';

const MARKS: { status: CaptureStatus; icon: IconDefinition; key: string }[] = [
  { status: 'caught', icon: faCheck, key: '1' },
  { status: 'temporary', icon: faClock, key: '2' },
  { status: 'unobtainable', icon: faBan, key: '3' },
];

// a marked record's fields still to answer, counted once for each version of it, as the list counts every mon's
const toFillCache = new WeakMap<Capture, number>();
function toFill (capture: Capture): number {
  let n = toFillCache.get(capture);
  if (n === undefined) {
    n = capture.captured && capture.status !== 'unobtainable' && !capture.sealed ? unansweredFields(capture, capture.pokemon.gender_lock).length : 0;
    toFillCache.set(capture, n);
  }
  return n;
}

// the control a field still waits on, if it waits: a game's own pick under In a game, the name under a ticked
// nickname box (the box itself on a record from before it had one); My Game while the game or language it fills in
// is still to answer
function waitingControl (capture: Capture, field: CaptureField, missing: Set<string>, hasSaves: boolean): string | null {
  if (field.id === 'save') {
    return hasSaves && (missing.has('origin_game') || missing.has('language')) ? 'review-save' : null;
  }
  if (!missing.has(field.id)) {
    return null;
  }
  if (field.id === 'location' && capture.location === 'game') {
    return 'review-location-game';
  }
  if (field.id === 'nickname') {
    return capture.has_nickname === true ? 'review-nickname-text' : 'review-nickname';
  }
  return `review-${field.id}`;
}

// where the next answer goes, after one given at `from` in the field `after` (or from the top): that field again if
// it still waits on another of its controls, else the first after it, in the plates' order, that sealing waits on
function nextToFill (capture: Capture, after: string | null, from: string | null, hasSaves: boolean): string | null {
  const missing = new Set(unansweredFields(capture, capture.pokemon.gender_lock).map((field) => field.id));
  const start = after === null ? 0 : CAPTURE_FIELDS.findIndex((field) => field.id === after);
  if (after !== null) {
    const own = waitingControl(capture, CAPTURE_FIELDS[start], missing, hasSaves);
    if (own && own !== from) {
      return own;
    }
  }
  for (const field of CAPTURE_FIELDS.slice(after === null ? 0 : start + 1)) {
    const control = waitingControl(capture, field, missing, hasSaves);
    if (control) {
      return control;
    }
  }
  return null;
}

interface RowProps {
  capture: Capture;
  index: number;
  current: boolean;
  dex: Dex;
  onPick: (index: number) => void;
}

// a mon in the run's list: its sprite, number and name, and how far its record has got (sealed, ready, how many left
// to fill), going to it when pressed. Kept as it was unless its record changes
const RunRow = memo(function RunRow ({ capture, index, current, dex, onPick }: RowProps) {
  const state = stateOf(capture, false);
  const left = toFill(capture);
  let mark;
  if (state === 'sealed') {
    mark = <FontAwesomeIcon icon={faLock} />;
  } else if (state === 'unmarked') {
    mark = <span className="review-run-hollow" />;
  } else if (state === 'unobtainable') {
    mark = <FontAwesomeIcon icon={faBan} />;
  } else if (left > 0) {
    mark = <span className="review-run-left">{left}</span>;
  } else {
    mark = <FontAwesomeIcon icon={state === 'temporary' ? faClock : faCheck} />;
  }
  return (
    <li>
      <button
        aria-current={current || undefined}
        className={classNames('review-run-row', `state-${state}`, { current, ready: state === 'caught' && left === 0 })}
        onClick={() => onPick(index)}
        type="button"
      >
        <span className="review-run-mon"><i className={iconClass(capture.pokemon, dex)} /></span>
        <span className="review-run-number">#{dexNumber(capture.pokemon, dex)}</span>
        <span className="review-run-name"><PokemonName name={capture.pokemon.name} nameJa={capture.pokemon.name_ja} /></span>
        <span className="review-run-mark">{mark}</span>
      </button>
    </li>
  );
});

// a sealed record's way back to editing: held, as a sealed tile is, filling as it's held; by a held Enter or Space
// as well as a press
function UnsealHold ({ onUnseal }: { onUnseal: () => void }) {
  const { t } = useTranslation();
  const { wheel, handlers } = useLongPress({ ...UNSEAL_HOLD, onComplete: onUnseal, onRelease: () => {} });
  const [keyHeld, setKeyHeld] = useState(false);
  const keyTimers = useRef<number[]>([]);
  const letGo = () => {
    keyTimers.current.forEach((timer) => window.clearTimeout(timer));
    keyTimers.current = [];
    setKeyHeld(false);
  };
  useEffect(() => () => keyTimers.current.forEach((timer) => window.clearTimeout(timer)), []);
  return (
    <button
      className={classNames('review-unseal', { holding: wheel !== null || keyHeld })}
      onBlur={letGo}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !e.ctrlKey && !e.metaKey) {
          // claimed, so the review doesn't take this Enter as going on to the next field
          e.preventDefault();
          if (!e.repeat && keyTimers.current.length === 0) {
            keyTimers.current = [
              window.setTimeout(() => setKeyHeld(true), UNSEAL_HOLD.delay),
              window.setTimeout(() => {
                letGo();
                onUnseal();
              }, UNSEAL_HOLD.delay + UNSEAL_HOLD.duration),
            ];
          }
        }
      }}
      onKeyUp={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          letGo();
        }
      }}
      style={{ '--hold': `${UNSEAL_HOLD.duration}ms` } as CSSProperties}
      type="button"
      {...handlers}
    >
      <FontAwesomeIcon icon={faLockOpen} />{t('review.unseal')}
    </button>
  );
}

interface Props {
  // the mons to go through, as the dex showed them when it opened; kept, so one sealed out of the view stays in the run
  queue: number[];
  start: number;
  // closing: back to the dex, at the mon it ended on (none, from an empty run)
  onClose: (pokemon: number | null) => void;
}

// the dex's record keeping, one mon at a time over the window (W): the mon in the middle in its viewfinder, every
// field of its record on a plate either side wired to it, a pip under it for each one sealing waits on, and the run
// listed beside them to jump about in. Made to be filled in steadily from the keyboard: 1 2 3 mark, Enter goes from
// field to field still to fill (a menu opening as it's reached), Ctrl+Enter stamps the seal, the mon staying up to be
// looked over, and again goes on to the next
export function Review ({ queue, start, onClose }: Props) {
  const { captures } = useTrackerState();
  const { activeDex, activeDexView, saves } = useDexContext();
  const { moveTo, releaseCaptures } = useTrackerActions();
  const { t, locale } = useTranslation();
  const mark = useMark();
  const patchRecords = usePatchRecords();
  const scale = useSceneScale();
  const narrow = useMediaQuery(NARROW_QUERY);
  const [listShown, setListShown] = useLocalStorage(LIST_STORAGE_KEY, true);
  // over the mon in a narrow window: closed as the review opens, and again as a mon's picked from it
  const [narrowList, setNarrowList] = useState(false);
  const list = narrow ? narrowList : listShown;
  const [index, setIndex] = useState(Math.max(0, Math.min(queue.length - 1, start)));
  const indexRef = useRef(index);
  indexRef.current = index;
  // which way the last move went, so the next mon comes in from that side
  const [dir, setDir] = useState(1);
  const [undo, setUndo] = useState<{ pokemon: number; name: string } | null>(null);
  // Ctrl+Enter presses, each sealing (or moving on) once the record has taken a field's last edit
  const [advance, setAdvance] = useState(0);
  // the next field to fill, once the record has the answer just given at `from` in the field `after` (nextToFill); a
  // menu opens as it's reached
  const [flow, setFlow] = useState<{ after: string | null; from?: string | null } | null>(null);
  // the mon just sealed here, its stamp slammed down as it was (not as it comes up sealed)
  const [stamping, setStamping] = useState<number | null>(null);
  // its title card as it opens, what's under the bar out of sight (intro) till the card's about to clear
  const { titleCard, intro, gate } = useTitleCard();
  const mainRef = useRef<HTMLDivElement>(null);
  const runRef = useRef<HTMLElement>(null);
  // how the last answer came: a menu picked from by the keyboard goes on to the next field; one by the pointer stays
  const pointedRef = useRef(false);
  const dex = activeDexView!;
  const homeDex = dex.game.id === 'home';

  useInertPage();

  const byId = useMemo(() => new Map(captures.map((entry) => [entry.pokemon.id, entry])), [captures]);
  const tally = useMemo(() => {
    let sealed = 0;
    let open = 0;
    for (const id of queue) {
      const entry = byId.get(id);
      if (entry?.sealed) {
        sealed++;
      } else if (entry && toFill(entry) > 0) {
        open++;
      }
    }
    return { sealed, open };
  }, [queue, byId]);

  const capture = byId.get(queue[index]);
  const missing = capture?.captured && capture.status !== 'unobtainable' ? unansweredFields(capture, capture.pokemon.gender_lock) : [];
  const missingIds = new Set(missing.map((field) => field.id));
  const sealable = Boolean(capture?.captured && capture.status === 'caught' && !capture.sealed && missing.length === 0);
  const last = index >= queue.length - 1;

  const go = useCallback((delta: number) => {
    setStamping(null);
    setDir(delta < 0 ? -1 : 1);
    setIndex((current) => Math.max(0, Math.min(queue.length - 1, current + delta)));
  }, [queue.length]);

  const jump = useCallback((to: number) => {
    setStamping(null);
    setDir(to < indexRef.current ? -1 : 1);
    setIndex(to);
    setNarrowList(false);
    mainRef.current?.focus({ preventScroll: true });
  }, []);
  // a mon picked in the list: the list isn't scrolled to it (it's where it was pressed)
  const pickedRef = useRef(false);
  const pickFromList = useCallback((to: number) => {
    pickedRef.current = to !== indexRef.current;
    jump(to);
  }, [jump]);

  const toggleList = useCallback(() => {
    if (narrow) {
      setNarrowList((shown) => !shown);
    } else {
      setListShown(!listShown);
    }
  }, [narrow, listShown, setListShown]);

  // sealed and stamped, the mon staying up: Ctrl+Enter again, or E, goes on
  const seal = useCallback(() => {
    if (!capture || !sealable) {
      return;
    }
    patchRecords([capture], { sealed: true });
    setUndo({ pokemon: capture.pokemon.id, name: displayName(capture.pokemon.name, capture.pokemon.name_ja, locale) });
    setStamping(capture.pokemon.id);
  }, [capture, sealable, patchRecords, locale]);

  const close = useCallback(() => onClose(queue[index] ?? null), [onClose, queue, index]);

  useEffect(() => {
    const pointed = () => {
      pointedRef.current = true;
    };
    const keyed = () => {
      pointedRef.current = false;
    };
    document.addEventListener('pointerdown', pointed, true);
    document.addEventListener('keydown', keyed, true);
    return () => {
      document.removeEventListener('pointerdown', pointed, true);
      document.removeEventListener('keydown', keyed, true);
    };
  }, []);

  // the seal's undo stays a moment, then goes
  useEffect(() => {
    if (!undo) {
      return undefined;
    }
    const timer = window.setTimeout(() => setUndo(null), UNDO_MS);
    return () => window.clearTimeout(timer);
  }, [undo]);

  const handleUndo = () => {
    const sealed = captures.find((entry) => entry.pokemon.id === undo?.pokemon);
    if (sealed?.sealed) {
      patchRecords([sealed], { sealed: false });
      jump(queue.indexOf(sealed.pokemon.id));
    }
    setUndo(null);
  };

  const patch = useCallback((changes: RecordPatch) => {
    if (capture) {
      patchRecords([capture], changes);
    }
  }, [capture, patchRecords]);

  // a status for the mon: marks one that has none, else changes it (a sealed one keeps its own). By key, Unobtainable
  // only marks: on a record it would wipe what's been filled in
  const setStatus = useCallback((status: CaptureStatus, byKey = false) => {
    if (!capture || capture.sealed) {
      return;
    }
    if (!capture.captured) {
      mark(capture.pokemon.id, status);
    } else if (capture.status !== status && !(byKey && status === 'unobtainable')) {
      patch({ status });
    }
  }, [capture, mark, patch]);

  // ← → between mons (anywhere with Ctrl or Alt; bare, out of what's typed into), or Q and E; 1 2 3 mark, L shows or
  // hides the list; Enter starts filling in from the top, and in a field (or on a closed menu's button) goes on to the
  // next to fill; Ctrl+Enter seals (with nothing to seal, goes on), from an open menu too, which it closes; Esc leaves a
  // field, then the list over the mon, then the review. An open menu keeps its other keys, an IME its own while it
  // composes
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing) {
        return;
      }
      const target = e.target instanceof Element ? e.target : null;
      const typing = target?.closest('input, textarea, [contenteditable]') ?? null;
      const field = typing ?? target?.closest('.dropdown-trigger') ?? null;
      const bare = !e.ctrlKey && !e.metaKey && !e.altKey;
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        // once a press: held, its repeats would seal every mon it went on to
        if (e.repeat) {
          return;
        }
        // a field's text is committed as it loses focus, so the seal waits a render to read the record with it
        if (field instanceof HTMLElement) {
          field.blur();
        }
        setAdvance((count) => count + 1);
        return;
      }
      if (document.querySelector('.dropdown-menu')) {
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        if (field instanceof HTMLElement) {
          field.blur();
          mainRef.current?.focus({ preventScroll: true });
        } else if (narrow && narrowList) {
          setNarrowList(false);
        } else {
          close();
        }
      } else if (e.key === 'Enter' && bare && !e.shiftKey && !e.repeat) {
        // answered: committed as it's left, then on; nothing focused: from the top. Another button keeps its Enter
        if (field instanceof HTMLElement) {
          e.preventDefault();
          field.blur();
          setFlow({ after: field.closest<HTMLElement>('[data-field]')?.dataset.field ?? null, from: field.id || null });
        } else if (!(target instanceof HTMLButtonElement)) {
          e.preventDefault();
          setFlow({ after: null });
        }
      } else if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && (!typing || e.ctrlKey || e.altKey)) {
        e.preventDefault();
        go(e.key === 'ArrowRight' ? 1 : -1);
      } else if (!typing && bare) {
        const letter = e.key.toLowerCase();
        const status = MARKS.find((entry) => entry.key === e.key)?.status;
        if (letter === 'q' || letter === 'e') {
          e.preventDefault();
          go(letter === 'e' ? 1 : -1);
        } else if (letter === 'l' && !e.repeat) {
          e.preventDefault();
          toggleList();
        } else if (status && !e.repeat) {
          e.preventDefault();
          setStatus(status, true);
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [close, go, toggleList, setStatus, narrow, narrowList]);

  const advanceRef = useRef(() => {});
  advanceRef.current = () => (sealable ? seal() : go(1));
  useEffect(() => {
    if (advance > 0) {
      advanceRef.current();
    }
  }, [advance]);

  // the next field to fill, focused once the record has the last answer, its menu open; none left, the mon again. The
  // menu opens a frame on, once its field has been scrolled into sight: a scroll after would close it
  const flowRef = useRef<(next: { after: string | null; from?: string | null }) => void>(() => {});
  flowRef.current = (next) => {
    const id = capture?.captured && !capture.sealed && capture.status !== 'unobtainable' ? nextToFill(capture, next.after, next.from ?? null, saves.length > 0) : null;
    const control = id ? document.getElementById(id) : null;
    if (!control) {
      mainRef.current?.focus({ preventScroll: true });
      return;
    }
    control.focus({ preventScroll: true });
    control.scrollIntoView({ block: 'nearest' });
    if (control.classList.contains('dropdown-trigger')) {
      requestAnimationFrame(() => {
        if (document.activeElement === control && control.getAttribute('aria-expanded') !== 'true') {
          control.click();
        }
      });
    }
  };
  useEffect(() => {
    if (flow) {
      flowRef.current(flow);
    }
  }, [flow]);

  // an answer picked by the keyboard from a menu to a field still to fill goes on: to the field's next control (In a
  // game, on to which game) or the next field
  const change = (field: CaptureField, changes: RecordPatch) => {
    patch(changes);
    const waited = missingIds.has(field.id) || (field.id === 'save' && (missingIds.has('origin_game') || missingIds.has('language')));
    if (MENU_KINDS.has(field.kind) && waited && !pointedRef.current) {
      setFlow({ after: field.id, from: 'location_save' in changes ? 'review-location-game' : `review-${field.id}` });
    }
  };

  useEffect(() => {
    mainRef.current?.focus({ preventScroll: true });
  }, []);

  // the list keeps the mon it's on near its top, the two before it in view and the rest of the run below it (the run's
  // mostly worked down); one picked in the list itself is in view where it was pressed, and the list stays put. Scrolled
  // on the list alone, which a scrollIntoView wouldn't keep to
  useEffect(() => {
    // spent here even where there's no list to keep still: a pick in the narrow overlay closes it, and the flag mustn't
    // outlast it to leave the list unscrolled when it's opened again
    const picked = pickedRef.current;
    pickedRef.current = false;
    const run = runRef.current;
    const item = run?.querySelector('.review-run-row.current')?.parentElement;
    if (!run || !item || picked) {
      return;
    }
    const anchor = item.previousElementSibling?.previousElementSibling ?? item.parentElement!.firstElementChild ?? item;
    run.scrollTop += anchor.getBoundingClientRect().top - run.getBoundingClientRect().top;
  }, [index, list]);

  const state = capture ? stateOf(capture, false) : 'unmarked';
  const tint = capture?.sealed ? locationTint(capture.location, homeDex) : null;
  const here = capture ? placeOf(capture) : null;
  const filled = GATES.filter((field) => !missingIds.has(field.id)).length;

  let note = null;
  if (capture && !capture.captured) {
    note = <p className="review-note">{t('info.notCaught')}</p>;
  } else if (capture?.status === 'unobtainable') {
    note = <p className="review-note">{t('review.noRecord')}</p>;
  } else if (capture && !capture.sealed) {
    if (missing.length > 0) {
      note = (
        <p className="review-note missing">
          <FontAwesomeIcon icon={faCircleExclamation} />
          {t('review.missing', { fields: missing.map((field) => t(field.labelKey)).join(t('common.listSeparator')) })}
        </p>
      );
    } else if (capture.status === 'caught') {
      note = <p className="review-note ready"><FontAwesomeIcon icon={faCheck} />{t('review.ready')}</p>;
    }
  }

  // a field's plate: its control while the record's open, its value once sealed (where it is, still movable), a blank
  // till the mon's marked; marked at its corner while sealing waits on it, ticked once one that gates the seal is in
  const plate = (field: CaptureField, k: number) => {
    if (!capture || (capture.sealed && field.kind === 'save')) {
      return null;
    }
    const waiting = missingIds.has(field.id);
    let body;
    if (!capture.captured) {
      body = (
        <>
          <span className="review-plate-label">{t(field.labelKey)}</span>
          <p className="review-plate-value blank">—</p>
        </>
      );
    } else if (capture.sealed) {
      body = (
        <>
          <span className="review-plate-label">{t(field.labelKey)}</span>
          {field.id === 'location'
            ? (
              <Dropdown
                blankLabel={here ? undefined : formatFieldValue(field, capture, locale, saves)}
                id="review-move"
                onSelect={(key) => key && moveTo(capture.pokemon.id, placeFromKey(key))}
                options={destinations(saves, homeDex).map((place) => ({ value: placeKey(place), label: placeLabel(place, saves, locale) }))}
                value={here ? placeKey(here) : ''}
              />
            )
            : (
              <p className="review-plate-value">
                {/* the ball's sprite before its name, as its menu shows it while the record is open */}
                {field.id === 'ball' && capture.ball && capture.ball !== 'unknown' && <img alt="" className="review-ball" src={`/balls/${capture.ball}.png`} />}
                {formatFieldValue(field, capture, locale, saves)}
              </p>
            )}
        </>
      );
    } else {
      body = <CaptureFieldControl field={field} genderLock={capture.pokemon.gender_lock} idPrefix="review" onChange={(changes) => change(field, changes)} value={capture} />;
    }
    return (
      <div
        className={classNames('review-plate', { waiting, done: field.gatesSeal && !waiting && capture.captured })}
        data-field={field.id}
        key={field.id}
        style={{ '--k': k } as CSSProperties}
      >
        {body}
        <span className="review-plate-mark">
          {waiting && <FontAwesomeIcon icon={faCircleExclamation} />}
          {field.gatesSeal && !waiting && capture.captured && <FontAwesomeIcon icon={faCheck} />}
        </span>
      </div>
    );
  };

  return createPortal(
    <div aria-label={t('review.title')} aria-modal="true" className="review" data-gate={gate || undefined} role="dialog" style={{ '--scale': scale } as CSSProperties}>
      <header className="review-top">
        <span className="review-logo"><span>{t('review.title')}</span></span>
        <h1>{activeDex!.title}</h1>
        <span className="review-position">{t('review.position', { n: Math.min(index + 1, queue.length), total: queue.length })}</span>
        <span className="review-tally">{t('review.tally', { sealed: tally.sealed, open: tally.open })}</span>
        <span className="review-hint">{t('review.hint')}</span>
        <button
          aria-pressed={list}
          className={classNames('review-list-toggle', { on: list })}
          onClick={toggleList}
          title={t('review.listToggle')}
          type="button"
        >
          <FontAwesomeIcon icon={faList} />
        </button>
        <button aria-label={t('almanac.close')} className="review-close" onClick={close} title={t('almanac.close')} type="button">
          <FontAwesomeIcon icon={faXmark} />
        </button>
      </header>
      <div className="review-progress"><span style={{ transform: `scaleX(${queue.length > 0 ? (index + 1) / queue.length : 0})` }} /></div>
      <div className={classNames('review-body', { listed: list })} data-intro={intro || undefined}>
        {list &&
          <aside aria-label={t('review.list')} className="review-run" ref={runRef}>
            <ol style={{ zoom: scale }}>
              {queue.map((id, i) => {
                const entry = byId.get(id);
                return entry ? <RunRow capture={entry} current={i === index} dex={dex} index={i} key={id} onPick={pickFromList} /> : null;
              })}
            </ol>
          </aside>
        }
        <div className="review-main" ref={mainRef} tabIndex={-1}>
          {capture
            ? (
              <div className="review-stage" style={{ zoom: scale }}>
                <div className={classNames('review-grid', `state-${state}`)}>
                  <section className={classNames('review-bay', `state-${state}`, tint && `loc-${tint}`)} data-dir={dir} key={`bay-${capture.pokemon.id}`}>
                    <p aria-hidden="true" className="review-bay-number">{dexNumber(capture.pokemon, dex)}</p>
                    <div className="review-lens">
                      <svg aria-hidden="true" className="review-brackets" preserveAspectRatio="none" viewBox="0 0 100 100">
                        <path d="M1 17V1H17M83 1H99V17M99 83V99H83M17 99H1V83" />
                      </svg>
                      <span className="review-lens-glass"><i className={iconClass(capture.pokemon, dex)} /></span>
                      {capture.sealed && <span className={classNames('review-stamp', { slam: stamping === capture.pokemon.id })}>{t('review.stamp')}</span>}
                    </div>
                    <h2><PokemonName name={capture.pokemon.name} nameJa={capture.pokemon.name_ja} /></h2>
                    <p className="review-types">
                      {capture.pokemon.types?.map((type) => (
                        <span className="review-type" key={type}>
                          <span className="type-glyph" style={{ backgroundColor: `var(--type-${type})`, maskImage: `url(/types/${type}.svg)` }} />
                          {t(`type.${type}`)}
                        </span>
                      ))}
                    </p>
                    {capture.captured && capture.status !== 'unobtainable' &&
                      <div className="review-pips" title={t('review.pips', { n: filled, total: GATES.length })}>
                        {GATES.map((field) => <span className={classNames('review-pip', { on: !missingIds.has(field.id) })} key={field.id} title={t(field.labelKey)} />)}
                        <span className="review-pips-count">{filled}/{GATES.length}</span>
                      </div>
                    }
                    {!capture.sealed &&
                      <div className="review-marks">
                        {MARKS.map(({ status, icon, key }) => (
                          <button
                            aria-pressed={capture.captured && capture.status === status}
                            className={classNames('review-mark', `status-${status}`, { on: capture.captured && capture.status === status })}
                            key={status}
                            onClick={() => setStatus(status)}
                            type="button"
                          >
                            <FontAwesomeIcon icon={icon} />{t(`status.${status}`)}<kbd>{key}</kbd>
                          </button>
                        ))}
                      </div>
                    }
                    {capture.sealed
                      ? <UnsealHold onUnseal={() => patch({ sealed: false })} />
                      : capture.captured &&
                        <button className="review-release" onClick={() => releaseCaptures([capture.pokemon.id])} type="button">
                          <FontAwesomeIcon icon={faTrash} />{t('info.release')}
                        </button>
                    }
                    {note}
                  </section>
                  {capture.status !== 'unobtainable' && SIDES.map((fields, side) => (
                    <div className={classNames('review-side', side === 0 ? 'left' : 'right')} key={`side-${side}-${capture.pokemon.id}`}>
                      {fields.map((field, k) => plate(field, k + side * SIDES[0].length))}
                    </div>
                  ))}
                </div>
              </div>
            )
            : <p className="review-empty">{t('review.empty')}</p>}
        </div>
      </div>
      {titleCard && <TitleCard hint={t('scene.skip')} sub={activeDex!.title} title={t('review.title')} />}
      <footer className="review-foot" style={{ zoom: scale }}>
        <button className="review-nav" disabled={index === 0} onClick={() => go(-1)} type="button">
          <FontAwesomeIcon icon={faArrowLeft} />{t('review.prev')}<kbd>Q</kbd>
        </button>
        {undo &&
          <p className="review-toast">
            {t('review.sealedToast', { name: undo.name })}
            <button onClick={handleUndo} type="button">{t('review.undo')}</button>
          </p>
        }
        <span className="review-spacer" />
        {sealable &&
          <button className="review-seal" onClick={seal} type="button">
            <FontAwesomeIcon icon={faLock} />{t('seal.action')}<kbd>Ctrl+Enter</kbd>
          </button>
        }
        <button className="review-nav" disabled={last} onClick={() => go(1)} type="button">
          {t(sealable ? 'review.skip' : 'review.next')}<kbd>E</kbd><FontAwesomeIcon icon={faArrowRight} />
        </button>
      </footer>
    </div>,
    document.body,
  );
}
