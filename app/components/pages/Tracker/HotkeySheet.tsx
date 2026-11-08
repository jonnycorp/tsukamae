import { useEffect } from 'react';

import { ModalShell } from '../../library/ModalShell';
import { useDismissable } from '../../../hooks/use-dismissable';
import { useTranslation } from '../../../hooks/use-translation';

import type { TranslationKey } from '../../../i18n/translations';

// a key as its cap reads, or a pointer's press by name (translated); macOS names its modifiers by their signs
type Cap = string | { press: TranslationKey };

interface Shortcut {
  // the ways to do it, each a set of caps held together
  keys: Cap[][];
  label: TranslationKey | TranslationKey[];
  // only where the dex keeps records: a checklist has no popover, review, timeline, flips or scenes reading records
  records?: boolean;
}

interface Group {
  title: TranslationKey;
  shortcuts: Shortcut[];
  records?: boolean;
}

const CLICK: Cap = { press: 'help.press.click' };

const GROUPS: Group[] = [
  {
    title: 'help.group.dex',
    shortcuts: [
      { keys: [['T']], label: 'timeline.open', records: true },
      { keys: [['A']], label: 'almanac.open' },
      { keys: [['W']], label: 'help.review', records: true },
      { keys: [['J']], label: 'journeys.open', records: true },
      { keys: [['P']], label: 'redpen.open' },
      { keys: [['G']], label: 'atlas.open' },
      { keys: [['C']], label: 'trainers.open', records: true },
      { keys: [['B']], label: 'orrery.open', records: true },
      { keys: [['V']], label: 'help.layout' },
      { keys: [['F']], label: 'help.filters' },
      { keys: [['R']], label: 'help.clearFilters' },
      { keys: [['/']], label: 'help.search' },
      { keys: [['O']], label: 'help.display' },
      { keys: [['M']], label: 'nav.still' },
      { keys: [['Space']], label: 'help.holdFlips', records: true },
      { keys: [['1'], ['2'], ['3']], label: 'help.pickPage', records: true },
      { keys: [['Ctrl', { press: 'help.press.wheel' }], ['Ctrl', '+'], ['Ctrl', '−']], label: 'help.zoom' },
      { keys: [['Ctrl', '0'], ['Z']], label: 'help.zoomFit' },
      { keys: [['H']], label: 'help.title' },
    ],
  },
  {
    title: 'help.group.tile',
    shortcuts: [
      { keys: [[CLICK]], label: 'help.click' },
      { keys: [['Shift', CLICK]], label: 'help.shiftClick' },
      { keys: [['Alt', CLICK]], label: 'help.altClick', records: true },
      { keys: [[{ press: 'help.press.rightClick' }]], label: 'help.copyName' },
      { keys: [[{ press: 'help.press.hold' }]], label: 'help.hold' },
      { keys: [['L']], label: 'help.move', records: true },
      { keys: [['Q'], ['E'], ['↑'], ['↓']], label: 'help.movePick', records: true },
      { keys: [['D']], label: 'help.release' },
    ],
  },
  {
    title: 'help.group.list',
    shortcuts: [
      { keys: [['Ctrl', CLICK]], label: 'help.listOne' },
      { keys: [['Shift', CLICK]], label: 'help.listRun' },
      { keys: [['Ctrl', 'A']], label: 'help.listAll' },
      { keys: [['Esc']], label: 'help.listClear' },
    ],
  },
  {
    title: 'help.group.review',
    records: true,
    shortcuts: [
      { keys: [['1'], ['2'], ['3']], label: ['status.caught', 'status.temporary', 'status.unobtainable'] },
      { keys: [['Enter']], label: 'help.reviewNext' },
      { keys: [['Ctrl', 'Enter']], label: 'help.reviewSeal' },
      { keys: [['E'], ['→']], label: 'help.reviewForward' },
      { keys: [['Q'], ['←']], label: 'help.reviewBack' },
      { keys: [['L']], label: 'help.reviewList' },
      { keys: [['↓']], label: 'help.reviewRecentDate' },
      { keys: [['Esc']], label: 'help.reviewEscape' },
    ],
  },
  {
    title: 'help.group.timeline',
    records: true,
    shortcuts: [
      { keys: [['+'], ['−']], label: 'help.timelineZoom' },
      { keys: [['0'], ['Z']], label: 'help.timelineFit' },
    ],
  },
  {
    title: 'help.group.atlas',
    shortcuts: [
      { keys: [['Q'], ['E'], ['←'], ['→']], label: 'help.atlasWalk' },
      { keys: [['Home'], ['End']], label: 'help.atlasEnds' },
      { keys: [['Enter']], label: 'help.atlasGo' },
    ],
  },
  {
    title: 'help.group.anywhere',
    shortcuts: [
      { keys: [['Esc']], label: 'help.escape' },
      { keys: [['Alt', 'Q'], ['Alt', 'E'], ['Alt', '↑'], ['Alt', '↓']], label: 'help.reorder' },
    ],
  },
];

const MAC = /Mac|iPhone|iPad/.test(navigator.platform);
const MAC_CAPS: Record<string, string> = { Ctrl: '⌘', Alt: '⌥' };

interface Props {
  checklist: boolean;
  onClose: () => void;
}

// H: every shortcut the dex has, by where it works, each with its keys as caps; H again, Escape or a press outside
// closes it. A checklist leaves out what it hasn't got (the review, the timeline, the flips, the scenes reading records,
// the popover)
export function HotkeySheet ({ checklist, onClose }: Props) {
  const { t } = useTranslation();
  const { closing, dismiss } = useDismissable({ onDismissed: onClose });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'h' && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey && !e.defaultPrevented) {
        e.preventDefault();
        dismiss();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [dismiss]);

  const cap = (key: Cap) => (typeof key === 'string' ? (MAC && MAC_CAPS[key]) || key : t(key.press));
  const shown = (entry: { records?: boolean }) => !(checklist && entry.records);

  return (
    <ModalShell closing={closing} contentLabel={t('help.title')} onDismiss={dismiss} wide>
      <div className="form hotkey-sheet">
        <h1>{t('help.title')}</h1>
        <div className="hotkey-groups">
          {GROUPS.filter(shown).map((group) => (
            <section className="hotkey-group" key={group.title}>
              <h3>{t(group.title)}</h3>
              <dl>
                {group.shortcuts.filter(shown).map((shortcut) => (
                  <div className="hotkey-row" key={[shortcut.label].flat().join()}>
                    <dt>
                      {shortcut.keys.map((combo, i) => (
                        <span className="hotkey-combo" key={i}>
                          {combo.map((key, k) => <kbd key={k}>{cap(key)}</kbd>)}
                        </span>
                      ))}
                    </dt>
                    <dd>{[shortcut.label].flat().map((label) => t(label)).join(t('common.listSeparator'))}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </div>
    </ModalShell>
  );
}
