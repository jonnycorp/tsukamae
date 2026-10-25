import classNames from 'classnames';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { createPortal } from 'react-dom';
import { faBarcode, faBookOpen, faBookmark, faCirclePause, faEye, faFilter, faLanguage, faListCheck, faMoon, faPalette, faPen, faRotateLeft, faRotateRight, faRoute, faSearch, faTableCells, faTableList, faTimeline } from '@fortawesome/free-solid-svg-icons';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { EMPTY_FILTERS, FACETS, FILTER_VIEWS, anyFilterActive, facetOptions, hasQuery, queryMatcher, searchFold } from './filters';
import { OriginMark } from './seal-faces';
import { DISPLAY_ICONS } from '../../library/Nav';
import { DISPLAY_MODES } from '../../../utils/display-modes';
import { PokemonName } from '../../library/PokemonName';
import { THEMES } from '../../../palette/themes';
import { dimTitleBar } from '../../../palette/apply-theme';
import { dexNumber, iconClass } from '../../../utils/pokemon';
import { translate } from '../../../i18n/translations';
import { useDexContext } from '../../../hooks/contexts/use-dex-context';
import { useInertPage } from '../../../hooks/use-inert-page';
import { useDisplayContext, useLocalStorageContext, useThemeContext } from '../../../hooks/contexts/use-local-storage-context';
import { useTrackerState } from './use-tracker';
import { useTranslation } from '../../../hooks/use-translation';

import type { Capture } from '../../../types';
import type { Dispatch, KeyboardEvent as ReactKeyboardEvent, ReactNode, SetStateAction } from 'react';
import type { DexLayout } from './ledger-model';
import type { LabScene } from './Scene';
import type { TrackerFilters } from './filters';
import type { TranslationKey } from '../../../i18n/translations';

type Section = 'pokemon' | 'actions' | 'views' | 'filters' | 'dexes' | 'themes';

const SECTIONS: { id: Section; labelKey: TranslationKey; limit: number }[] = [
  { id: 'pokemon', labelKey: 'palette.section.pokemon', limit: 8 },
  { id: 'actions', labelKey: 'palette.section.actions', limit: 10 },
  { id: 'views', labelKey: 'palette.section.views', limit: 5 },
  { id: 'filters', labelKey: 'palette.section.filters', limit: 8 },
  { id: 'dexes', labelKey: 'palette.section.dexes', limit: 6 },
  { id: 'themes', labelKey: 'palette.section.themes', limit: 6 },
];

// with nothing typed: what's handy without a search; the filters run to hundreds and wait for one
const IDLE_SECTIONS: Section[] = ['actions', 'views', 'dexes'];

// the backdrop's black, rgb(0 0 0 / 22%) in styles/palette.scss
const PALETTE_SHADE = 0.22;

interface Command {
  id: string;
  section: Section;
  label: ReactNode;
  // what a search reads: the label in both languages and any other word for it, folded (searchFold)
  words: string;
  // the label alone, folded, so one that starts with the search comes first
  title: string;
  hint?: string;
  icon?: ReactNode;
  run: () => void;
}

interface Props {
  onClose: () => void;
  filters: TrackerFilters;
  setFilters: Dispatch<SetStateAction<TrackerFilters>>;
  setQuery: Dispatch<SetStateAction<string>>;
  layout: DexLayout;
  setLayout: (layout: DexLayout) => void;
  // unset in a checklist, which has no timeline
  onOpenTimeline?: () => void;
  onOpenAlmanac: () => void;
  // unset in a checklist, which keeps no records to review
  onOpenReview?: () => void;
  // the scenes on the shared shell (Scene.tsx)
  onOpenScene: (scene: LabScene) => void;
  onHistory: (direction: 'undo' | 'redo') => void;
  // a mon picked: its tile (or row), with whatever hides it cleared first
  onLocate: (pokemon: number) => void;
}

const en = (key: TranslationKey) => translate('en', key);
const ja = (key: TranslationKey) => translate('ja', key);

const glyph = (type: string) => <span className="type-glyph" style={{ backgroundColor: `var(--type-${type})`, maskImage: `url(/types/${type}.svg)` }} />;

// Ctrl+K: one box that reaches everything, typed into: a mon by name (either language), number or nickname; a view, any
// filter's value (added to what's set), the layouts and scenes, the display toggles, another dex, a theme. Arrows move,
// Enter runs, Esc (or a click outside) closes
export function CommandPalette ({ onClose, filters, setFilters, setQuery, layout, setLayout, onOpenTimeline, onOpenAlmanac, onOpenReview, onOpenScene, onHistory, onLocate }: Props) {
  const { captures } = useTrackerState();
  const { dexes, activeDex, activeDexView, setActiveDex } = useDexContext();
  const { theme, setTheme, isSoftDark, setIsSoftDark, locationTints, setLocationTints, still, setStill } = useThemeContext();
  const { display, setDisplay } = useDisplayContext();
  const { setLocale } = useLocalStorageContext();
  const { t, locale } = useTranslation();
  const [search, setSearch] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const checklist = Boolean(activeDex?.checklist);
  const regional = Boolean(activeDexView?.regional);
  const dex = activeDexView!;
  const inputRef = useRef<HTMLInputElement>(null);

  useInertPage();

  // the window buttons dimmed with the bar under the backdrop, as a modal dims them
  useEffect(() => {
    dimTitleBar(true, PALETTE_SHADE);
    return () => dimTitleBar(false, PALETTE_SHADE);
  }, []);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const commands = useMemo(() => {
    const list: Command[] = [];
    const add = (section: Section, label: string, run: () => void, extra: { hint?: string; icon?: ReactNode; words?: string[] } = {}) => {
      list.push({
        id: `${section}:${list.length}`,
        section,
        label,
        title: searchFold(label),
        words: searchFold([label, ...(extra.words ?? [])].join(' ')),
        hint: extra.hint,
        icon: extra.icon,
        run,
      });
    };
    const on = (state: boolean) => (state ? '✓' : undefined);

    if (onOpenTimeline) {
      add('actions', t('timeline.open'), onOpenTimeline, { hint: 'T', icon: <FontAwesomeIcon icon={faTimeline} />, words: [en('timeline.open'), ja('timeline.open')] });
    }
    add('actions', t('almanac.open'), onOpenAlmanac, { hint: 'A', icon: <FontAwesomeIcon icon={faBookOpen} />, words: [en('almanac.open'), ja('almanac.open'), 'stats'] });
    if (onOpenReview) {
      add('actions', t('review.open'), onOpenReview, { hint: 'W', icon: <FontAwesomeIcon icon={faListCheck} />, words: [en('review.open'), ja('review.open'), 'review', 'fill'] });
    }
    // journeys and the red pen read records, which a checklist keeps none of
    if (!checklist) {
      add('actions', t('journeys.open'), () => onOpenScene('journeys'), { hint: 'J', icon: <FontAwesomeIcon icon={faRoute} />, words: [en('journeys.open'), ja('journeys.open'), 'route', 'flow', 'origin', 'generation', 'sankey'] });
      add('actions', t('redpen.open'), () => onOpenScene('redpen'), { hint: 'P', icon: <FontAwesomeIcon icon={faPen} />, words: [en('redpen.open'), ja('redpen.open'), 'check', 'mistake', 'proofread', 'audit', 'akapen'] });
    }
    add('actions', t('atlas.open'), () => onOpenScene('atlas'), { hint: 'G', icon: <FontAwesomeIcon icon={faBarcode} />, words: [en('atlas.open'), ja('atlas.open'), 'compare', 'dexes', 'overlap', 'national'] });
    add('actions', t('history.undo'), () => onHistory('undo'), { hint: 'Ctrl+Z', icon: <FontAwesomeIcon icon={faRotateLeft} />, words: [en('history.undo'), ja('history.undo')] });
    add('actions', t('history.redo'), () => onHistory('redo'), { hint: 'Ctrl+Shift+Z', icon: <FontAwesomeIcon icon={faRotateRight} />, words: [en('history.redo'), ja('history.redo')] });
    const other = layout === 'boxes' ? 'ledger' : 'boxes';
    add('actions', t(other === 'ledger' ? 'palette.showLedger' : 'palette.showBoxes'), () => setLayout(other), {
      hint: 'V',
      icon: <FontAwesomeIcon icon={other === 'ledger' ? faTableList : faTableCells} />,
      words: [en('layout.ledger'), ja('layout.ledger'), en('layout.boxes'), ja('layout.boxes'), 'table', 'list'],
    });
    if (anyFilterActive(filters)) {
      add('actions', t('palette.clearFilters'), () => {
        setFilters(EMPTY_FILTERS);
        setQuery('');
      }, { hint: 'R', icon: <FontAwesomeIcon icon={faRotateLeft} />, words: [en('palette.clearFilters'), ja('palette.clearFilters'), 'reset'] });
    }
    add('actions', t('nav.softDark'), () => setIsSoftDark(!isSoftDark), { hint: on(isSoftDark), icon: <FontAwesomeIcon icon={faMoon} />, words: [en('nav.softDark'), ja('nav.softDark'), 'dark', 'night'] });
    for (const mode of DISPLAY_MODES) {
      add('actions', t(`nav.display.${mode}`), () => setDisplay(mode), {
        hint: on(display === mode),
        icon: <FontAwesomeIcon icon={DISPLAY_ICONS[mode]} />,
        words: [en(`nav.display.${mode}`), ja(`nav.display.${mode}`), 'display', 'tiles', 'faces', 'pages', '表示'],
      });
    }
    add('actions', t('nav.locationTints'), () => setLocationTints(!locationTints), { hint: on(locationTints), icon: <FontAwesomeIcon icon={faEye} />, words: [en('nav.locationTints'), ja('nav.locationTints')] });
    add('actions', t('nav.still'), () => setStill(!still), { hint: on(still), icon: <FontAwesomeIcon icon={faCirclePause} />, words: [en('nav.still'), ja('nav.still'), 'still', 'calm', 'motion', 'animation', 'distraction'] });
    add('actions', t('palette.switchLanguage'), () => setLocale(locale === 'en' ? 'ja' : 'en'), { icon: <FontAwesomeIcon icon={faLanguage} />, words: ['language', 'english', 'japanese', '日本語', '言語'] });

    for (const view of FILTER_VIEWS.filter((entry) => !checklist || !entry.records)) {
      add('views', t('palette.view', { name: t(view.labelKey) }), () => setFilters((prev) => ({ ...prev, view: view.id })), {
        hint: on(filters.view === view.id),
        icon: <FontAwesomeIcon icon={faBookmark} />,
        words: [en(view.labelKey), ja(view.labelKey)],
      });
    }

    for (const facet of FACETS.filter((entry) => !checklist || entry.species)) {
      for (const option of facetOptions(facet, captures, EMPTY_FILTERS, '', regional, locale)) {
        if (option.count === 0) {
          continue;
        }
        let icon: ReactNode = <FontAwesomeIcon icon={faFilter} />;
        if (option.glyph) {
          icon = glyph(option.glyph);
        } else if (option.icon) {
          icon = <img alt="" className="palette-ball" src={`/${option.icon}`} />;
        } else if (facet.id === 'origin_game') {
          icon = <OriginMark game={option.value} />;
        }
        const words = [en(facet.labelKey), ja(facet.labelKey), facet.label(option.value, 'en'), facet.label(option.value, 'ja')];
        if (facet.id === 'generation') {
          words.push(`gen${option.value}`, `g${option.value}`);
        }
        add('filters', `${t(facet.labelKey)}: ${option.label}`, () => setFilters((prev) => ({ ...prev, facets: { ...prev.facets, [facet.id]: [option.value] } })), {
          hint: String(option.count),
          icon,
          words,
        });
      }
    }

    for (const entry of dexes ?? []) {
      if (entry.id !== activeDex?.id) {
        add('dexes', t('palette.goTo', { name: entry.title }), () => setActiveDex(entry.id), { icon: <FontAwesomeIcon icon={faBookmark} />, words: ['dex', '図鑑'] });
      }
    }

    for (const seed of THEMES) {
      add('themes', t('palette.theme', { name: seed.name }), () => setTheme(seed.name), { hint: on(theme === seed.name), icon: <FontAwesomeIcon icon={faPalette} />, words: ['theme', 'テーマ', 'colour', 'color'] });
    }
    return list;
  }, [t, locale, captures, regional, checklist, filters, layout, dexes, activeDex, theme, isSoftDark, locationTints, display, still, onOpenTimeline, onOpenAlmanac, onOpenReview, onOpenScene, onHistory, setFilters, setQuery, setLayout, setIsSoftDark, setLocationTints, setDisplay, setStill, setLocale, setActiveDex, setTheme]);

  // the mons for what's typed, best first: a name (either language) that starts with it, then what the search bar also
  // finds (a number, a nickname), then a name with it anywhere in it; the dex's order within each
  const mons = useMemo(() => {
    if (!hasQuery(search)) {
      return [];
    }
    const folded = searchFold(search.trim());
    const matches = queryMatcher(search, regional);
    const scored: { capture: Capture; score: number }[] = [];
    for (const capture of captures) {
      const names = [searchFold(capture.pokemon.name), searchFold(capture.pokemon.name_ja ?? '')];
      let score = 0;
      if (names.some((name) => name.startsWith(folded))) {
        score = 3;
      } else if (matches(capture)) {
        score = 2;
      } else if (folded.length >= 2 && names.some((name) => name.includes(folded))) {
        score = 1;
      }
      if (score > 0) {
        scored.push({ capture, score });
      }
    }
    return scored.sort((a, b) => b.score - a.score);
  }, [search, captures, regional]);

  // what shows, section by section: every word typed somewhere in a command's words, scored as the mons are (a label
  // that starts with the search, one with it inside, one that only matches by its other words); the sections in the
  // order of their best, so "fire" puts the Type filter before Gouging Fire
  const shown = useMemo(() => {
    const folded = searchFold(search.trim());
    const tokens = folded.split(/\s+/).filter(Boolean);
    const scoreOf = (command: Command) => {
      if (command.title.startsWith(folded)) {
        return 3;
      }
      // inside the label, or a whole word of its other names (English "fire" for ほのお)
      return command.title.includes(folded) || command.words.startsWith(folded) || command.words.includes(` ${folded}`) ? 2 : 1;
    };
    const sections: { id: Section; labelKey: TranslationKey; items: Command[]; best: number; at: number }[] = [];
    SECTIONS.forEach((section, at) => {
      let scored: { command: Command; score: number }[];
      if (section.id === 'pokemon') {
        scored = mons.map(({ capture, score }) => ({
          score,
          command: {
            id: `pokemon:${capture.pokemon.id}`,
            section: 'pokemon',
            label: <PokemonName name={capture.pokemon.name} nameJa={capture.pokemon.name_ja} />,
            title: '',
            words: '',
            hint: `#${dexNumber(capture.pokemon, dex)}${capture.captured && capture.status ? ` · ${t(capture.sealed && !checklist ? 'seal.sealed' : `status.${capture.status}`)}` : ''}`,
            icon: <i className={iconClass(capture.pokemon, dex)} />,
            run: () => onLocate(capture.pokemon.id),
          },
        }));
      } else if (tokens.length === 0) {
        scored = IDLE_SECTIONS.includes(section.id) ? commands.filter((command) => command.section === section.id).map((command) => ({ command, score: 1 })) : [];
      } else {
        const matching = commands.filter((command) => command.section === section.id && tokens.every((token) => command.words.includes(token)));
        scored = matching.map((command) => ({ command, score: scoreOf(command) })).sort((a, b) => b.score - a.score);
      }
      if (scored.length > 0) {
        sections.push({ id: section.id, labelKey: section.labelKey, items: scored.slice(0, section.limit).map((entry) => entry.command), best: scored[0].score, at });
      }
    });
    return sections.sort((a, b) => b.best - a.best || a.at - b.at);
  }, [search, mons, commands, dex, checklist, t, onLocate]);

  const flat = useMemo(() => shown.flatMap((section) => section.items), [shown]);
  const current = Math.min(active, flat.length - 1);

  useEffect(() => setActive(0), [search]);

  // the one picked kept in view as the arrows move it
  useLayoutEffect(() => {
    listRef.current?.querySelector('[data-active]')?.scrollIntoView({ block: 'nearest' });
  }, [current]);

  const run = (command: Command) => {
    onClose();
    command.run();
  };

  // an IME's Enter, arrows and Esc are its own while it composes (choosing ぴか's kanji runs nothing)
  const handleKeyDown = (e: ReactKeyboardEvent) => {
    if (e.nativeEvent.isComposing) {
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (flat.length > 0) {
        setActive((current + (e.key === 'ArrowDown' ? 1 : -1) + flat.length) % flat.length);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (flat[current]) {
        run(flat[current]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  let index = -1;
  return createPortal(
    <div className="command-palette" onMouseDown={(e) => e.target === e.currentTarget && onClose()} role="presentation">
      <div aria-label={t('palette.title')} aria-modal="true" className="palette-box" onKeyDown={handleKeyDown} role="dialog">
        <div className="palette-search">
          <FontAwesomeIcon icon={faSearch} />
          <input
            aria-activedescendant={flat[current] ? `palette-${flat[current].id}` : undefined}
            aria-controls="palette-list"
            aria-expanded
            autoComplete="off"
            className="palette-input"
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('palette.placeholder')}
            ref={inputRef}
            role="combobox"
            spellCheck={false}
            value={search}
          />
          <kbd>Esc</kbd>
        </div>
        <div className="palette-list" id="palette-list" ref={listRef} role="listbox">
          {shown.length === 0 && <p className="palette-empty">{t('palette.empty')}</p>}
          {shown.map((section) => (
            <div className="palette-section" key={section.id} role="group">
              <h3>{t(section.labelKey)}</h3>
              {section.items.map((command) => {
                index++;
                const i = index;
                return (
                  <div
                    aria-selected={i === current}
                    className={classNames('palette-item', `palette-${command.section}`)}
                    data-active={i === current || undefined}
                    id={`palette-${command.id}`}
                    key={command.id}
                    onClick={() => run(command)}
                    onMouseMove={() => i !== current && setActive(i)}
                    role="option"
                  >
                    <span className="palette-icon">{command.icon}</span>
                    <span className="palette-label">{command.label}</span>
                    {command.hint && <span className="palette-hint">{command.hint}</span>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <div className="palette-footer">{t('palette.footer')}</div>
      </div>
    </div>,
    document.body,
  );
}
