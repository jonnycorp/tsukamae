import classNames from 'classnames';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { createPortal } from 'react-dom';
import { faBan, faCheck, faClock, faLock, faTrash, faXmark } from '@fortawesome/free-solid-svg-icons';
import { useState } from 'react';

import { CAPTURE_FIELDS, findSave, saveLabel, unansweredFields } from '../../../utils/capture-fields';
import { CaptureFieldControl, NOT_MINE } from '../../library/CaptureFieldControl';
import { Dropdown } from '../../library/Dropdown';
import { destinations, placeFromKey, placeKey, placeLabel } from '../../../utils/location-moves';
import { useDexContext } from '../../../hooks/contexts/use-dex-context';
import { useMark } from './use-mark';
import { usePatchRecords } from './use-patch';
import { useTrackerActions } from './use-tracker';
import { useTranslation } from '../../../hooks/use-translation';

import type { Capture, CaptureStatus } from '../../../types';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import type { RecordPatch } from './use-patch';
import type { TranslationKey } from '../../../i18n/translations';

const STATUS_BUTTONS: { status: CaptureStatus; icon: IconDefinition }[] = [
  { status: 'caught', icon: faCheck },
  { status: 'temporary', icon: faClock },
  { status: 'unobtainable', icon: faBan },
];

// what can be set on many at once: what a run of mons from one game shares, not what's each one's own (gender,
// nickname); My Game sets the game, language and OT together
type BatchField = 'save' | 'origin_game' | 'language' | 'ot' | 'ball' | 'catch_date' | 'level' | 'trained' | 'favorite' | 'location';
const BATCH_FIELDS: BatchField[] = ['save', 'origin_game', 'language', 'ot', 'ball', 'catch_date', 'level', 'trained', 'favorite', 'location'];

interface Props {
  // the selected mons, in the dex's order
  targets: Capture[];
  // how many rows are shown, which Select all would take
  shown: number;
  onSelectAll: () => void;
  onClear: () => void;
}

// the ledger's selection, acted on at once: a status for every unsealed one (marking the unmarked as a tile would), a
// field set on every marked record (a sealed one only moved, as its popover would), sealing those ready, releasing
export function BatchBar ({ targets, shown, onSelectAll, onClear }: Props) {
  const { activeDex, activeDexView, saves } = useDexContext();
  const { releaseCaptures, moveTo } = useTrackerActions();
  const { t, locale } = useTranslation();
  const mark = useMark();
  const patchRecords = usePatchRecords();
  const checklist = Boolean(activeDex!.checklist);
  const homeDex = activeDexView!.game.id === 'home';
  const [field, setField] = useState<BatchField>('save');
  const [draft, setDraft] = useState<RecordPatch>({});

  const unsealed = targets.filter((capture) => !capture.sealed);
  const recorded = targets.filter((capture) => capture.captured && capture.status !== 'unobtainable');
  const editable = recorded.filter((capture) => !capture.sealed);
  // a sealed record can still move (utils/location-moves), nothing else
  const settable = field === 'location' ? recorded : editable;
  const sealable = editable.filter((capture) => capture.status === 'caught' && unansweredFields(capture, capture.pokemon.gender_lock).length === 0);
  const releasable = targets.filter((capture) => capture.captured && !capture.sealed);
  const ready = Object.keys(draft).length > 0 && settable.length > 0;

  const setStatus = (status: CaptureStatus) => {
    const changing = unsealed.filter((capture) => capture.status !== status);
    if (checklist) {
      changing.forEach((capture) => mark(capture.pokemon.id, status));
      return;
    }
    changing.filter((capture) => !capture.captured).forEach((capture) => mark(capture.pokemon.id, status));
    patchRecords(changing.filter((capture) => capture.captured), { status });
  };

  const apply = () => {
    if (!ready) {
      return;
    }
    if (field === 'location') {
      const place = { location: draft.location!, location_save: draft.location_save ?? null };
      recorded.filter((capture) => capture.sealed).forEach((capture) => moveTo(capture.pokemon.id, place));
      // Champions is only reachable from a mon that's been there, so moving one there says it has
      patchRecords(editable, { ...place, ...(place.location === 'champions' ? { been_to_champions: true } : {}) });
    } else {
      patchRecords(editable, draft);
    }
    setDraft({});
  };

  const seal = () => {
    if (sealable.length > 0 && window.confirm(t('batch.sealConfirm', { n: sealable.length }))) {
      patchRecords(sealable, { sealed: true });
    }
  };

  const release = () => {
    if (releasable.length > 0 && window.confirm(t('batch.releaseConfirm', { n: releasable.length }))) {
      releaseCaptures(releasable.map((capture) => capture.pokemon.id));
    }
  };

  const fieldOptions = BATCH_FIELDS.map((id) => ({
    value: id,
    label: t(id === 'save' ? 'info.myGame' : CAPTURE_FIELDS.find((entry) => entry.id === id)!.labelKey as TranslationKey),
  }));
  // My Game as a draft, not a record (CaptureFieldControl's): blank sets nothing, Not my game clears the game, the
  // language and the OT on each
  const saveControl = (
    <Dropdown
      blankLabel={t('common.unspecified')}
      id="batch-save"
      onSelect={(key) => {
        const save = saves.find((entry) => entry.id === key);
        setDraft(save
          ? { origin_game: save.game, language: save.language, ot: save.ot, tid: save.tid ?? null }
          : key === NOT_MINE ? { origin_game: null, language: null, ot: null, tid: null } : {});
      }}
      options={[...saves.map((save) => ({ value: save.id, label: saveLabel(save, locale, saves) })), { value: NOT_MINE, label: t('saves.notMine') }]}
      value={draft.origin_game === null ? NOT_MINE : findSave(saves, draft.origin_game ?? null, draft.language ?? null, draft.tid ?? null)?.id ?? ''}
    />
  );
  const control = field === 'location'
    ? (
      <Dropdown
        blankLabel={t('common.unspecified')}
        id="batch-location"
        onSelect={(key) => setDraft(key ? placeFromKey(key) : {})}
        options={destinations(saves, homeDex).map((place) => ({ value: placeKey(place), label: placeLabel(place, saves, locale) }))}
        value={draft.location ? placeKey({ location: draft.location, location_save: draft.location_save ?? null }) : ''}
      />
    )
    : field === 'save' ? saveControl : (
      <CaptureFieldControl
        field={CAPTURE_FIELDS.find((entry) => entry.id === field)!}
        idPrefix="batch"
        key={field}
        onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))}
        value={draft}
      />
    );

  return createPortal(
    // of the page though portalled out of it: a modal or scene over the page holds it inert too (useInertPage)
    <div aria-label={t('batch.selected', { n: targets.length })} className="batch-bar" data-page-layer role="toolbar">
      <div className="batch-count">
        <strong>{t('batch.selected', { n: targets.length })}</strong>
        {targets.length < shown && <button className="batch-link" onClick={onSelectAll} type="button">{t('batch.selectAllN', { n: shown })}</button>}
      </div>

      <div className="batch-group batch-status" role="group">
        {STATUS_BUTTONS.map(({ status, icon }) => (
          <button
            className={classNames('batch-button', `status-${status}`)}
            disabled={unsealed.every((capture) => capture.status === status)}
            key={status}
            onClick={() => setStatus(status)}
            title={t(`status.${status}`)}
            type="button"
          >
            <FontAwesomeIcon icon={icon} />{t(`status.${status}`)}
          </button>
        ))}
      </div>

      {!checklist &&
        <div className="batch-group batch-set">
          <Dropdown
            id="batch-field"
            onSelect={(next) => {
              setField(next as BatchField);
              setDraft({});
            }}
            options={fieldOptions}
            triggerClassName="batch-field-pick"
            value={field}
          />
          <div className="batch-control">{control}</div>
          {/* pressable before a typed value is in: the press blurs the field, which commits it in time */}
          <button className={classNames('batch-button batch-apply', { ready })} disabled={settable.length === 0} onClick={apply} type="button">
            {t('batch.apply', { n: settable.length })}
          </button>
        </div>
      }

      <div className="batch-group">
        {!checklist &&
          <button className="batch-button" disabled={sealable.length === 0} onClick={seal} type="button">
            <FontAwesomeIcon icon={faLock} />{t('batch.seal', { n: sealable.length })}
          </button>
        }
        <button className="batch-button batch-release" disabled={releasable.length === 0} onClick={release} type="button">
          <FontAwesomeIcon icon={faTrash} />{t('batch.release', { n: releasable.length })}
        </button>
      </div>

      <button aria-label={t('batch.clear')} className="batch-close" onClick={onClear} title={`${t('batch.clear')} (Esc)`} type="button">
        <FontAwesomeIcon icon={faXmark} />
      </button>
    </div>,
    document.body,
  );
}
