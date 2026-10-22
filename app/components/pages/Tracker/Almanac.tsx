import classNames from 'classnames';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { createPortal } from 'react-dom';
import { faCrown, faDumbbell, faGift, faHeart, faLock, faSignature, faWandMagicSparkles, faXmark } from '@fortawesome/free-solid-svg-icons';
import { useEffect, useId, useLayoutEffect, useMemo, useRef } from 'react';

import { BALL_NAMES, LANGUAGE_ABBRS, ORIGIN_GAME_NAMES } from '../../../utils/capture-fields';
import { OriginMark } from './seal-faces';
import { TitleCard, useTitleCard } from './TitleCard';
import { PokemonName, displayName } from '../../library/PokemonName';
import { almanacData } from './almanac-data';
import { iconClass } from '../../../utils/pokemon';
import { localizeBall, localizeOriginGame } from '../../../i18n/names';
import { locationTint, placeLabel as placeLabelOf, placeFromKey } from '../../../utils/location-moves';
import { useDexContext } from '../../../hooks/contexts/use-dex-context';
import { useInertPage } from '../../../hooks/use-inert-page';
import { useSceneScale } from './use-scene-scale';
import { useTrackerState } from './use-tracker';
import { useTranslation } from '../../../hooks/use-translation';

import type { CSSProperties, ReactNode, RefObject } from 'react';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import type { Capture, Dex } from '../../../types';
import type { FacetId } from './filters';
import type { Milestone, MonthCount, StatusCounts, Tally } from './almanac-data';
import type { TranslationKey } from '../../../i18n/translations';

// the entrance: the cards land one after another, and as each lands its numbers count up on one clock with what draws
// them (useEntrance), a ring round, a bar along, a month up, so each number finishes with its fill
const CARD_DELAY = 120;
const CARD_STAGGER = 70;
// a card's counting starts this long after it starts to land
const COUNT_AFTER = 120;
const COUNT_MS = 900;
// a wave along a card's rows, rings or months, each this long after the last, the whole wave held to a spread
const WAVE_STEP = 35;
const WAVE_SPREAD = 450;
const MONTH_SPREAD = 650;
// the milestones' line draws across a stop at a time, each mon dropping onto it as the line reaches it
const STOP_MS = 160;
// the first month's year is marked under it unless it falls after this, too close to the next January's
const FIRST_YEAR_BY = 9;
// a list longer than this takes two of the records' columns, its rows in two columns of their own
const LONG_LIST = 14;
// English's 1st, 2nd, 3rd and the rest; Japanese has the one form
const ORDINAL_KEYS: Partial<Record<Intl.LDMLPluralRule, TranslationKey>> = { one: 'almanac.nth.one', two: 'almanac.nth.two', few: 'almanac.nth.few' };

const pct = (part: number, whole: number) => (whole > 0 ? (100 * part) / whole : 0);
// when a card starts to land, and when its numbers start counting
const land = (card: number) => CARD_DELAY + card * CARD_STAGGER;
const counted = (card: number) => land(card) + COUNT_AFTER;
const wave = (i: number, n: number, spread = WAVE_SPREAD) => Math.round(i * Math.min(WAVE_STEP, spread / Math.max(1, n - 1)));

// the entrance's one clock. Everything marked data-at (ms after the scene opens) rises from nothing over COUNT_MS on
// one curve: a count's text (data-count, to data-decimals places) and a fill's --p (a ring's arc, a bar's length, a
// month's height) alike. A count takes its fill's data-at, so the two land together. The text goes into React's own
// node, and only what changed is written. While the scene's title card is up (intro) all of it waits at nothing, the
// clock starting as the card's about to clear
function useEntrance (sceneRef: RefObject<HTMLElement>, intro: boolean) {
  useLayoutEffect(() => {
    const items = [...sceneRef.current!.querySelectorAll<HTMLElement | SVGElement>('[data-at]')].map((el) => ({
      el,
      at: Number(el.dataset.at),
      count: el.dataset.count === undefined ? null : Number(el.dataset.count),
      decimals: Number(el.dataset.decimals ?? 0),
      shown: '',
    }));
    const start = intro ? Infinity : performance.now();
    let frame = 0;
    const paint = (now: number) => {
      let running = false;
      for (const item of items) {
        const t = Math.min(1, Math.max(0, (now - start - item.at) / COUNT_MS));
        running ||= t < 1;
        const p = 1 - (1 - t) ** 3;
        const shown = item.count === null ? String(p) : (item.count * p).toFixed(item.decimals);
        if (shown !== item.shown) {
          item.shown = shown;
          if (item.count === null) {
            item.el.style.setProperty('--p', shown);
          } else if (item.el.firstChild) {
            item.el.firstChild.nodeValue = shown;
          }
        }
      }
      if (running && !intro) {
        frame = requestAnimationFrame(paint);
      }
    };
    paint(performance.now());
    return () => cancelAnimationFrame(frame);
  }, [sceneRef, intro]);
}

// the records' cards packed into the grid's columns as tightly as their heights allow: each spans as many of its 1px
// rows as it's tall with the gap under it, and the grid sets it in the first column with room. It follows a card's
// height as it changes (a narrower column, the other language)
function useMasonry (gridRef: RefObject<HTMLElement>) {
  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid) {
      return undefined;
    }
    const cards = [...grid.children] as HTMLElement[];
    const fit = () => {
      const gap = parseFloat(getComputedStyle(grid).columnGap) || 0;
      for (const card of cards) {
        card.style.gridRowEnd = `span ${Math.ceil(card.getBoundingClientRect().height / card.currentCSSZoom + gap)}`;
      }
    };
    fit();
    const observer = new ResizeObserver(fit);
    cards.forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, [gridRef]);
}

// a number the entrance counts up to with its fill, at its value as it renders, its box as wide as the value from the
// start (--digits, --point), so nothing beside it shifts and no line rewraps as it counts
function Count ({ value, at, decimals = 0 }: { value: number; at: number; decimals?: number }) {
  const text = value.toFixed(decimals);
  return (
    <span
      className="almanac-count"
      data-at={at}
      data-count={value}
      data-decimals={decimals || undefined}
      style={{ '--digits': text.length - (decimals > 0 ? 1 : 0), '--point': decimals > 0 ? 1 : 0 } as CSSProperties}
    >
      {text}
    </span>
  );
}

// a ring over its track, filled clockwise from the top in its segments' colours, drawn round with its count (--p)
// by a mask that goes as far as the segments do
function Ring ({ segments, total, size, stroke, at }: { segments: [color: string, n: number][]; total: number; size: number; stroke: number; at: number }) {
  const mask = useId();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const filled = segments.reduce((sum, [, n]) => sum + n, 0);
  let offset = 0;
  return (
    <svg
      className="almanac-ring"
      data-at={at}
      height={size}
      style={{ '--ring-c': c, '--ring-share': total > 0 ? filled / total : 0 } as CSSProperties}
      viewBox={`0 0 ${size} ${size}`}
      width={size}
    >
      <defs>
        <mask id={mask}>
          <circle className="almanac-ring-reveal" cx={size / 2} cy={size / 2} fill="none" r={r} stroke="white" strokeDasharray={c} strokeWidth={stroke + 2} />
        </mask>
      </defs>
      <circle className="almanac-ring-track" cx={size / 2} cy={size / 2} fill="none" r={r} strokeWidth={stroke} />
      <g mask={`url(#${mask})`}>
        {segments.map(([color, n]) => {
          const length = total > 0 ? (c * n) / total : 0;
          const segment = (
            <circle
              cx={size / 2}
              cy={size / 2}
              fill="none"
              key={color}
              r={r}
              strokeDasharray={`${length} ${c - length}`}
              strokeDashoffset={-offset}
              strokeWidth={stroke}
              style={{ stroke: color }}
            />
          );
          offset += length;
          return segment;
        })}
      </g>
    </svg>
  );
}

// a ring's segments for the statuses, in their order round it
const statusSegments = (counts: StatusCounts): [string, number][] => [
  ['var(--status-caught)', counts.caught],
  ['var(--status-temporary)', counts.temporary],
  ['var(--status-unobtainable)', counts.unobtainable],
];

// a bar of the statuses across a total, grown from its start with its count (--p)
function StatusBar ({ counts, at }: { counts: StatusCounts; at: number }) {
  return (
    <span className="almanac-bar">
      <span className="almanac-bar-fill" data-at={at}>
        <span className="seg-caught" style={{ width: `${pct(counts.caught, counts.total)}%` }} />
        <span className="seg-temporary" style={{ width: `${pct(counts.temporary, counts.total)}%` }} />
        <span className="seg-unobtainable" style={{ width: `${pct(counts.unobtainable, counts.total)}%` }} />
      </span>
    </span>
  );
}

interface CardProps {
  index: number;
  title: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

// a card under its banner, landing in its turn (--i)
function Card ({ index, title, className, style, children }: CardProps) {
  return (
    <section className={classNames('almanac-card', className)} style={{ ...style, '--i': index } as CSSProperties}>
      <h2><span>{title}</span></h2>
      {children}
    </section>
  );
}

// one of the collection's counts: its label over its figure, a slanted chip of its colour before them
function Stat ({ label, value, of, at, icon, className }: { label: string; value: number; of?: number; at: number; icon?: IconDefinition; className?: string }) {
  return (
    <div className={classNames('almanac-stat', className)}>
      <dt>{icon && <FontAwesomeIcon icon={icon} />}{label}</dt>
      <dd><Count at={at} value={value} />{of !== undefined && <small> / {of}</small>}</dd>
    </div>
  );
}

// a row that filters the dex to what it counts when pressed, as the Filters panel would: its label, a bar against the
// most, the count growing with it. A list with icons keeps their place for a value without one (HOME as an origin
// has no mark), so the labels line up
function TallyRow ({ label, icon, count, max, at, onPick }: { label: ReactNode; icon?: ReactNode; count: number; max: number; at: number; onPick: () => void }) {
  return (
    <button className="almanac-tally" onClick={onPick} type="button">
      <span className="almanac-tally-label">
        {icon !== undefined && <span className="almanac-tally-icon">{icon}</span>}
        <span className="almanac-tally-text">{label}</span>
      </span>
      <span className="almanac-tally-bar"><span data-at={at} style={{ width: `${pct(count, max)}%` }} /></span>
      <span className="almanac-tally-count"><Count at={at} value={count} /></span>
    </button>
  );
}

// a stop on the milestones' line: which catch it was, the mon dropping onto the line as it draws through (--d), its
// name and day
function MilestoneStop ({ milestone, dex, label, drop, onLocate }: { milestone: Milestone; dex: Dex; label: string; drop: number; onLocate: (id: number) => void }) {
  const { capture } = milestone;
  return (
    <li style={{ '--d': drop } as CSSProperties}>
      <button className={classNames('almanac-milestone', { latest: milestone.latest })} onClick={() => onLocate(capture.pokemon.id)} type="button">
        <span className="almanac-milestone-n">{label}</span>
        <span className="almanac-milestone-mon"><i className={iconClass(capture.pokemon, dex)} /></span>
        <span className="almanac-milestone-name"><PokemonName name={capture.pokemon.name} nameJa={capture.pokemon.name_ja} /></span>
        <span className="almanac-milestone-date">{capture.catch_date?.replaceAll('-', '/')}</span>
      </button>
    </li>
  );
}

// one of the latest catches: the mon dropping in (--d) and its day, going to its tile when pressed
function LatelyMon ({ capture, dex, drop, onLocate }: { capture: Capture; dex: Dex; drop: number; onLocate: (id: number) => void }) {
  const { locale } = useTranslation();
  const date = capture.catch_date!;
  return (
    <button
      onClick={() => onLocate(capture.pokemon.id)}
      style={{ '--d': drop } as CSSProperties}
      title={`${displayName(capture.pokemon.name, capture.pokemon.name_ja, locale)} ${date.replaceAll('-', '/')}`}
      type="button"
    >
      <span className="almanac-lately-mon"><i className={iconClass(capture.pokemon, dex)} /></span>
      <span className="almanac-lately-date">{date.slice(5).replace('-', '/')}</span>
    </button>
  );
}

interface Props {
  onClose: () => void;
  // a value pressed in the almanac: the dex filtered to it as the almanac closes
  onFilter: (facet: FacetId, value: string) => void;
  // a milestone or a recent catch pressed: its tile, as a mon pressed on the timeline goes to one
  onLocate: (pokemon: number) => void;
}

// the dex counted every way its records allow, as a scene of its own over the window: how much is marked and how, by
// generation and by type across the top; then every value its sealed records hold, all of them, packed into columns:
// where the mons came from and what they're in, who caught them, where they are now; then when, and the latest
// catches. A bar or a value pressed filters the dex to it
export function Almanac ({ onClose, onFilter, onLocate }: Props) {
  const { captures } = useTrackerState();
  const { activeDex, activeDexView, saves } = useDexContext();
  const { t, locale } = useTranslation();
  const data = useMemo(() => almanacData(captures), [captures]);
  const sceneRef = useRef<HTMLDivElement>(null);
  const recordsRef = useRef<HTMLDivElement>(null);
  const checklist = Boolean(activeDex?.checklist);
  const dex = activeDexView!;
  // the grid scaled up to a wider window (use-scene-scale)
  const scale = useSceneScale();
  // its title card as it opens, what's under the bar out of sight (intro) till the card's about to clear
  const { titleCard, intro, gate } = useTitleCard();

  useInertPage();
  useEntrance(sceneRef, intro);
  useMasonry(recordsRef);

  useEffect(() => {
    sceneRef.current?.querySelector<HTMLElement>('.almanac-body')?.focus({ preventScroll: true });
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  }, [onClose]);

  const monthYear = useMemo(() => {
    const format = new Intl.DateTimeFormat(locale === 'ja' ? 'ja-JP' : 'en-US', { year: 'numeric', month: 'short' });
    return (entry: MonthCount) => format.format(new Date(entry.year, entry.month - 1, 1));
  }, [locale]);

  const ordinal = useMemo(() => {
    const rules = new Intl.PluralRules(locale === 'ja' ? 'ja-JP' : 'en-US', { type: 'ordinal' });
    return (n: number) => t(ORDINAL_KEYS[rules.select(n)] ?? 'almanac.nth.other', { n });
  }, [locale, t]);

  const { all } = data;
  const missing = all.total - all.marked;
  const pick = (facet: FacetId, value: string) => () => onFilter(facet, value);
  let card = 0;

  const placeLabel = (key: string) => placeLabelOf(placeFromKey(key), saves, locale);
  const maxMonth = Math.max(1, ...data.months.map((entry) => entry.count));

  const cards: ReactNode[] = [];

  // how much is marked, and how
  const hero = card++;
  const heroAt = counted(hero);
  cards.push(
    <Card className="almanac-hero" index={hero} key="hero" title={t('almanac.collection')}>
      <div className="almanac-hero-body">
        <div className="almanac-hero-ring">
          <Ring at={heroAt} segments={statusSegments(all)} size={240} stroke={22} total={all.total} />
          <div className="almanac-hero-percent">
            <strong><Count at={heroAt} decimals={1} value={pct(all.marked, all.total)} /><small>%</small></strong>
            <span>{t('almanac.complete')}</span>
          </div>
        </div>
        <dl className="almanac-stats">
          <Stat at={heroAt} label={t('almanac.marked')} of={all.total} value={all.marked} />
          <Stat at={heroAt} className="seg-missing" label={t('almanac.missing')} value={missing} />
          {!checklist && <Stat at={heroAt} className="almanac-stat-sealed" icon={faLock} label={t('almanac.sealed')} value={all.sealed} />}
          <Stat at={heroAt} className="seg-caught" label={t('status.caught')} value={all.caught} />
          <Stat at={heroAt} className="seg-temporary" label={t('status.temporary')} value={all.temporary} />
          <Stat at={heroAt} className="seg-unobtainable" label={t('status.unobtainable')} value={all.unobtainable} />
        </dl>
      </div>
    </Card>,
  );

  // by generation
  const gens = card++;
  cards.push(
    <Card className="almanac-gens" index={gens} key="gens" title={t('almanac.generations')}>
      <div className="almanac-rows">
        {data.generations.map((gen, i) => {
          const at = counted(gens) + wave(i, data.generations.length);
          return (
            <button className="almanac-row" key={gen.generation} onClick={pick('generation', String(gen.generation))} type="button">
              <span className="almanac-row-label">{t('filter.gen', { n: gen.generation })}</span>
              <StatusBar at={at} counts={gen} />
              <span className="almanac-row-count"><Count at={at} value={gen.marked} /><small>/{gen.total}</small></span>
            </button>
          );
        })}
      </div>
    </Card>,
  );

  // by type, a ring each in its type's colour
  const types = card++;
  cards.push(
    <Card className="almanac-types-card" index={types} key="types" title={t('almanac.types')}>
      <div className="almanac-types">
        {data.types.map((entry, i) => {
          const at = counted(types) + wave(i, data.types.length);
          const color = `var(--type-${entry.type})`;
          return (
            <button className="almanac-type" key={entry.type} onClick={pick('type', entry.type)} title={`${t(`type.${entry.type}`)} ${entry.marked}/${entry.total}`} type="button">
              <span className="almanac-type-ring">
                <Ring at={at} segments={[[color, entry.marked]]} size={60} stroke={7} total={entry.total} />
                <span className="type-glyph" style={{ backgroundColor: color, maskImage: `url(/types/${entry.type}.svg)` }} />
              </span>
              <span className="almanac-type-name">{t(`type.${entry.type}`)}</span>
              <span className="almanac-type-count"><Count at={at} value={Math.round(pct(entry.marked, entry.total))} />%</span>
            </button>
          );
        })}
      </div>
    </Card>,
  );

  if (!checklist) {
    // every value the sealed records hold, packed into columns (useMasonry)
    const records: ReactNode[] = [];
    // a list of rows, its counts' column as wide as its largest (the first) needs
    const tallies = (index: number, entries: Tally[], row: (entry: Tally, at: number, max: number) => ReactNode, empty: string) => (
      <div className="almanac-tallies" style={{ '--tally-digits': String(entries[0]?.count ?? 0).length } as CSSProperties}>
        {entries.map((entry, i) => row(entry, counted(index) + wave(i, entries.length), entries[0].count))}
        {entries.length === 0 && <p className="almanac-empty">{empty}</p>}
      </div>
    );

    // where they came from
    const origins = card++;
    records.push(
      <Card className={classNames({ long: data.origins.length > LONG_LIST })} index={origins} key="origins" title={t('almanac.origins')}>
        {tallies(origins, data.origins, (entry, at, max) => (
          <TallyRow
            at={at}
            count={entry.count}
            icon={<OriginMark game={entry.key} />}
            key={entry.key}
            label={localizeOriginGame(locale, entry.key, ORIGIN_GAME_NAMES.get(entry.key) ?? entry.key)}
            max={max}
            onPick={pick('origin_game', entry.key)}
          />
        ), t('almanac.empty'))}
      </Card>,
    );

    // who caught them
    const trainers = card++;
    records.push(
      <Card className={classNames({ long: data.ots.length > LONG_LIST })} index={trainers} key="trainers" title={t('almanac.trainers')}>
        {tallies(trainers, data.ots, (entry, at, max) => (
          <TallyRow at={at} count={entry.count} key={entry.key} label={entry.key} max={max} onPick={pick('ot', entry.key)} />
        ), t('almanac.empty'))}
      </Card>,
    );

    // balls, dropping in one after another, their counts counting up as they land
    const balls = card++;
    records.push(
      <Card index={balls} key="balls" title={t('almanac.balls')}>
        <div className="almanac-balls">
          {data.balls.map((entry, i) => {
            const drop = land(balls) + 100 + wave(i, data.balls.length);
            return (
              <button key={entry.key} onClick={pick('ball', entry.key)} style={{ '--d': drop } as CSSProperties} title={localizeBall(locale, entry.key, BALL_NAMES.get(entry.key) ?? entry.key)} type="button">
                <span className="almanac-ball">{entry.key === 'unknown' ? <span className="ball-unknown">?</span> : <img alt="" src={`/balls/${entry.key}.png`} />}</span>
                <Count at={drop} value={entry.count} />
              </button>
            );
          })}
          {data.balls.length === 0 && <p className="almanac-empty">{t('almanac.empty')}</p>}
        </div>
      </Card>,
    );

    // the specials
    const specials = card++;
    const specialsAt = counted(specials);
    const special = (icon: IconDefinition, label: string, value: number, className?: string, of?: number) => (
      <div className={classNames('almanac-special', className)}>
        <span className="almanac-special-icon"><FontAwesomeIcon icon={icon} /></span>
        <strong><Count at={specialsAt} value={value} />{of !== undefined && <small>/{of}</small>}</strong>
        <span>{label}</span>
      </div>
    );
    const { specials: s } = data;
    records.push(
      <Card index={specials} key="specials" title={t('almanac.specials')}>
        <div className="almanac-specials">
          {special(faHeart, t('almanac.favorites'), s.favorites, 'favorite')}
          {special(faHeart, t('almanac.partners'), s.partners, 'partner')}
          {special(faSignature, t('almanac.nicknamed'), s.nicknamed)}
          {special(faGift, t('almanac.gifts'), s.gifts, 'gift')}
          {special(faDumbbell, t('almanac.trained'), s.trained)}
          {s.legendary.total > 0 && special(faCrown, t('filter.legendary'), s.legendary.marked, undefined, s.legendary.total)}
          {s.mythical.total > 0 && special(faWandMagicSparkles, t('filter.mythical'), s.mythical.marked, undefined, s.mythical.total)}
        </div>
      </Card>,
    );

    // where the sealed ones are now
    const places = card++;
    records.push(
      <Card index={places} key="places" title={t('almanac.places')}>
        {tallies(places, data.places, (entry, at, max) => {
          const tint = locationTint(placeFromKey(entry.key).location, dex.game.id === 'home');
          return (
            <TallyRow
              at={at}
              count={entry.count}
              icon={<span className={classNames('almanac-place-swatch', tint && `loc-${tint}`)} />}
              key={entry.key}
              label={placeLabel(entry.key)}
              max={max}
              onPick={pick('location', entry.key.startsWith('game:') ? 'game' : entry.key)}
            />
          );
        }, t('almanac.noneSealed'))}
      </Card>,
    );

    // languages, as one bar split between them, growing with their counts
    const languages = card++;
    const languagesAt = counted(languages);
    const languageTotal = data.languages.reduce((sum, entry) => sum + entry.count, 0);
    records.push(
      <Card index={languages} key="languages" title={t('almanac.languages')}>
        {data.languages.length > 0 && (
          <div className="almanac-split" data-at={languagesAt}>
            {data.languages.map((entry, i) => (
              <span key={entry.key} style={{ width: `${pct(entry.count, languageTotal)}%`, '--hue': (i * 67 + 210) % 360 } as CSSProperties} />
            ))}
          </div>
        )}
        <div className="almanac-legend">
          {data.languages.map((entry, i) => (
            <button key={entry.key} onClick={pick('language', entry.key)} style={{ '--hue': (i * 67 + 210) % 360 } as CSSProperties} type="button">
              <span className="almanac-swatch" />
              <span className="almanac-legend-label">{LANGUAGE_ABBRS.get(entry.key) ?? entry.key}</span>
              <span className="almanac-legend-count"><Count at={languagesAt} value={entry.count} /></span>
            </button>
          ))}
          {data.languages.length === 0 && <p className="almanac-empty">{t('almanac.empty')}</p>}
        </div>
      </Card>,
    );

    cards.push(<div className="almanac-records" key="records" ref={recordsRef}>{records}</div>);

    // when: catches by month, every month from the first to the latest, rising in a wave from the first; the busiest
    // in the accent, its count over it
    const time: ReactNode[] = [];
    const activity = card++;
    time.push(
      <Card className="almanac-activity" index={activity} key="activity" title={t('almanac.activity')}>
        {data.months.length > 0
          ? (
            <>
              <div className="almanac-months">
                {data.months.map((entry, i) => {
                  const year = entry.month === 1 || (i === 0 && entry.month <= FIRST_YEAR_BY);
                  const at = counted(activity) + wave(i, data.months.length, MONTH_SPREAD);
                  const busiest = entry === data.busiest;
                  return (
                    <span
                      className={classNames('almanac-month', { busiest, year })}
                      data-year={year ? entry.year : undefined}
                      key={`${entry.year}-${entry.month}`}
                      title={`${monthYear(entry)}: ${entry.count}`}
                    >
                      <span className="almanac-month-bar" data-at={at} style={{ height: `${pct(entry.count, maxMonth)}%` }} />
                      {busiest && <span className="almanac-month-peak"><Count at={at} value={entry.count} /></span>}
                    </span>
                  );
                })}
              </div>
              <p className="almanac-activity-note">
                {data.busiest && <span>{t('almanac.busiest', { month: monthYear(data.busiest), n: data.busiest.count })}</span>}
                {data.undated > 0 && <span>{t('almanac.undated', { n: data.undated })}</span>}
              </p>
            </>
          )
          : <p className="almanac-empty">{t('almanac.noDates')}</p>}
      </Card>,
    );

    // the latest catches beside them, dropping in newest first
    if (data.recent.length > 0) {
      const lately = card++;
      time.push(
        <Card className="almanac-lately" index={lately} key="lately" title={t('almanac.lately')}>
          <div className="almanac-lately-mons">
            {data.recent.map((capture, i) => <LatelyMon capture={capture} dex={dex} drop={land(lately) + 160 + i * 55} key={capture.pokemon.id} onLocate={onLocate} />)}
          </div>
        </Card>,
      );
    }
    cards.push(<div className="almanac-time" key="time">{time}</div>);

    // the milestones along a line: the 1st catch, the 10th, the 50th… and the latest
    if (data.milestones.length > 0) {
      const milestones = card++;
      cards.push(
        <Card className="almanac-milestones-card" index={milestones} key="milestones" style={{ '--stop': STOP_MS } as CSSProperties} title={t('almanac.milestones')}>
          <ol className="almanac-milestones">
            {data.milestones.map((milestone, i) => (
              <MilestoneStop
                dex={dex}
                drop={counted(milestones) + i * STOP_MS}
                key={milestone.n}
                label={milestone.latest ? t('almanac.latest') : ordinal(milestone.n)}
                milestone={milestone}
                onLocate={onLocate}
              />
            ))}
          </ol>
        </Card>,
      );
    }
  }

  return createPortal(
    <div aria-label={t('almanac.title')} aria-modal="true" className="almanac" data-gate={gate || undefined} ref={sceneRef} role="dialog">
      <header className="almanac-top">
        <span className="almanac-logo"><span>{t('almanac.title')}</span></span>
        <h1>{activeDex!.title}</h1>
        <span className="almanac-hint">{t('almanac.hint')}</span>
        <button aria-label={t('almanac.close')} className="almanac-close" onClick={onClose} title={t('almanac.close')} type="button">
          <FontAwesomeIcon icon={faXmark} />
        </button>
      </header>
      <div className="almanac-body" data-intro={intro || undefined} tabIndex={-1}>
        <div className="almanac-grid" style={{ zoom: scale }}>{cards}</div>
      </div>
      {titleCard && <TitleCard hint={t('scene.skip')} sub={activeDex!.title} title={t('almanac.title')} />}
    </div>,
    document.body,
  );
}
