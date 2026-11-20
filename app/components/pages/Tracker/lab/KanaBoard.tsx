import classNames from 'classnames';
import { useMemo, useRef, useState } from 'react';

import { DAKUON, SEION, kanaRomaji, romaji } from './kana';
import { LabTip } from './LabTip';
import { Scene, SceneMon, useScrollBack } from '../Scene';
import { useDexContext } from '../../../../hooks/contexts/use-dex-context';
import { useLabText } from './lab-i18n';
import { useTrackerState } from '../use-tracker';

import type { Capture } from '../../../../types';
import type { CSSProperties, FocusEvent, PointerEvent } from 'react';
import type { LabProps } from './lab-kit';

// by the name's first kana (as a Japanese index runs), or by every kana in it
type Mode = 'initial' | 'contains';

// a small kana counted as its full one, in the contains mode
const FULL: Record<string, string> = { ァ: 'ア', ィ: 'イ', ゥ: 'ウ', ェ: 'エ', ォ: 'オ', ャ: 'ヤ', ュ: 'ユ', ョ: 'ヨ', ッ: 'ツ', ヮ: 'ワ' };
const TIP_MONS = 18;

const caught = (capture: Capture) => capture.captured && capture.status === 'caught';

// how a mon stands, for its dot in the loupe
const standing = (capture: Capture) => (capture.sealed ? 'sealed' : caught(capture) ? 'caught' : capture.captured ? capture.status : 'missing');

// the kana board (五十音): the dex's mons laid out by the kana of their Japanese names, the gojūon in its columns as a
// Japanese table reads them, right to left, top to bottom. Each kana fills from the foot with how many of its mons
// you've caught; a full one is stamped 完. Pointed at, a kana lists its mons with their names sounded out in romaji;
// pressed, the review runs through them (in a checklist, the dex goes to the first one still missing). The switch at the
// top counts a mon under its first kana alone, or under every kana in its name
export function KanaBoard ({ back, onClose, onLocate, onReview }: LabProps) {
  const { captures } = useTrackerState();
  const { activeDex } = useDexContext();
  const { lt } = useLabText();
  const pageRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<Mode>('initial');
  const [readings, setReadings] = useState(true);
  const [hot, setHot] = useState<{ kana: string; x: number; y: number } | null>(null);

  const byKana = useMemo(() => {
    const map = new Map<string, Capture[]>();
    const add = (kana: string, capture: Capture) => {
      const list = map.get(kana) ?? map.set(kana, []).get(kana)!;
      if (list[list.length - 1] !== capture) {
        list.push(capture);
      }
    };
    for (const capture of captures) {
      const name = capture.pokemon.name_ja;
      if (!name) {
        continue;
      }
      if (mode === 'initial') {
        add([...name][0], capture);
        continue;
      }
      for (const char of new Set([...name].map((c) => FULL[c] ?? c))) {
        add(char, capture);
      }
    }
    return map;
  }, [captures, mode]);

  const done = captures.filter(caught).length;

  useScrollBack(pageRef, back, true);

  const press = (kana: string) => {
    const mons = byKana.get(kana) ?? [];
    if (mons.length === 0) {
      return;
    }
    if (activeDex!.checklist) {
      onLocate((mons.find((capture) => !caught(capture)) ?? mons[0]).pokemon.id);
      return;
    }
    // the ones still to catch first
    const queue = [...mons].sort((a, b) => Number(caught(a)) - Number(caught(b)) || a.pokemon.id - b.pokemon.id);
    onReview(queue.map((capture) => capture.pokemon.id));
  };
  const show = (kana: string) => (e: PointerEvent<HTMLButtonElement> | FocusEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHot({ kana, x: rect.right, y: rect.top + rect.height / 2 });
  };

  const board = (columns: (string | null)[][], offset: number) => (
    <div className="lk-board">
      {columns.map((column, c) => (
        <div className="lk-column" key={c} style={{ '--c': c + offset } as CSSProperties}>
          {column.map((kana, r) => {
            if (!kana) {
              return <span className="lk-cell gap" key={r} />;
            }
            const mons = byKana.get(kana) ?? [];
            const have = mons.filter(caught).length;
            const fill = mons.length > 0 ? have / mons.length : 0;
            return (
              <button
                className={classNames('lk-cell', { empty: mons.length === 0, full: mons.length > 0 && have === mons.length, hot: hot?.kana === kana })}
                disabled={mons.length === 0}
                key={kana}
                onBlur={() => setHot(null)}
                onClick={() => press(kana)}
                onFocus={show(kana)}
                onPointerEnter={show(kana)}
                onPointerLeave={() => setHot(null)}
                style={{ '--fill': fill, '--r': r } as CSSProperties}
                type="button"
              >
                <i className="lk-fill" />
                <span className="lk-kana" lang="ja">{kana}</span>
                {readings && <span className="lk-romaji">{kanaRomaji(kana)}</span>}
                {mons.length > 0 && <span className="lk-count">{have}/{mons.length}</span>}
                {mons.length > 0 && have === mons.length && <span aria-hidden="true" className="lk-stamp">完</span>}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );

  const hotMons = hot ? [...(byKana.get(hot.kana) ?? [])].sort((a, b) => Number(caught(a)) - Number(caught(b))) : [];

  return (
    <Scene hint={lt('kana.hint')} name="lab-kana" onClose={onClose} quiet={Boolean(back)} title={lt('kana.title')}>
      {({ scale }) => (
        <div className="lk-page" ref={pageRef} style={{ zoom: scale }}>
          <header className="lk-head">
            <div className="lk-total">
              <b>{done}</b>
              <span>{lt('kana.total', { n: captures.length })}</span>
            </div>
            <div className="lk-switches">
              <div className="lk-segment" role="group">
                {(['initial', 'contains'] as Mode[]).map((option) => (
                  <button aria-pressed={mode === option} className={classNames({ on: mode === option })} key={option} onClick={() => setMode(option)} type="button">
                    {lt(option === 'initial' ? 'kana.initial' : 'kana.contains')}
                  </button>
                ))}
              </div>
              <button aria-pressed={readings} className={classNames('lk-toggle', { on: readings })} onClick={() => setReadings(!readings)} type="button">
                {lt('kana.readings')}
              </button>
            </div>
          </header>
          <div className="lk-boards">
            <section>
              <h2 lang="ja">清音</h2>
              {board(SEION, 0)}
            </section>
            <section>
              <h2 lang="ja">濁音・半濁音</h2>
              {board(DAKUON, SEION.length)}
            </section>
          </div>
          <p className="lk-note">{lt(mode === 'initial' ? 'kana.noteInitial' : 'kana.noteContains')}</p>

          {hot && (
            <LabTip scale={scale} x={hot.x} y={hot.y}>
              <span className="lk-tip-head">
                <b lang="ja">{hot.kana}</b>
                <span>{kanaRomaji(hot.kana)}</span>
                <small>{lt('kana.tipCount', { have: hotMons.filter(caught).length, n: hotMons.length })}</small>
              </span>
              <ul className="lk-tip-mons">
                {hotMons.slice(0, TIP_MONS).map((capture) => (
                  <li className={`lk-st-${standing(capture)}`} key={capture.pokemon.id}>
                    <SceneMon pokemon={capture.pokemon} />
                    <span lang="ja">{capture.pokemon.name_ja}</span>
                    <em>{romaji(capture.pokemon.name_ja ?? '')}</em>
                  </li>
                ))}
              </ul>
              {hotMons.length > TIP_MONS && <small>{lt('kana.more', { n: hotMons.length - TIP_MONS })}</small>}
              <em>{lt(activeDex!.checklist ? 'kana.pressLocate' : 'kana.press')}</em>
            </LabTip>
          )}
        </div>
      )}
    </Scene>
  );
}
