import classNames from 'classnames';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faListCheck } from '@fortawesome/free-solid-svg-icons';
import { useMemo } from 'react';

import { BALL_NAMES, LANGUAGES, LANGUAGE_ABBRS, ORIGIN_GAME_NAMES, saveLabel } from '../../../utils/capture-fields';
import { Scene, SceneMon } from './Scene';
import { GAME_FACTS } from '../../../utils/game-facts';
import { dexNumber } from '../../../utils/pokemon';
import { displayName } from '../../library/PokemonName';
import { localizeBall, localizeCaptureLanguage, localizeOriginGame } from '../../../i18n/names';
import { originOf } from '../../../utils/game-reach';
import { redPen } from './redpen-model';
import { placeLabel } from '../../../utils/location-moves';
import { useDexContext } from '../../../hooks/contexts/use-dex-context';
import { useLocalStorage } from '../../../hooks/use-local-storage';
import { useTrackerState } from './use-tracker';
import { useTranslation } from '../../../hooks/use-translation';

import type { Capture } from '../../../types';
import type { CSSProperties } from 'react';
import type { Finding, Flagged, Mark, Variant } from './redpen-model';
import type { TranslationKey } from '../../../i18n/translations';

// the rows draw in turn as the sheet opens, so many at most before the rest draw together
const STAGGER_MAX = 14;

const REGIONAL_FORM_KEYS: Record<string, TranslationKey> = {
  alola: 'redpen.form.alola',
  galar: 'redpen.form.galar',
  hisui: 'redpen.form.hisui',
  paldea: 'redpen.form.paldea',
};

// a pen's ring round a word: begun a little off, taken once round and a little past, its radius drifting out as the
// hand goes; in a 100 × 40 box, stretched to its word's (the stroke kept its width)
const LOOP = (() => {
  const steps = 56;
  let d = '';
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = ((-115 + t * 400) * Math.PI) / 180;
    const grow = 1 + 0.08 * t;
    d += `${i === 0 ? 'M' : 'L'}${(50 + 47 * grow * Math.cos(a)).toFixed(2)},${(20 + 16 * grow * Math.sin(a)).toFixed(2)}`;
  }
  return d;
})();

// はなまる, the flower a teacher draws on a perfect paper: a spiral at its heart and a ring of petals round it
const HANAMARU = (() => {
  let d = '';
  for (let i = 0; i <= 96; i++) {
    const t = i / 96;
    const a = t * Math.PI * 5 - Math.PI / 2;
    const r = 5 + t * 25;
    d += `${i === 0 ? 'M' : 'L'}${(60 + r * Math.cos(a)).toFixed(1)},${(60 + r * Math.sin(a)).toFixed(1)}`;
  }
  const petals = 6;
  for (let i = 0; i <= 180; i++) {
    const t = i / 180;
    const a = t * Math.PI * 2.08 - Math.PI / 2;
    const r = 38 + 15 * Math.abs(Math.sin((petals * a) / 2)) ** 0.75;
    d += `${i === 0 ? 'M' : 'L'}${(60 + r * Math.cos(a)).toFixed(1)},${(60 + r * Math.sin(a)).toFixed(1)}`;
  }
  return d;
})();

// ✗ for what can't be right, △ for what's worth a look, in the pen's strokes
function PenMark ({ kind }: { kind: 'wrong' | 'look' }) {
  return (
    <svg aria-hidden="true" className={classNames('rp-mark', kind)} viewBox="0 0 24 24">
      {kind === 'wrong'
        ? (
          <>
            <path d="M4.5,5.5 Q12,11 19.5,18.8" pathLength={1} />
            <path className="second" d="M19,4.5 Q11.5,12.5 4.8,19.6" pathLength={1} />
          </>
        )
        : <path d="M12,3.5 L20.8,19.2 L3.2,19 L12.8,2.6" pathLength={1} />}
    </svg>
  );
}

interface Props {
  onClose: () => void;
  onLocate: (pokemon: number) => void;
  // the review through every flagged mon, from the one pressed
  onReview: (queue: number[], start?: number) => void;
}

// the red pen (P): the dex's records read over as a teacher reads a paper, in red ink on ruled paper. What can't be
// right gets a ✗ (a date before its game came out, a species newer than the game it came from, a ball or a language
// the game never had, a game too old to hold the mon it's in, an ID No. that isn't the file its OT is, a name longer
// than its game took), what's worth a second look a △ (a mon its game's dex doesn't list, a Strange Ball, your name
// with an ID No. none of your files has, a name its language's games can't type), each with the fields it's about
// ringed and a note in the margin. One trainer's name written two ways is listed apart. The sheet is marked out of
// 100, the share of records with nothing wrong; a perfect one gets はなまる. A row runs the review through every
// flagged mon from it, as the place to put it right
export function RedPen ({ onClose, onLocate, onReview }: Props) {
  const { captures } = useTrackerState();
  const { saves, activeDexView } = useDexContext();
  const { t, locale } = useTranslation();
  const dex = activeDexView!;
  // unsealed drafts are placeholders, read only when asked for and never scored
  const [drafts, setDrafts] = useLocalStorage('redpenDrafts', false);
  const data = useMemo(() => redPen(captures, saves, { drafts }), [captures, saves, drafts]);
  const wrong = data.flagged.filter((entry) => entry.severity === 'wrong');
  const look = data.flagged.filter((entry) => entry.severity === 'look');
  // the review's run in the sheet's order: what can't be right, then what's worth a look
  const queue = [...wrong, ...look].map((entry) => entry.capture.pokemon.id);
  // out of the sealed records: a slip anywhere keeps it off 100 (one in nine hundred is 99), and with nothing sealed
  // there's no paper to mark
  const sealedWrong = wrong.filter((entry) => entry.capture.sealed).length;
  const score = data.sealed > 0 ? Math.floor((100 * (data.sealed - sealedWrong)) / data.sealed) : null;
  const perfect = score !== null && sealedWrong === 0;

  const gameName = (id: string) => localizeOriginGame(locale, id, ORIGIN_GAME_NAMES.get(id) ?? id);
  const ballName = (id: string) => localizeBall(locale, id, BALL_NAMES.get(id) ?? id);
  const languageName = (id: string) => localizeCaptureLanguage(locale, id, LANGUAGES.find((language) => language.id === id)?.name ?? id);
  const fileName = (id: string | undefined) => {
    const save = saves.find((entry) => entry.id === id);
    return save ? saveLabel(save, locale, saves) : '';
  };
  const slashed = (date: string | null | undefined) => (date ?? '').replaceAll('-', '/');
  // a regional form named as one, as its slot shares its species' name and a note about when it came out is the form's
  const monName = (capture: Capture) => {
    const name = displayName(capture.pokemon.name, capture.pokemon.name_ja, locale);
    const form = capture.pokemon.form;
    return form && REGIONAL_FORM_KEYS[form] ? t(REGIONAL_FORM_KEYS[form], { name }) : name;
  };

  const chip = (mark: Mark, capture: Capture): { label: string; value: string; ball?: string } => {
    switch (mark) {
      case 'species':
        return { label: t('filter.generation'), value: t('filter.gen', { n: capture.pokemon.generation }) };
      case 'origin_game':
        return { label: t('info.originGame'), value: gameName(capture.origin_game!) };
      case 'catch_date':
        return { label: t('info.catchDate'), value: slashed(capture.catch_date) };
      case 'ball':
        return { label: t('info.ball'), value: ballName(capture.ball!), ball: capture.ball! };
      case 'language':
        return { label: t('info.language'), value: LANGUAGE_ABBRS.get(capture.language!) ?? capture.language! };
      case 'location':
        return { label: t('info.location'), value: placeLabel({ location: 'game', location_save: capture.location_save }, saves, locale) };
      case 'tid':
        return { label: t('info.tid'), value: capture.tid ?? '' };
      case 'nickname':
        return { label: t('info.nickname'), value: capture.nickname ?? '' };
      default:
        return { label: t('info.ot'), value: capture.ot ?? '' };
    }
  };

  const note = (finding: Finding, capture: Capture): string => {
    const name = monName(capture);
    // as the rules read it: a mon HOME handed out is HOME's, whatever origin mark it came with
    const origin = originOf(capture, saves) ?? '';
    const game = origin ? gameName(origin) : '';
    const gameGen = GAME_FACTS[origin]?.gen ?? '';
    const language = capture.language ? languageName(capture.language) : '';
    const ot = capture.ot ?? '';
    const tid = capture.tid ?? '';
    const save = placeLabel({ location: 'game', location_save: capture.location_save }, saves, locale);
    switch (finding.rule) {
      case 'future':
        return t('redpen.rule.future', { date: slashed(capture.catch_date) });
      case 'beforeRelease':
        return t('redpen.rule.beforeRelease', { game, release: slashed(GAME_FACTS[origin]?.release) });
      case 'newerSpecies':
        return t('redpen.rule.newerSpecies', { name, gen: finding.gen ?? '', game, gameGen });
      case 'notInGame':
        return t('redpen.rule.notInGame', { name, game });
      case 'hisuiBall':
        return t('redpen.rule.hisuiBall', { ball: ballName(capture.ball!) });
      case 'arceusTwin':
        return t('redpen.rule.arceusTwin', { ball: ballName(capture.ball!), twin: ballName(finding.twin!) });
      case 'arceusBall':
        return t('redpen.rule.arceusBall', { ball: ballName(capture.ball!) });
      case 'letsGoBall':
        return t('redpen.rule.letsGoBall');
      case 'ballTooNew':
        return t('redpen.rule.ballTooNew', { ball: ballName(capture.ball!), ballGen: finding.gen ?? '', game, gameGen });
      case 'languageTooNew':
        return t('redpen.rule.languageTooNew', { game, language });
      case 'saveTooOld':
        return t('redpen.rule.saveTooOld', { name, save });
      case 'saveBackward':
        return t('redpen.rule.saveBackward', { save, game });
      case 'idForm':
        return t('redpen.rule.idOld', { tid, gen: finding.gen ?? '' });
      case 'idMismatch':
        return t('redpen.rule.idMismatch', { tid, ot, save: fileName(finding.save), game, language: LANGUAGE_ABBRS.get(capture.language ?? '') ?? '' });
      case 'otMismatch':
        return t('redpen.rule.otMismatch', { tid, ot, save: fileName(finding.save), saveOt: saves.find((entry) => entry.id === finding.save)?.ot ?? '' });
      case 'otTooLong':
        return t('redpen.rule.otTooLong', { game, language, max: finding.max ?? '', n: finding.length ?? '' });
      case 'nicknameTooLong':
        return t('redpen.rule.nicknameTooLong', { game, language, max: finding.max ?? '', n: finding.length ?? '' });
      case 'notInDex':
        return t('redpen.rule.notInDex', { name, game });
      case 'strangeBall':
        return t('redpen.rule.strangeBall');
      case 'idUnknown':
        return t('redpen.rule.idUnknown', { ot, save: fileName(finding.save), tid });
      case 'otScript':
        return t('redpen.rule.otScript', { language });
      case 'nicknameScript':
        return t('redpen.rule.nicknameScript', { language });
      default:
        return t('redpen.rule.otLanguage', { ot, game, language: LANGUAGE_ABBRS.get(capture.language ?? '') ?? '' });
    }
  };

  const row = (entry: Flagged, i: number) => {
    const { capture } = entry;
    const marks = [...new Set(entry.findings.flatMap((finding) => finding.marks))];
    return (
      <li className={classNames('rp-row', entry.severity)} key={capture.pokemon.id} style={{ '--n': Math.min(i, STAGGER_MAX) } as CSSProperties}>
        <button className="rp-row-main" onClick={() => onReview(queue, capture.pokemon.id)} title={t('redpen.fix')} type="button">
          <PenMark kind={entry.severity} />
          <SceneMon pokemon={capture.pokemon} />
          <span className="rp-who">
            <span className="rp-name">{monName(capture)}</span>
            <span className="rp-no">#{dexNumber(capture.pokemon, dex)}{!capture.sealed && <span className="rp-draft">{t('redpen.unsealed')}</span>}</span>
          </span>
          <span className="rp-chips">
            {marks.map((mark) => {
              const { label, value, ball } = chip(mark, capture);
              return (
                <span className="rp-chip" key={mark}>
                  <span className="rp-chip-label">{label}</span>
                  <span className="rp-chip-value">{ball && ball !== 'unknown' && <img alt="" src={`/balls/${ball}.png`} />}{value}</span>
                  <svg aria-hidden="true" className="rp-loop" preserveAspectRatio="none" viewBox="0 0 100 40">
                    <path d={LOOP} pathLength={1} vectorEffect="non-scaling-stroke" />
                  </svg>
                </span>
              );
            })}
          </span>
          <span className="rp-notes">
            {entry.findings.map((finding) => <span className="rp-note" key={finding.rule}>{note(finding, capture)}</span>)}
          </span>
        </button>
        <button className="rp-locate" onClick={() => onLocate(capture.pokemon.id)} type="button">{t('redpen.show')}</button>
      </li>
    );
  };

  const variantRow = (variant: Variant, i: number) => {
    const odd = variant.spellings.slice(1).flatMap((spelling) => spelling.captures.map((capture) => capture.pokemon.id));
    return (
      <li className="rp-row look rp-variant" key={`${variant.game ?? ''}:${variant.tid ?? ''}:${variant.spellings[0].ot}`} style={{ '--n': Math.min(i, STAGGER_MAX) } as CSSProperties}>
        <div className="rp-row-main">
          <PenMark kind="look" />
          <span className="rp-spellings">
            {variant.spellings.map((spelling, at) => (
              <span className={classNames('rp-spelling', { usual: at === 0 })} key={spelling.ot}>
                <q>{spelling.ot}</q><b>×{spelling.captures.length}</b>
              </span>
            ))}
          </span>
          <span className="rp-notes">
            <span className="rp-note">
              {variant.tid
                ? t('redpen.variantNoteId', { n: variant.spellings.length, tid: variant.tid, game: gameName(variant.game ?? '') })
                : t('redpen.variantNote', { n: variant.spellings.length })}
            </span>
          </span>
        </div>
        <button className="rp-locate" onClick={() => onReview(odd)} type="button">{t('redpen.reviewOdd', { n: odd.length })}</button>
      </li>
    );
  };

  return (
    <Scene hint={t('redpen.hint')} name="redpen" onClose={onClose} title={t('redpen.title')}>
      {({ scale }) => (
        <div className="rp-page" style={{ zoom: scale }}>
          <article className="rp-sheet">
            <header className="rp-sheet-head">
              <div className="rp-heading">
                <h2>{t('redpen.sheet')}</h2>
                <span>{drafts ? t('redpen.checkedDrafts', { n: data.sealed, d: data.drafts }) : t('redpen.checked', { n: data.sealed })}</span>
                <span className="rp-tally">
                  <span><PenMark kind="wrong" />{t('redpen.wrongCount', { n: wrong.length })}</span>
                  <span><PenMark kind="look" />{t('redpen.lookCount', { n: look.length + data.variants.length })}</span>
                </span>
              </div>
              {score !== null && (
                <div className={classNames('rp-score', { perfect })}>
                  {perfect && (
                    <svg aria-hidden="true" className="rp-hanamaru" viewBox="0 0 120 120">
                      <path d={HANAMARU} pathLength={1} />
                    </svg>
                  )}
                  <strong>{score}</strong>
                  <span>{t('redpen.points')}</span>
                  <svg aria-hidden="true" className="rp-underline" preserveAspectRatio="none" viewBox="0 0 100 10">
                    <path d="M2,4 Q50,1.5 98,3.6 M6,8 Q52,5.8 95,7.4" pathLength={1} vectorEffect="non-scaling-stroke" />
                  </svg>
                </div>
              )}
            </header>
            <div className="rp-tools">
              {queue.length > 0 &&
                <button className="rp-review-all" onClick={() => onReview(queue)} type="button">
                  <FontAwesomeIcon icon={faListCheck} />{t('redpen.reviewAll', { n: queue.length })}
                </button>
              }
              <button aria-pressed={drafts} className={classNames('rp-drafts', { on: drafts })} onClick={() => setDrafts(!drafts)} type="button">
                <span className="rp-drafts-box" />{t('redpen.drafts')}
              </button>
              <span className="rp-drafts-note">{t('redpen.draftsNote')}</span>
            </div>
            {wrong.length > 0 &&
              <section className="rp-section">
                <h3><PenMark kind="wrong" />{t('redpen.wrong')}</h3>
                <ol className="rp-rows">{wrong.map(row)}</ol>
              </section>
            }
            {look.length > 0 &&
              <section className="rp-section">
                <h3><PenMark kind="look" />{t('redpen.look')}</h3>
                <ol className="rp-rows">{look.map(row)}</ol>
              </section>
            }
            {data.variants.length > 0 &&
              <section className="rp-section">
                <h3><PenMark kind="look" />{t('redpen.variants')}</h3>
                <ol className="rp-rows">{data.variants.map(variantRow)}</ol>
              </section>
            }
            {data.flagged.length === 0 && data.variants.length === 0 &&
              <p className="rp-clear">{data.sealed + data.drafts > 0 ? t('redpen.clear') : t('redpen.nothing')}</p>
            }
          </article>
        </div>
      )}
    </Scene>
  );
}
