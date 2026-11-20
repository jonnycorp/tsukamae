import classNames from 'classnames';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { createPortal } from 'react-dom';
import { faArrowLeft, faArrowRight, faArrowUpRightFromSquare, faBan, faCheck, faCircleExclamation, faClock, faLock, faLockOpen, faTrash } from '@fortawesome/free-solid-svg-icons';
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { CAPTURE_FIELDS, asksPlace, sealedPlace, unansweredFields, withFieldInvariants } from '../../../utils/capture-fields';
import { LabLensArt } from './lab/LabLensArt';
import { FieldControl, FieldText, FieldVisual, SoftBox } from './review-fields';
import { PokemonName } from '../../library/PokemonName';
import { useCalmStart } from './TitleCard';
import { UNSEAL_HOLD } from './Pokemon';
import { locationTint, placeLabel, shownPlace } from '../../../utils/location-moves';
import { CONFIRMABLE, CONFIRMABLE_IDS, MANUAL_ORIGIN, MY_GAME_IDS, asksField, givenValues, originMode, readTouches, softFields, untouched, writeTouches } from '../../../utils/review-confirm';
import { gameColor } from '../../../utils/game-colors';
import { canVisitChampions } from '../../../utils/champions';
import { dexNumber, iconClass } from '../../../utils/pokemon';
import { monLinks } from '../../../utils/formatting';
import { stateOf } from './ledger-model';
import { today } from '../../../utils/date-entry';
import { useDexContext } from '../../../hooks/contexts/use-dex-context';
import { useThemeContext } from '../../../hooks/contexts/use-local-storage-context';
import { useInertPage } from '../../../hooks/use-inert-page';
import { useLongPress } from '../../../hooks/use-long-press';
import { useMark } from './use-mark';
import { useMediaQuery, useTrackerActions, useTrackerState } from './use-tracker';
import { usePatchRecords } from './use-patch';
import { useSceneScale } from './use-scene-scale';
import { useTranslation } from '../../../hooks/use-translation';
import { MOD_KEY } from '../../../utils/platform';

import type { CSSProperties } from 'react';
import type { Capture, CaptureStatus, Dex, GameSave } from '../../../types';
import type { CaptureField } from '../../../utils/capture-fields';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import type { OriginMode } from '../../../utils/review-confirm';
import type { RecordPatch } from './use-patch';

// the plates either side of the mon, every field in a spot of its own that's the same on every mon, so going
// from one to the next changes values and never places: on the left where it came from (on a record still open, held in
// one card with My Game's box where it's one of your saves'), then the two only some mons are asked, an empty
// spot on the rest; on the right what it is.
// Each side breaks after its fourth: above, what's fixed the day it was caught; below, what can come later (a visit to
// Champions, Max Soup, and the four on the right changed by unsealing). Where it is isn't a plate in a HOME dex: it's a
// sealed mon's alone (asksPlace), under the lens; a game's dex asks it of an open record too, last on the left
const FIELD = new Map(CAPTURE_FIELDS.map((field) => [field.id, field]));
const fieldsOf = (ids: CaptureField['id'][]) => ids.map((id) => FIELD.get(id)!);
const LEFT: CaptureField['id'][] = ['origin_game', 'language', 'ot', 'tid', 'been_to_champions', 'gigantamax'];
const RIGHT = fieldsOf(['ball', 'catch_date', 'gender', 'nature', 'nickname', 'level', 'trained', 'favorite']);
const HOME_SIDES = [fieldsOf(LEFT), RIGHT];
const GAME_SIDES = [fieldsOf([...LEFT, 'location']), RIGHT];
// the order the Enter flow takes them in: the order they stand in
const flowOf = (sides: CaptureField[][]) => [FIELD.get('save')!, ...sides[0], ...sides[1]];
const HOME_FLOW = flowOf(HOME_SIDES);
const GAME_FLOW = flowOf(GAME_SIDES);
// what sealing waits on, a pip each under the mon (with one for any other field holding a value the app no longer
// writes, as a legacy favorite does, which stands in its way too till it's answered again)
const HOME_GATES = HOME_FLOW.filter((field) => field.gatesSeal);
const GAME_GATES = GAME_FLOW.filter((field) => field.gatesSeal);
// a field answered from a menu goes on to the next still to fill; one typed into goes on with Enter
const MENU_KINDS = new Set(['select', 'yesno', 'save', 'location']);
// too narrow for the list beside the mon: there it isn't shown
const NARROW_QUERY = '(width < 1000px)';

const MARKS: { status: CaptureStatus; icon: IconDefinition; key: string }[] = [
  { status: 'caught', icon: faCheck, key: '1' },
  { status: 'temporary', icon: faClock, key: '2' },
  { status: 'unobtainable', icon: faBan, key: '3' },
];
// a HOME dex's, for a mon not yet marked alone: caught, the default (as a press in the dex marks), or
// unobtainable. A record there has no Temporary, and an open one is already one
const HOME_MARKS: { status: CaptureStatus; icon: IconDefinition; key: string }[] = [
  { status: 'caught', icon: faCheck, key: '1' },
  { status: 'unobtainable', icon: faBan, key: '2' },
];

// what stands between a record and its seal, where it is left out where it isn't asked yet (asksPlace)
const gateOf = (capture: Capture, homeDex: boolean) => unansweredFields(capture, capture.pokemon.gender_lock, asksPlace(capture, homeDex));

// a marked record's fields still to answer, counted once for each version of it, as the list counts every mon's (a
// record is one dex's, so its dex's kind is the same each time it's counted)
const toFillCache = new WeakMap<Capture, number>();
function toFill (capture: Capture, homeDex: boolean): number {
  let n = toFillCache.get(capture);
  if (n === undefined) {
    n = capture.captured && capture.status !== 'unobtainable' && !capture.sealed ? gateOf(capture, homeDex).length : 0;
    toFillCache.set(capture, n);
  }
  return n;
}

// the control a field still waits on, if it waits: a game's own pick under In a game, the name under a ticked
// nickname box; My Game for the fields its card holds (soft: a save's four, or the trainer of a HOME gift)
function waitingControl (capture: Capture, field: CaptureField, missing: Set<string>, soft: string[]): string | null {
  if (field.id === 'save') {
    return soft.some((id) => missing.has(id)) ? 'review-save' : null;
  }
  if (!missing.has(field.id) || soft.includes(field.id)) {
    return null;
  }
  if (field.id === 'nickname') {
    return capture.has_nickname === true ? 'review-nickname-text' : 'review-nickname';
  }
  return `review-${field.id}`;
}

// where the next answer goes, after one given at `from` in the field `after` (or from the top): that field again if
// it still waits on another of its controls, else the first after it, in the plates' order, that sealing waits on
function nextToFill (capture: Capture, after: string | null, from: string | null, soft: string[], homeDex: boolean, toTouch: string[]): string | null {
  const missing = new Set([...gateOf(capture, homeDex).map((field) => field.id), ...toTouch]);
  const flow = homeDex ? HOME_FLOW : GAME_FLOW;
  const start = after === null ? 0 : flow.findIndex((field) => field.id === after);
  if (after !== null && start >= 0) {
    const own = waitingControl(capture, flow[start], missing, soft);
    if (own && own !== from) {
      return own;
    }
  }
  for (const field of flow.slice(after === null ? 0 : start + 1)) {
    const control = waitingControl(capture, field, missing, soft);
    if (control) {
      return control;
    }
  }
  return null;
}

// how many recent dates the date plate offers: one, so none is ever out of sight
const RECENT_DATES = 1;
// the entrance's length, its last wire's dot landed, in step with styles/review.scss's (Ink's brush the longest)
const ENTRANCE_MS = 420;

interface RowProps {
  capture: Capture;
  // its defaulted fields still to touch (review-confirm)
  toTouch: number;
  index: number;
  current: boolean;
  dex: Dex;
  onPick: (index: number) => void;
}

// a mon in the run's list: its sprite, number and name, and how far its record has got (sealed, ready, how many left
// to fill), going to it when pressed. Kept as it was unless its record changes
const RunRow = memo(function RunRow ({ capture, toTouch, index, current, dex, onPick }: RowProps) {
  const state = stateOf(capture, false);
  const left = toFill(capture, dex.game.id === 'home') + toTouch;
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
  // (one released from a free-form dex leaves the dex, and the run, altogether)
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
export function Review ({ queue: opened, start, onClose }: Props) {
  const { captures } = useTrackerState();
  const { activeDex, activeDexView, dexes, saves } = useDexContext();
  const { openMoveMenu, releaseCaptures } = useTrackerActions();
  const { t, locale } = useTranslation();
  const mark = useMark();
  const patchRecords = usePatchRecords();
  const scale = useSceneScale();
  const narrow = useMediaQuery(NARROW_QUERY);
  const [index, setIndex] = useState(Math.max(0, Math.min(opened.length - 1, start)));
  const indexRef = useRef(index);
  indexRef.current = index;
  // which way the last move went, so the next mon comes in from that side; none for the first, which settles in with
  // the plates as the review opens
  const [dir, setDir] = useState(0);
  // Ctrl+Enter presses, each sealing (or moving on) once the record has taken a field's last edit
  const [advance, setAdvance] = useState(0);
  // the next field to fill, once the record has the answer just given at `from` in the field `after` (nextToFill); a
  // menu opens as it's reached
  const [flow, setFlow] = useState<{ after: string | null; from?: string | null } | null>(null);
  // the mon just sealed here, its stamp slammed down as it was (not as it comes up sealed)
  const [stamping, setStamping] = useState<number | null>(null);
  // its entrance as it opens, in place of a title card (styles/review.scss): held at its start while the first
  // frames go by (gate, useCalmStart), so it never starts in a stall, and let go once it's played (entering). Keys and
  // presses work from the first frame; still mode lands at once
  const { still } = useThemeContext();
  const calm = useCalmStart();
  const [entering, setEntering] = useState(true);
  useEffect(() => {
    if (!calm && !still) {
      return undefined;
    }
    const done = window.setTimeout(() => setEntering(false), still ? 0 : ENTRANCE_MS);
    return () => window.clearTimeout(done);
  }, [calm, still]);
  const gate = entering && !calm && !still;
  const mainRef = useRef<HTMLDivElement>(null);
  const runRef = useRef<HTMLElement>(null);
  // how the last answer came: a menu picked from by the keyboard goes on to the next field; one by the pointer stays
  const pointedRef = useRef(false);
  const dex = activeDexView!;
  const homeDex = dex.game.id === 'home';
  // the defaulted fields touched here, by mon (utils/review-confirm), kept in this window's storage
  const dexId = activeDex!.id;
  const [touches, setTouches] = useState(() => readTouches(dexId));
  const touch = useCallback((pokemon: number, fields: string[] | null, untouch: string[] = []) => setTouches(writeTouches(dexId, pokemon, fields, untouch)), [dexId]);
  // what a record of this dex is given as it's marked (its defaults, its baselines), against which a field still to touch
  // is told
  const given = useMemo(() => givenValues(activeDex?.captureDefaults, homeDex, saves), [activeDex, homeDex, saves]);

  useInertPage();

  const byId = useMemo(() => new Map(captures.map((entry) => [entry.pokemon.id, entry])), [captures]);
  // the run as it stands: a mon released from a free-form dex gone from it, the next coming up in its place, or at the
  // run's end the one before, before it's ever drawn empty
  const queue = useMemo(() => opened.filter((id) => byId.has(id)), [opened, byId]);
  useLayoutEffect(() => {
    if (queue.length > 0 && index > queue.length - 1) {
      setIndex(queue.length - 1);
    }
  }, [index, queue.length]);
  const capture = byId.get(queue[index]);
  // each mon from the top of the stage: the last one's scroll (the wheel's, or the Enter flow's to a plate below the
  // fold) would keep the next one's number and lens out of sight as it comes in. Before the flow scrolls to its field
  const shownId = capture?.pokemon.id;
  useLayoutEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTop = 0;
    }
  }, [shownId]);
  // what the seal waits on: a field to answer, and a defaulted one still to touch
  const toTouch = capture ? untouched(capture, touches[capture.pokemon.id], given) : [];
  const missing = capture?.captured && capture.status !== 'unobtainable' ? [...gateOf(capture, homeDex), ...toTouch] : [];
  const missingIds = new Set<string>(missing.map((field) => field.id));
  const sealable = Boolean(capture?.captured && capture.status === 'caught' && !capture.sealed && missing.length === 0);
  const last = index >= queue.length - 1;
  // a record still open, its fields taking answers
  const answering = Boolean(capture?.captured && !capture.sealed && capture.status !== 'unobtainable');
  // where the four the game's plate starts came from (originMode): one of your saves, held in one card that only
  // My Game changes; a HOME entry's trainer, held so, the game picked apart; by hand; or none yet, the card waiting on a pick
  const origin: { mode: OriginMode; save?: GameSave } = capture && answering ? originMode(capture, saves, touches[capture.pokemon.id]) : { mode: 'manual' };
  const soft = softFields(origin.mode);
  // the card's fields still to touch, a press on it touching them all
  const cardTouch = toTouch.filter((field) => soft.includes(field.id)).map((field) => field.id);

  // a move that goes nowhere (back from the first, on from the last, the mon's own row in the list) leaves the mon as it
  // stands: a new way in would play its entrance again
  const go = useCallback((delta: number) => {
    const to = Math.max(0, Math.min(queue.length - 1, indexRef.current + delta));
    if (to === indexRef.current) {
      return;
    }
    setStamping(null);
    setDir(delta < 0 ? -1 : 1);
    setIndex(to);
  }, [queue.length]);

  const jump = useCallback((to: number) => {
    if (to !== indexRef.current) {
      setStamping(null);
      setDir(to < indexRef.current ? -1 : 1);
      setIndex(to);
    }
    mainRef.current?.focus({ preventScroll: true });
  }, []);
  // a mon picked in the list: the list isn't scrolled to it (it's where it was pressed)
  const pickedRef = useRef(false);
  const pickFromList = useCallback((to: number) => {
    pickedRef.current = to !== indexRef.current;
    jump(to);
  }, [jump]);

  // sealed and stamped, the mon staying up: Ctrl+Enter again, or E, goes on
  const seal = useCallback(() => {
    if (!capture || !sealable) {
      return;
    }
    // where it is goes with the seal: HOME for a record with no place yet, its own kept for one with (sealedPlace)
    patchRecords([capture], { sealed: true, ...sealedPlace(capture, homeDex) });
    touch(capture.pokemon.id, null);
    setStamping(capture.pokemon.id);
  }, [capture, sealable, patchRecords, homeDex, touch]);

  const close = useCallback(() => onClose(queue[index] ?? null), [onClose, queue, index]);

  // a sealed mon's place moved from the move menu, opened at its chip under the lens (S, or a press on it)
  const openPlace = useCallback(() => {
    const chip = document.getElementById('review-place');
    if (capture?.sealed && chip) {
      openMoveMenu(capture.pokemon.id, chip, scale, false);
    }
  }, [capture, openMoveMenu, scale]);

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

  // ← → between mons (anywhere with Ctrl or Alt; bare, out of what's typed into), or Q and E; 1 2 3 mark, S moves a
  // sealed mon; Enter starts filling in from the top, and in a field (or on a closed menu's button) goes on to the next to
  // fill; Ctrl+Enter seals (with nothing to seal, goes on), from an open menu too, which it closes; Esc leaves a field,
  // then the review. An open menu keeps its other keys, an IME its own while it
  // composes
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing) {
        return;
      }
      const target = e.target instanceof Element ? e.target : null;
      // a checkbox (the Nickname box) takes no text, so the keys stay the review's
      const typing = target?.closest('input:not([type="checkbox"]), textarea, [contenteditable]') ?? null;
      const field = typing ?? target?.closest('.dropdown-trigger, input[type="checkbox"]') ?? null;
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
      if (document.querySelector('.dropdown-menu, .move-menu')) {
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        // a recent date under the date's box is part of that field (DateInput), so Esc leaves the field from there too
        const leaving = field ?? target?.closest('.date-recent-pick') ?? null;
        if (leaving instanceof HTMLElement) {
          leaving.blur();
          mainRef.current?.focus({ preventScroll: true });
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
        // what's typed is committed as it's left (a date padded out), so it goes with this mon, not lost
        if (field instanceof HTMLElement) {
          field.blur();
        }
        go(e.key === 'ArrowRight' ? 1 : -1);
      } else if (e.key === ' ' && !typing && bare) {
        // Space walks the run as E does, Shift+Space back as Q, held to run on: from anywhere but a field typed
        // into or a button of its own (Previous and Next press again as they're focused). A menu's button or
        // the Nickname box, left focused by the pointer's last answer, gives the key up rather than opening or toggling
        const button = target?.closest('button');
        if (!button || button.classList.contains('dropdown-trigger') || button.classList.contains('rv-toggle') || button.classList.contains('review-place') || field) {
          e.preventDefault();
          mainRef.current?.focus({ preventScroll: true });
          go(e.shiftKey ? -1 : 1);
        }
      } else if (!typing && bare) {
        const letter = e.key.toLowerCase();
        const status = (homeDex ? HOME_MARKS : MARKS).find((entry) => entry.key === e.key)?.status;
        if (letter === 'q' || letter === 'e') {
          e.preventDefault();
          go(letter === 'e' ? 1 : -1);
        } else if (letter === 's' && !e.repeat) {
          e.preventDefault();
          openPlace();
        } else if (status && !e.repeat && (!homeDex || !capture?.captured)) {
          e.preventDefault();
          setStatus(status, true);
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [close, go, setStatus, openPlace, homeDex, capture]);

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
    const touched = capture ? touches[capture.pokemon.id] : undefined;
    const id = capture?.captured && !capture.sealed && capture.status !== 'unobtainable'
      ? nextToFill(capture, next.after, next.from ?? null, softFields(originMode(capture, saves, touched).mode), homeDex, untouched(capture, touched, given).map((field) => field.id))
      : null;
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
  // game, on to which game, though the place was answered before it) or the next field
  // My Game's pick (pick): the fields it touches, and whether the record's by hand from now on
  const change = (field: CaptureField, changes: RecordPatch, pick?: { touched: string[]; manual: boolean }) => {
    if (capture) {
      // a pick is a touch (My Game's, of what it fills); a field a rule changed along with it (a nickname or a gift
      // flooring the heart, a Cherish Ball making it a gift) is to be touched again
      const picked = (pick ? pick.touched : [field.id]).filter((id) => CONFIRMABLE_IDS.includes(id));
      const next = withFieldInvariants(capture, changes);
      const moved = CONFIRMABLE.filter((other) => !picked.includes(other.id) &&
        other.keys.some((key) => key in next && !(key in changes) && next[key] !== capture[key])).map((other) => other.id);
      // by hand: Not my game, or one of the four changed by hand where they're no save's, keeps the record so till a
      // save's picked, so values typed to match one never lock it under the hand typing them
      const manual = pick ? pick.manual : origin.mode === 'manual' && MY_GAME_IDS.includes(field.id);
      touch(capture.pokemon.id, manual ? [...picked, MANUAL_ORIGIN] : picked, pick && !pick.manual ? [...moved, MANUAL_ORIGIN] : moved);
    }
    // a pick of the value it has is a touch alone: nothing's written
    if (!capture || Object.entries(changes).some(([key, value]) => capture[key as keyof Capture] !== value)) {
      patch(changes);
    }
    if (changes.catch_date) {
      enteredRef.current = [changes.catch_date, ...enteredRef.current.filter((iso) => iso !== changes.catch_date)];
    }
    const waited = missingIds.has(field.id) || (field.id === 'save' && MY_GAME_IDS.some((id) => missingIds.has(id)));
    if (MENU_KINDS.has(field.kind) && waited && !pointedRef.current) {
      setFlow({ after: field.id, from: `review-${field.id}` });
    }
  };

  // the date plate's recent dates: those given here this run, newest first, then the latest the dex's records
  // hold; never the one the mon has, nor one after today (a slip, which the red pen flags). One picked from the keys
  // goes on, as a menu's answer does
  const enteredRef = useRef<string[]>([]);
  const recentDates = useMemo(() => {
    const latest = captures.flatMap((cap) => (cap.catch_date ? [cap.catch_date] : [])).sort().reverse();
    const now = today();
    const picks: string[] = [];
    for (const iso of [...enteredRef.current, ...latest]) {
      if (picks.length === RECENT_DATES) {
        break;
      }
      if (iso <= now && iso !== capture?.catch_date && !picks.includes(iso)) {
        picks.push(iso);
      }
    }
    return picks;
  }, [captures, capture]);
  const pickedDate = (keyboard: boolean) => {
    if (keyboard && missingIds.has('catch_date')) {
      setFlow({ after: 'catch_date', from: 'review-catch_date' });
    }
  };

  useEffect(() => {
    mainRef.current?.focus({ preventScroll: true });
  }, []);

  // the list keeps the mon it's on near its top, the two before it in view and the rest of the run below it (the run's
  // mostly worked down); one picked in the list itself is in view where it was pressed, and the list stays put. Scrolled
  // on the list alone, which a scrollIntoView wouldn't keep to
  useEffect(() => {
    // spent here even where there's no list to keep still, so the flag never outlasts the pick
    const picked = pickedRef.current;
    pickedRef.current = false;
    const run = runRef.current;
    const item = run?.querySelector('.review-run-row.current')?.parentElement;
    if (!run || !item || picked) {
      return;
    }
    const anchor = item.previousElementSibling?.previousElementSibling ?? item.parentElement!.firstElementChild ?? item;
    run.scrollTop += anchor.getBoundingClientRect().top - run.getBoundingClientRect().top;
  }, [index, narrow]);

  const state = capture ? stateOf(capture, false) : 'unmarked';
  const tint = capture?.sealed ? locationTint(capture.location, homeDex) : null;
  const place = capture?.sealed ? shownPlace(capture, saves) : null;
  const links = capture ? monLinks(capture.pokemon, dex.game.game_family.id) : null;
  const sides = homeDex ? HOME_SIDES : GAME_SIDES;
  const askedDefaulted = capture ? CONFIRMABLE.filter((field) => !field.gatesSeal && asksField(capture, field)) : [];
  const pipFields = [...(homeDex ? HOME_GATES : GAME_GATES), ...askedDefaulted, ...missing.filter((field) => !field.gatesSeal && !askedDefaulted.includes(field))];
  const filled = pipFields.filter((field) => !missingIds.has(field.id)).length;

  // an open record's release, its touches let go with it
  const releaseButton = capture && capture.captured && !capture.sealed && (
    <button
      className="review-release"
      onClick={() => {
        releaseCaptures([capture.pokemon.id]);
        touch(capture.pokemon.id, null);
      }}
      type="button"
    >
      <FontAwesomeIcon icon={faTrash} />{t('info.release')}
    </button>
  );
  // each listed mon's defaulted fields still to touch, counted again only as a record or a touch changes
  const runTouches = useMemo(() => new Map(queue.map((id) => {
    const entry = byId.get(id);
    return [id, entry ? untouched(entry, touches[id], given).length : 0];
  })), [queue, byId, touches, given]);
  const checklists = useMemo(() => (dexes ?? []).filter((entry) => entry.checklist).map((entry) => ({ id: entry.id, title: entry.title })), [dexes]);

  // My Game's pick, as the card's box or the game's row's
  const pickSoft = (changes: RecordPatch, touched: string[], manual: boolean) => change(FIELD.get('save')!, changes, { touched, manual });

  // a field's plate, in its spot on every mon: its label, its picture and its value (a control while the record's open,
  // the value once sealed, a dash till the mon's marked). Lit once it's in, every field alike: answered, and a
  // defaulted one touched; a sealed mon's all lit. On an open record its corner says so too, ! still to do and a tick
  // done; a sealed one's carries none. A field this mon is never asked (Been to Champions for a mon that can't go there,
  // Gigantamax for one with no giant form), or a mon with no record, keeps its spot empty, so no plate moves from mon to
  // mon
  const plate = (field: CaptureField, line: number) => {
    // its line, top to bottom, for the entrance's stagger
    const rowStyle = { '--row': line } as CSSProperties;
    const asked = capture && capture.status !== 'unobtainable' && asksField(capture, field);
    if (!capture || !asked) {
      return <div aria-hidden="true" className="review-slot" data-field={field.id} key={field.id} style={rowStyle} />;
    }
    const waiting = !capture.sealed && missingIds.has(field.id);
    // a row of the card, held: shown as it'll be sealed, a press anywhere on the card touching all it holds;
    // the game's row the box itself where the four are (or wait on) a save's
    const fused = answering && soft.includes(field.id);
    const boxRow = fused && field.id === 'origin_game';
    // a defaulted field still at the value it was given: a press on its plate confirms it (on the card's, the card's)
    const touchable = fused ? !boxRow && cardTouch.length > 0 : toTouch.includes(field);
    let row;
    if (!capture.captured || (fused && origin.mode === 'empty')) {
      row = <span className="rv-text blank">—</span>;
    } else if (capture.sealed || fused) {
      row = <><FieldVisual capture={capture} field={field} homeDex={homeDex} saves={saves} /><FieldText capture={capture} field={field} homeDex={homeDex} saves={saves} /></>;
    } else {
      row = (
        <>
          <FieldControl
            canVisitChampions={canVisitChampions(capture.pokemon)}
            capture={capture}
            checklists={checklists}
            field={field}
            free={Boolean(activeDex?.free)}
            homeDex={homeDex}
            narrow={narrow}
            onChange={(changes) => change(field, changes)}
            onRecentPicked={field.kind === 'date' ? pickedDate : undefined}
            recentDates={field.kind === 'date' ? recentDates : undefined}
            saves={saves}
          />
          {/* My Game at the end of the game's row where the game's picked apart (a HOME gift's mark, a record by hand) */}
          {field.id === 'origin_game' && answering && saves.length > 0 &&
            <SoftBox capture={capture} mode={origin.mode} onPick={pickSoft} save={origin.save} saves={saves} size="compact" />
          }
        </>
      );
    }
    return (
      <div
        className={classNames('review-plate', `field-${field.id}`, { waiting, touchable, fused, 'soft-row': boxRow, done: capture.captured && !missingIds.has(field.id) })}
        data-field={field.id}
        key={field.id}
        // a press on the plate never opens its menu or takes the caret: only its box does. On a defaulted field
        // still to touch, it confirms the value it was given
        onClick={touchable
          ? (e) => {
            if (!(e.target instanceof Element && e.target.closest('button, input, label, .dropdown-menu, .date-recent'))) {
              touch(capture.pokemon.id, fused ? cardTouch : [field.id]);
            }
          }
          : undefined}
        style={rowStyle}
      >
        {boxRow
          ? <SoftBox capture={capture} mode={origin.mode} onPick={pickSoft} save={origin.save} saves={saves} size="card" />
          : (
            <span className="review-plate-label">
              {t(field.labelKey)}
              {fused && origin.mode !== 'empty' && <span className="review-plate-lock" title={t('review.softLocked')}><FontAwesomeIcon icon={faLock} /></span>}
            </span>
          )}
        <span className="review-plate-mark">
          {waiting && <FontAwesomeIcon icon={faCircleExclamation} />}
          {!waiting && !capture.sealed && capture.captured && <FontAwesomeIcon icon={faCheck} />}
        </span>
        {!boxRow && <div className="review-plate-row">{row}</div>}
      </div>
    );
  };

  return createPortal(
    <div aria-label={t('review.title')} aria-modal="true" className="review" data-entering={entering || undefined} data-gate={gate || undefined} role="dialog" style={{ '--scale': scale } as CSSProperties}>
      <header className="review-top">
        <span className="review-logo"><span>{t('review.title')}</span></span>
        <h1>{activeDex!.title}</h1>
      </header>
      <div className="review-body">
        {!narrow &&
          <aside aria-label={t('review.list')} className="review-run" ref={runRef}>
            <ol style={{ zoom: scale }}>
              {queue.map((id, i) => {
                const entry = byId.get(id);
                return entry ? <RunRow capture={entry} current={i === index} dex={dex} index={i} key={id} onPick={pickFromList} toTouch={runTouches.get(id) ?? 0} /> : null;
              })}
            </ol>
          </aside>
        }
        <div className="review-main" ref={mainRef} tabIndex={-1}>
          {capture
            ? (
              <div className="review-stage" style={{ zoom: scale }}>
                <div className="review-grid">
                  <section className={classNames('review-bay', `state-${state}`, tint && `loc-${tint}`)} data-dir={dir} key={`bay-${capture.pokemon.id}`}>
                    <p aria-hidden="true" className="review-bay-number">{dexNumber(capture.pokemon, dex)}</p>
                    <div className="review-lens">
                      <svg aria-hidden="true" className="review-brackets" preserveAspectRatio="none" viewBox="0 0 100 100">
                        <path d="M1 17V1H17M83 1H99V17M99 83V99H83M17 99H1V83" />
                      </svg>
                      <LabLensArt giant={capture.gigantamax === true} pokemon={capture.pokemon} shiny={dex.shiny}><i className={iconClass(capture.pokemon, dex)} /></LabLensArt>
                      {capture.sealed && <span className={classNames('review-stamp', { slam: stamping === capture.pokemon.id })}>{t('review.stamp')}</span>}
                    </div>
                    {/* a row each, every one its own height on every mon, filled or not */}
                    <div className="review-bay-info">
                      {/* the number before the name where the narrow window has no room to trace it behind the lens */}
                      <h2><span className="review-no">{dexNumber(capture.pokemon, dex)}</span><PokemonName name={capture.pokemon.name} nameJa={capture.pokemon.name_ja} /></h2>
                      <p className="review-types">
                        {capture.pokemon.types?.map((type) => (
                          <span className="review-type" key={type}>
                            <span className="type-glyph" style={{ backgroundColor: `var(--type-${type})`, maskImage: `url(/types/${type}.svg)` }} />
                            {t(`type.${type}`)}
                          </span>
                        ))}
                      </p>
                      <div className="review-pips" title={capture.captured && capture.status !== 'unobtainable' ? t('review.pips', { n: filled, total: pipFields.length }) : undefined}>
                        {capture.captured && capture.status !== 'unobtainable' &&
                          <>
                            {pipFields.map((field) => <span className={classNames('review-pip', { on: !missingIds.has(field.id) })} key={field.id} title={t(field.labelKey)} />)}
                            <span className="review-pips-count">{filled}/{pipFields.length}</span>
                          </>
                        }
                      </div>
                      {/* a sealed mon's unseal; an open record's release; in a HOME dex, a mon not yet marked its two
                          marks (an open record there is already temporary, and unobtainable can't be set on one with data) */}
                      <div className="review-acts">
                        {capture.sealed &&
                          <UnsealHold onUnseal={() => {
                            patch({ sealed: false });
                            touch(capture.pokemon.id, CONFIRMABLE_IDS);
                          }} />
                        }
                        {homeDex && releaseButton}
                        {homeDex && !capture.captured &&
                          <div className="review-marks">
                            {HOME_MARKS.map(({ status, icon, key }) => (
                              <button
                                className={classNames('review-mark', `status-${status}`, { default: status === 'caught' })}
                                key={status}
                                onClick={() => setStatus(status)}
                                type="button"
                              >
                                <FontAwesomeIcon icon={icon} />{t(`status.${status}`)}<kbd>{key}</kbd>
                              </button>
                            ))}
                          </div>
                        }
                        {!capture.sealed && !homeDex &&
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
                      </div>
                      <div className="review-acts">
                        {!homeDex && releaseButton}
                        {/* a sealed mon's place: its picture and name, moved from the menu a press (or S) opens */}
                        {capture.sealed &&
                          <button
                            className="review-place"
                            id="review-place"
                            onClick={openPlace}
                            title={t('review.placeMove')}
                            type="button"
                          >
                            <FieldVisual capture={capture} field={FIELD.get('location')!} homeDex={homeDex} saves={saves} />
                            <span className="review-place-text">{place ? placeLabel(place, saves, locale) : '—'}</span>
                            <kbd>S</kbd>
                          </button>
                        }
                      </div>
                    </div>
                  </section>
                  {/* kept from mon to mon, so a field's value changes where it stands and nothing comes in again */}
                  {sides.map((fields, side) => (
                    <div className={classNames('review-side', side === 0 ? 'left' : 'right')} key={`side-${side}`}>
                      {/* the card the four origin plates stand in where they're a save's (or a HOME entry's
                          trainer, or wait on a pick), behind them, its spine the save's colour */}
                      {side === 0 && soft.length > 0 &&
                        <div
                          aria-hidden="true"
                          className={classNames('review-cartridge', `mode-${origin.mode}`, { touchable: cardTouch.length > 0 })}
                          style={origin.save ? { '--rv-game': gameColor(origin.save.game) } as CSSProperties : undefined}
                        />
                      }
                      {fields.map((field, line) => plate(field, line))}
                    </div>
                  ))}
                </div>
              </div>
            )
            : <p className="review-empty">{t('review.empty')}</p>}
        </div>
      </div>
      <footer className="review-foot" style={{ zoom: scale }}>
        <button className="review-nav" disabled={index === 0} onClick={() => go(-1)} type="button">
          <FontAwesomeIcon icon={faArrowLeft} />{t('review.prev')}<kbd>Q</kbd>
        </button>
        {/* the species' pages */}
        {links &&
          <span className="review-links">
            <a href={links.bulbapedia} rel="noopener noreferrer" target="_blank">Bulbapedia<FontAwesomeIcon icon={faArrowUpRightFromSquare} /></a>
            <a href={links.serebii} rel="noopener noreferrer" target="_blank">Serebii<FontAwesomeIcon icon={faArrowUpRightFromSquare} /></a>
          </span>
        }
        <span className="review-spacer" />
        {sealable &&
          <button className="review-seal" onClick={seal} type="button">
            <FontAwesomeIcon icon={faLock} />{t('seal.action')}<kbd>{MOD_KEY}+Enter</kbd>
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
