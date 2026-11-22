import classNames from 'classnames';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowDown, faArrowUp, faFileImport, faGenderless, faHeart, faHouse, faIdCard, faMars, faTag, faUser, faVenus } from '@fortawesome/free-solid-svg-icons';

import { DateInput } from '../../library/DateInput';
import { DraftInput } from '../../library/DraftInput';
import { Dropdown } from '../../library/Dropdown';
import { LANGUAGE_ABBRS, NAME_MAX_FALLBACK, NATURES, ORIGIN_GAME_NAMES, ballOptions, favoriteOptions, formatFieldValue, genderOptions, languageOptions, locationOptions, nameLang, readFavorite, saveLabel } from '../../../utils/capture-fields';
import { MY_GAME_IDS, softFields } from '../../../utils/review-confirm';
import { CJK } from '../../../utils/game-rules';
import { NatureHex } from './face-pages';
import { OriginMark } from './seal-faces';
import { gameColor } from '../../../utils/game-colors';
import { inTraining } from '../../../utils/location-moves';
import { localizeNature, localizeOriginGame } from '../../../i18n/names';
import { natureStats } from '../../../utils/display-modes';
import { useTranslation } from '../../../hooks/use-translation';

import type { CSSProperties, ReactNode } from 'react';
import type { Capture, GameSave } from '../../../types';
import type { CaptureField } from '../../../utils/capture-fields';
import type { DropdownOption } from '../../library/Dropdown';
import type { OriginMode } from '../../../utils/review-confirm';
import type { RecordPatch } from './use-patch';

// the review's plates, each field in a spot of its own with a picture of its value beside it, so a wrong one
// shows at a glance; a menu's field opens a grid of pictures (balls, natures, games) right where it is

const NOT_MINE = 'not-my-game';
// a place in the one location picker: a game's save, or a checklist dex's HOME boxes (free-form dexes)
const IN_GAME = 'game:';
const IN_DEX = 'dex:';

const capitalized = (id: string) => id.charAt(0).toUpperCase() + id.slice(1);

// ---- the pictures

// a game as a chip in its box art's colour, its origin mark on it where it has one
export function GameChip ({ game }: { game: string | null | undefined }) {
  return (
    <span className={classNames('rv-chip', { empty: !game })} style={game ? { '--rv-game': gameColor(game) } as CSSProperties : undefined}>
      {game && <OriginMark game={game} />}
    </span>
  );
}

// the language as the summary tags it, JPN, ENG
export function LangTag ({ language }: { language: string | null | undefined }) {
  const abbr = language ? LANGUAGE_ABBRS.get(language) : null;
  return <span className={classNames('rv-lang', { empty: !abbr })}>{abbr ?? '···'}</span>;
}

function Glyph ({ icon, on = true, className }: { icon: typeof faUser; on?: boolean; className?: string }) {
  return <span className={classNames('rv-glyph', className, { off: !on })}><FontAwesomeIcon icon={icon} /></span>;
}

function MarkImage ({ mark, on }: { mark: 'champions' | 'gigantamax'; on: boolean }) {
  return <span className={classNames('rv-glyph', { off: !on })}><img alt="" className="rv-mark" src={`/marks/${mark}.png`} /></span>;
}

function BallSprite ({ ball }: { ball: string | null | undefined }) {
  if (!ball) {
    return <span className="rv-glyph"><span className="rv-ball-empty" /></span>;
  }
  if (ball === 'unknown') {
    return <span className="rv-glyph"><span className="ball-unknown">?</span></span>;
  }
  return <span className="rv-glyph"><img alt="" className="rv-ball" src={`/balls/${ball}.png`} /></span>;
}

// a calendar's leaf: the month across its top, the day under it
function DateLeaf ({ iso }: { iso: string | null | undefined }) {
  const [, month, day] = iso ? iso.split('-') : [];
  return (
    <span className={classNames('rv-leaf', { empty: !iso })}>
      <span className="rv-leaf-month">{month ? Number(month) : ''}</span>
      <span className="rv-leaf-day">{day ? Number(day) : ''}</span>
    </span>
  );
}

// the level as a ring, filled as far as it's come to 100; a mon out in a game (育成中) to its floor, the rest of its
// track broken, as it's still going up
const RING_R = 14;
const RING_C = 2 * Math.PI * RING_R;
function LevelRing ({ level, training = false }: { level: number | null | undefined; training?: boolean }) {
  const n = typeof level === 'number' ? Math.max(0, Math.min(100, level)) : 0;
  return (
    <svg aria-hidden="true" className={classNames('rv-ring', { empty: typeof level !== 'number', training })} viewBox="0 0 34 34">
      <circle className="rv-ring-track" cx="17" cy="17" r={RING_R} />
      {n > 0 && <circle className="rv-ring-fill" cx="17" cy="17" r={RING_R} strokeDasharray={`${(RING_C * n) / 100} ${RING_C}`} transform="rotate(-90 17 17)" />}
    </svg>
  );
}

// training as the tiles show it, a diamond: blue for perfect IVs, pink for EVs, hollow for none
function Diamond ({ trained }: { trained: string | null | undefined }) {
  return <span className="rv-glyph"><span className={classNames('rv-diamond', trained ?? 'unset')} /></span>;
}

// a favorite's heart as the tiles show it: blue, a partner's pink, faint for none
function Heart ({ favorite }: { favorite: unknown }) {
  const state = readFavorite(favorite);
  return <span className={classNames('rv-glyph rv-heart', state ?? 'unset')}><FontAwesomeIcon icon={faHeart} /></span>;
}

function GenderGlyph ({ gender }: { gender: string | null | undefined }) {
  if (gender === 'male' || gender === 'female' || gender === 'none') {
    return <Glyph className={`rv-gender ${gender}`} icon={gender === 'male' ? faMars : gender === 'female' ? faVenus : faGenderless} />;
  }
  return <span className="rv-glyph"><span className="rv-ball-empty" /></span>;
}

// the stats a nature moves, as Japanese players write them: the raised one red with an up mark, the lowered blue
export function NatureStats ({ nature }: { nature: string | null | undefined }) {
  const stats = natureStats(nature);
  if (!stats) {
    return null;
  }
  if (stats === 'neutral') {
    return <span className="rv-stats neutral">±</span>;
  }
  return (
    <span className="rv-stats">
      <span className="up">{stats.up}<FontAwesomeIcon icon={faArrowUp} /></span>
      <span className="down">{stats.down}<FontAwesomeIcon icon={faArrowDown} /></span>
    </span>
  );
}

function PlaceVisual ({ capture, saves }: { capture: Capture; saves: GameSave[] }) {
  if (capture.location === 'home') {
    return <Glyph className="rv-home" icon={faHouse} />;
  }
  if (capture.location === 'champions') {
    return <MarkImage mark="champions" on />;
  }
  if (capture.location === 'game') {
    return <GameChip game={saves.find((save) => save.id === capture.location_save)?.game} />;
  }
  return <GameChip game={null} />;
}

// each field's picture, drawn from the record as it stands (homeDex: whether a mon out in a game is still being raised)
export function FieldVisual ({ field, capture, saves, homeDex = false }: { field: CaptureField; capture: Capture; saves: GameSave[]; homeDex?: boolean }) {
  switch (field.id) {
    case 'origin_game':
      return <GameChip game={capture.origin_game} />;
    case 'language':
      return <LangTag language={capture.language} />;
    case 'ot':
      return <Glyph icon={faUser} on={Boolean(capture.ot)} />;
    case 'tid':
      return <Glyph icon={faIdCard} on={Boolean(capture.tid)} />;
    case 'been_to_champions':
      return <MarkImage mark="champions" on={capture.been_to_champions === true} />;
    case 'gigantamax':
      return <MarkImage mark="gigantamax" on={capture.gigantamax === true} />;
    case 'location':
      return <PlaceVisual capture={capture} saves={saves} />;
    case 'ball':
      return <BallSprite ball={capture.ball} />;
    case 'catch_date':
      return <DateLeaf iso={capture.catch_date} />;
    case 'gender':
      return <GenderGlyph gender={capture.gender} />;
    case 'nature':
      return <span className={classNames('rv-glyph rv-hex', { empty: !natureStats(capture.nature) })}><NatureHex capture={capture} /></span>;
    case 'nickname':
      return <Glyph icon={faTag} on={capture.has_nickname === true} />;
    case 'level':
      return <span className="rv-glyph"><LevelRing level={capture.level} training={inTraining(capture, homeDex)} /></span>;
    case 'trained':
      return <Diamond trained={capture.trained} />;
    case 'favorite':
      return <Heart favorite={capture.favorite} />;
    default:
      return null;
  }
}

// a field's value as text beside its picture, as a sealed record shows it: a mon out in a game's level as 育成中 and
// the floor it's kept (inTraining)
export function FieldText ({ field, capture, saves, homeDex = false }: { field: CaptureField; capture: Capture; saves: GameSave[]; homeDex?: boolean }) {
  const { t, locale } = useTranslation();
  const training = field.id === 'level' && inTraining(capture, homeDex);
  const text = training ? levelText(capture.level, t) : formatFieldValue(field, capture, locale, saves);
  const blank = !training && text === t('common.unspecified');
  // a name is set in its own script's size, whatever the page's language
  const name = field.id === 'ot' ? capture.ot : field.id === 'nickname' && capture.has_nickname ? capture.nickname : null;
  return (
    <span className={classNames('rv-text', { blank })} lang={name ? nameLang(name, capture.language) : undefined}>
      {field.id === 'level' && !blank && !training && <span className="rv-lv">Lv.</span>}
      {text}
      {field.id === 'nature' && <NatureStats nature={capture.nature} />}
    </span>
  );
}

// 育成中 with the last level confirmed as its floor, or none
export const levelText = (level: number | null | undefined, t: ReturnType<typeof useTranslation>['t']) =>
  (typeof level === 'number' ? t('level.trainingFloor', { n: level }) : t('level.trainingUnknown'));

// ---- what a field's options show in its menu, a picture before each

function optionPicture (field: CaptureField, option: DropdownOption): ReactNode {
  if (option.value === '') {
    return null;
  }
  switch (field.id) {
    case 'origin_game':
      return <GameChip game={option.value} />;
    case 'language':
      return <LangTag language={option.value} />;
    case 'ball':
      return <BallSprite ball={option.value} />;
    case 'gender':
      return <GenderGlyph gender={option.value} />;
    case 'trained':
      return <Diamond trained={option.value} />;
    case 'favorite':
      return <Heart favorite={option.value} />;
    case 'been_to_champions':
      return <MarkImage mark="champions" on={option.value === 'yes'} />;
    case 'gigantamax':
      return <MarkImage mark="gigantamax" on={option.value === 'yes'} />;
    default:
      return null;
  }
}

function renderOptionFor (field: CaptureField) {
  return function renderOption (option: DropdownOption) {
    return (
      <>
        {optionPicture(field, option)}
        <span className="rv-opt-text">{option.label}</span>
        {field.id === 'nature' && <NatureStats nature={option.value} />}
      </>
    );
  };
}

// how a picker lays out: the balls and the natures as the games' own grids, the rest a few across
const GRID: Partial<Record<CaptureField['id'], { columns: number; maxHeight?: number }>> = {
  origin_game: { columns: 4, maxHeight: 440 },
  language: { columns: 3 },
  ball: { columns: 8, maxHeight: 520 },
  nature: { columns: 5, maxHeight: 330 },
  trained: { columns: 3 },
  favorite: { columns: 3 },
  been_to_champions: { columns: 2 },
  gigantamax: { columns: 2 },
};
// a narrow window's grids: a column fewer where a whole one wouldn't fit across it, the games' four slimmer ones, so
// every grid opens whole, never scrolled
const NARROW_COLUMNS: Partial<Record<CaptureField['id'], number>> = { ball: 7 };

// ---- the controls of a record still open. One look, the values' pictures and grids, every field a field
// of its own: a menu's field is a box around its value beside its picture, as wide as its longest value, so it never moves
// as the value changes and a press beside it is a press on the plate, never on the box; a typed field is a line under
// what's typed, as wide as what it takes, there whether it's pointed at or not

// how wide a typed field is, in the font's digit widths: its longest, an ID No.'s five or six digits, a name's
// letters, a Japanese, Korean or Chinese one's characters twice as wide
const fieldChars = (field: CaptureField, capture: Capture) => (field.maxLength?.(capture) ?? NAME_MAX_FALLBACK) *
  (field.id !== 'tid' && CJK.has(capture.language ?? '') ? 2 : 1);

// a box's text: the value shown, and every value it can show laid unseen under it, so the box is as wide as the longest
function BoxText ({ shown, blank, sizes }: { shown: ReactNode; blank: boolean; sizes: ReactNode[] }) {
  return (
    <span className="rv-box-text">
      <span className={classNames('rv-text', { blank })}>{shown}</span>
      {sizes.map((size, index) => <span aria-hidden="true" className="rv-text rv-box-size" key={index}>{size}</span>)}
    </span>
  );
}

interface ControlProps {
  field: CaptureField;
  capture: Capture;
  saves: GameSave[];
  homeDex: boolean;
  canVisitChampions: boolean;
  // a free-form dex's HOME mons can sit in one of the checklist dexes' boxes
  free: boolean;
  checklists: { id: string; title: string }[];
  onChange: (changes: RecordPatch) => void;
  recentDates?: string[];
  onRecentPicked?: (keyboard: boolean) => void;
  // a narrow window, whose pickers are a column or two fewer
  narrow: boolean;
}

export function FieldControl ({ field, capture, saves, homeDex, canVisitChampions, free, checklists, onChange, recentDates, onRecentPicked, narrow }: ControlProps) {
  const { t, locale } = useTranslation();
  const id = `review-${field.id}`;
  const unspecified = t('common.unspecified');
  const picture = <FieldVisual capture={capture} field={field} saves={saves} />;

  // a menu's field: its picture, then its box; the nature's stats with its name, in the box and in the menu
  const dropdown = (props: { value: string; options: DropdownOption[]; onSelect: (next: string) => void; text?: ReactNode }) => {
    const grid = GRID[field.id];
    const named = (label: string, value: string) => (field.id === 'nature' ? <>{label}<NatureStats nature={value} /></> : label);
    return (
      <>
        {picture}
        <Dropdown
          columns={(narrow ? NARROW_COLUMNS[field.id] : undefined) ?? grid?.columns ?? 2}
          id={id}
          maxHeight={grid?.maxHeight}
          menuClassName={classNames('rv-menu', `rv-menu-${field.id}`, 'rv-grid')}
          onSelect={props.onSelect}
          options={props.options}
          renderOption={renderOptionFor(field)}
          renderValue={(option) => (
            <BoxText
              blank={!option && !props.text}
              shown={props.text ?? (option ? named(option.label, option.value) : unspecified)}
              sizes={[unspecified, ...props.options.map((entry) => named(entry.label, entry.value))]}
            />
          )}
          triggerClassName="rv-box"
          value={props.value}
        />
      </>
    );
  };

  switch (field.kind) {
    case 'select': {
      const key = field.keys[0];
      if (field.id === 'favorite') {
        const favorites = favoriteOptions(locale, capture);
        const stored = capture.favorite;
        const current = stored === null || stored === undefined || readFavorite(stored) === null || favorites.some((option) => option.value === stored)
          ? String(stored ?? '')
          : favorites[0].value;
        return dropdown({ value: current, options: favorites, onSelect: (next) => onChange({ favorite: next as Capture['favorite'] }) });
      }
      let options: DropdownOption[];
      if (field.id === 'gender') {
        options = genderOptions(locale, capture.pokemon.gender_lock);
      } else if (field.id === 'ball') {
        // the balls its origin game holds
        options = ballOptions(locale, capture);
      } else if (field.id === 'language') {
        options = languageOptions(locale, capture);
      } else if (field.id === 'nature') {
        // the games' own grid: each row raises one stat and each column lowers one, the neutral five down the diagonal
        options = NATURES.map((nature) => ({ value: nature, label: localizeNature(locale, nature, capitalized(nature)) }));
      } else {
        options = field.options!(locale);
      }
      return dropdown({ value: String(capture[key] ?? ''), options, onSelect: (next) => onChange({ [key]: next || null }) });
    }

    case 'yesno': {
      const key = field.keys[0];
      const current = capture[key] === true ? 'yes' : capture[key] === false ? 'no' : '';
      return dropdown({
        value: current,
        options: [{ value: 'yes', label: t('common.yes') }, { value: 'no', label: t('common.no') }],
        onSelect: (next) => onChange({ [key]: next === 'yes' }),
      });
    }

    case 'text':
      return (
        <>
          {picture}
          <DraftInput
            id={id}
            inputMode={field.numeric ? 'numeric' : undefined}
            maxLength={field.maxLength?.(capture) ?? 100}
            name={id}
            onCommit={(raw) => onChange({ [field.keys[0]]: (field.normalize ? field.normalize(raw) : raw.trim()) || null })}
            placeholder={unspecified}
            style={{ '--chars': fieldChars(field, capture) } as CSSProperties}
            type="text"
            value={(capture[field.keys[0]] as string) || ''}
          />
        </>
      );

    case 'number': {
      const key = field.keys[0];
      const committed = capture[key] as number | null | undefined;
      return (
        <>
          {picture}
          <span className="rv-number">
            <span className="rv-lv">Lv.</span>
            <DraftInput
              id={id}
              inputMode="numeric"
              name={id}
              onCommit={(raw) => {
                const parsed = parseInt(raw, 10);
                onChange({ [key]: isNaN(parsed) ? null : Math.min(field.max ?? Infinity, Math.max(field.min ?? -Infinity, parsed)) });
              }}
              sanitize={(raw) => raw.normalize('NFKC').replace(/\D/g, '').slice(0, String(field.max ?? 999).length)}
              type="text"
              value={typeof committed === 'number' ? String(committed) : ''}
            />
          </span>
        </>
      );
    }

    case 'date':
      return (
        <>
          {picture}
          <div className="rv-date">
            <DateInput id={id} onChange={(iso) => onChange({ catch_date: iso })} onRecentPicked={onRecentPicked} recent={recentDates} value={capture.catch_date ?? null} />
          </div>
        </>
      );

    case 'location': {
      // one picker for every place: HOME (and, in a free-form dex, a checklist's boxes there), Champions, each game
      const places = locationOptions(locale, capture, homeDex, canVisitChampions);
      const yours = saves.filter((save) => save.game !== 'home' || save.id === capture.location_save);
      const options: DropdownOption[] = [];
      for (const place of places) {
        if (place.value === 'game') {
          options.push(...yours.map((save) => ({ value: `${IN_GAME}${save.id}`, label: saveLabel(save, locale, saves) })));
        } else {
          options.push(place);
          if (place.value === 'home' && free) {
            options.push(...checklists.map((list) => ({ value: `${IN_DEX}${list.id}`, label: `${place.label} · ${list.title}` })));
          }
        }
      }
      const current = capture.location === 'game'
        ? `${IN_GAME}${capture.location_save ?? ''}`
        : capture.location === 'home' && free && capture.location_save ? `${IN_DEX}${capture.location_save}` : capture.location ?? '';
      return (
        <>
          {picture}
          <Dropdown
            columns={3}
            id={id}
            maxHeight={440}
            menuClassName="rv-menu rv-menu-location rv-grid"
            onSelect={(next) => {
              if (next.startsWith(IN_GAME)) {
                onChange({ location: 'game', location_save: next.slice(IN_GAME.length) });
              } else if (next.startsWith(IN_DEX)) {
                onChange({ location: 'home', location_save: next.slice(IN_DEX.length) });
              } else {
                onChange({ location: (next || null) as Capture['location'] });
              }
            }}
            options={options}
            renderOption={(option) => (
              <>
                {option.value.startsWith(IN_GAME)
                  ? <GameChip game={saves.find((save) => `${IN_GAME}${save.id}` === option.value)?.game} />
                  : option.value === 'champions' ? <MarkImage mark="champions" on /> : <Glyph className="rv-home" icon={faHouse} />}
                <span className="rv-opt-text">{option.label}</span>
              </>
            )}
            renderValue={(option) => (
              <BoxText
                blank={!capture.location}
                shown={option?.label ?? (capture.location === 'game' ? `${t('location.game')} · ${t('location.whichGame')}` : unspecified)}
                sizes={[unspecified, ...options.map((entry) => entry.label)]}
              />
            )}
            triggerClassName="rv-box"
            value={current}
          />
        </>
      );
    }

    case 'nickname': {
      const named = capture.has_nickname === true;
      const toggle = () => onChange({ has_nickname: !named, nickname: named ? null : capture.nickname ?? null });
      return (
        <>
          <button aria-pressed={named} className={classNames('rv-toggle', { on: named })} id={id} onClick={toggle} title={t('info.nickname')} type="button">
            <FieldVisual capture={capture} field={field} saves={saves} />
          </button>
          {named
            ? (
              <DraftInput
                id={`${id}-text`}
                maxLength={field.maxLength?.(capture) ?? NAME_MAX_FALLBACK}
                name={`${id}-text`}
                onCommit={(raw) => onChange({ nickname: raw.trim() || null })}
                placeholder={t('info.nickname')}
                style={{ '--chars': fieldChars(field, capture) } as CSSProperties}
                type="text"
                value={capture.nickname || ''}
              />
            )
            : <span className={classNames('rv-text', { blank: capture.has_nickname !== false })}>{capture.has_nickname === false ? t('common.no') : unspecified}</span>}
        </>
      );
    }

    default:
      return null;
  }
}

// ---- My Game, the soft: only a way in, never part of the record, and the one way the four it fills
// change while they're its. A pick of one of your saves fills the game, the language, the OT and the ID No. at once (the
// ID No., large in its row, the sign it took); a HOME entry fills its trainer alone, the game the mark's, kept where the
// record has one and asked where it hasn't; Not my game clears what a save filled and leaves the four to the hand. Drawn
// as the card's first row where the four are (or wait on) a save's, the game's chip and a box as any menu's field has, a
// press on the row beside it touching the card as a plate's does; where the game's picked apart (a HOME gift, a record by
// hand), a box at the end of the game's row. Its grid ticks the save the record's four are (or the HOME entry its trainer
// is)

interface SoftProps {
  capture: Capture;
  saves: GameSave[];
  // the record's: the save it's all four of (or the HOME entry it's the trainer of), or by hand, or nothing yet
  mode: OriginMode;
  save?: GameSave;
  size: 'card' | 'compact';
  // what's written, the fields it touches, and whether the record's now by hand
  onPick: (changes: RecordPatch, touched: string[], manual: boolean) => void;
}

export function SoftBox ({ capture, saves, mode, save, size, onPick }: SoftProps) {
  const { t, locale } = useTranslation();
  const current = save ? save.id : mode === 'manual' ? NOT_MINE : '';
  const options: DropdownOption[] = [
    ...saves.map((entry) => ({ value: entry.id, label: saveLabel(entry, locale, saves) })),
    { value: NOT_MINE, label: t('saves.notMine') },
  ];
  const pick = (next: string) => {
    if (next === NOT_MINE) {
      // kept by hand: an answer still, which the review goes on from; from a save, what it filled is cleared
      onPick(mode === 'manual' || mode === 'empty' ? {} : { origin_game: null, language: null, ot: null, tid: null }, [], true);
      return;
    }
    const entry = saves.find((option) => option.id === next);
    if (entry?.game === 'home') {
      const kept = capture.origin_game && capture.origin_game !== 'home' ? capture.origin_game : null;
      onPick({ origin_game: kept, language: entry.language, ot: entry.ot, tid: entry.tid ?? null }, softFields('gift'), false);
    } else if (entry) {
      onPick({ origin_game: entry.game, language: entry.language, ot: entry.ot, tid: entry.tid ?? null }, MY_GAME_IDS, false);
    }
  };
  const gameName = (id: string) => localizeOriginGame(locale, id, ORIGIN_GAME_NAMES.get(id) ?? id);
  const game = save?.game ?? null;
  const name = game ? gameName(game) : null;
  return (
    <div className={classNames('rv-soft', size, `mode-${mode}`)} style={game ? { '--rv-game': gameColor(game) } as CSSProperties : undefined}>
      {size === 'card' && <GameChip game={game} />}
      <Dropdown
        align={size === 'card' ? 'start' : 'end'}
        columns={3}
        id="review-save"
        maxHeight={440}
        menuClassName="rv-menu rv-menu-saves rv-grid"
        onSelect={pick}
        options={options}
        renderOption={(option) => {
          const entry = saves.find((candidate) => candidate.id === option.value);
          if (!entry) {
            return <span className="rv-opt-text">{option.label}</span>;
          }
          return (
            <>
              <GameChip game={entry.game} />
              <span className="rv-save">
                <span className="rv-save-game">
                  {gameName(entry.game)}
                  <LangTag language={entry.language} />
                </span>
                <span className="rv-save-trainer">{entry.ot}{entry.tid ? ` · ${entry.tid}` : ''}</span>
              </span>
            </>
          );
        }}
        renderValue={() => (size === 'card'
          ? <BoxText blank={!name} shown={name ?? t('review.softPick')} sizes={[t('review.softPick'), ...new Set(saves.map((entry) => gameName(entry.game)))]} />
          : (
            <span className="rv-soft-face">
              {game ? <GameChip game={game} /> : <FontAwesomeIcon icon={faFileImport} />}
              <span className="rv-soft-name">{name ?? t('review.fillFromGame')}</span>
            </span>
          ))}
        triggerClassName={size === 'card' ? 'rv-box' : 'rv-soft-box'}
        value={current}
      />
    </div>
  );
}
