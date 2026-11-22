import classNames from 'classnames';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck } from '@fortawesome/free-solid-svg-icons';
import { useMemo, useRef, useState } from 'react';

import { CHECKS, checkRecords } from './record-checks';
import { ViewTip } from './ViewTip';
import { ORIGIN_GAME_NAMES } from '../../../../utils/capture-fields';
import { Scene, SceneMon, useScrollBack } from '../Scene';
import { ScopeSwitch, useViewScope, useScopedRecords } from './ViewScope';
import { displayName } from '../../../library/PokemonName';
import { localizeOriginGame } from '../../../../i18n/names';
import { useViewText } from './views-i18n';

import type { CSSProperties } from 'react';
import type { ViewKey } from './views-i18n';
import type { ViewProps } from './views-kit';
import type { Flag } from './record-checks';

// the record check: every caught record looked over for what doesn't add up, a check to a card: a day still to come,
// a day before its game (or its species) was out, a mon its game's dex doesn't have, one trainer's ID No. under two OT
// names or two languages, a sealed record whose fields have gone stale. Each card's mons go to the review together to
// put right; a ring at the top shows how many records pass every check, to watch it fill as you go
export function RecordCheck ({ back, onClose, onReview }: ViewProps) {
  const { lt, locale } = useViewText();
  const pageRef = useRef<HTMLDivElement>(null);
  const [scope, setScope] = useViewScope('check');
  const records = useScopedRecords(scope);
  const [hot, setHot] = useState<{ flag: Flag; x: number; y: number } | null>(null);

  const gameName = (game: string) => localizeOriginGame(locale, game, ORIGIN_GAME_NAMES.get(game) ?? game);

  const { flags, caught } = useMemo(() => checkRecords(records, lt, gameName), [records, locale]); // gameName follows locale

  useScrollBack(pageRef, back, true);

  const flagged = new Set([...flags.values()].flat().map(({ record }) => record.key));
  const clean = caught - flagged.size;
  const share = caught ? clean / caught : 1;
  const queueOf = (list: Flag[]) => [...new Set(list.filter(({ record }) => record.here).map(({ record }) => record.capture.pokemon.id))];
  const everything = queueOf([...flags.values()].flat());

  // the cards, apart from the tip, so pointing at a mon re-renders none of them
  const checks = useMemo(() => (
    <div className="lc-checks">
      {CHECKS.map((check, i) => {
        const list = flags.get(check)!;
        const queue = queueOf(list);
        return (
          <section className={classNames('lc-check', { ok: list.length === 0 })} key={check} style={{ '--i': i } as CSSProperties}>
            <div className="lc-check-head">
              <span className="lc-badge">{list.length === 0 ? <FontAwesomeIcon icon={faCheck} /> : list.length}</span>
              <div>
                <h3>{lt(`check.${check}` as ViewKey)}</h3>
                <p>{lt(`check.${check}.about` as ViewKey)}</p>
              </div>
              {queue.length > 0 && (
                <button className="lc-review" onClick={() => onReview(queue)} type="button">{lt('check.review', { n: queue.length })}</button>
              )}
            </div>
            {list.length > 0 && (
              <div className="lc-mons" onPointerLeave={() => setHot(null)}>
                {list.map((flag) => (
                  <button
                    className={classNames('lc-mon', { away: !flag.record.here })}
                    key={flag.record.key}
                    onClick={() => flag.record.here && onReview([flag.record.capture.pokemon.id])}
                    onPointerEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setHot({ flag, x: rect.right, y: rect.top + rect.height / 2 });
                    }}
                    type="button"
                  >
                    <SceneMon pokemon={flag.record.capture.pokemon} shiny={flag.record.capture.shiny} view={flag.record.view} />
                  </button>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  ), [flags, locale, onReview]); // the rest follow from these

  return (
    <Scene hint={lt('check.hint')} name="view-check" onClose={onClose} quiet={Boolean(back)} title={lt('check.title')}>
      {({ scale }) => (
        <div className="lc-page" ref={pageRef} style={{ zoom: scale }}>
          <header className="lc-head">
            <div className="lc-ring" style={{ '--f': share } as CSSProperties}>
              <b>{Math.floor(share * 100)}<small>%</small></b>
            </div>
            <div className="lc-sum">
              <h2>{lt('check.clean', { clean, caught })}</h2>
              <p>{flagged.size ? lt('check.flagged', { n: flagged.size }) : lt('check.allClean')}</p>
              {everything.length > 0 && (
                <button className="lc-review" onClick={() => onReview(everything)} type="button">{lt('check.reviewAll', { n: everything.length })}</button>
              )}
            </div>
            <ScopeSwitch onChange={setScope} scope={scope} />
          </header>

          {checks}

          {hot && (
            <ViewTip scale={scale} x={hot.x} y={hot.y}>
              <strong>{displayName(hot.flag.record.capture.pokemon.name, hot.flag.record.capture.pokemon.name_ja, locale)}</strong>
              <small>{hot.flag.why}</small>
              {scope === 'all' && <small>{hot.flag.record.dex.title}</small>}
              {hot.flag.record.here && <em>{lt('check.press')}</em>}
            </ViewTip>
          )}
        </div>
      )}
    </Scene>
  );
}
