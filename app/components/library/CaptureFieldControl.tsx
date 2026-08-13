import { DateInput } from './DateInput';
import { DraftInput } from './DraftInput';
import { Dropdown } from './Dropdown';
import { NAME_MAX_FALLBACK, favoriteOptions, findSave, genderOptions, locationOptions, saveLabel } from '../../utils/capture-fields';
import { useDexContext } from '../../hooks/contexts/use-dex-context';
import { useTranslation } from '../../hooks/use-translation';

import type { CaptureField } from '../../utils/capture-fields';
import type { CaptureMetadata, GenderLock } from '../../types';
import type { ReactNode } from 'react';

// sentinel option value: the mon didn't come from one of the listed saves
const NOT_MINE = 'not-mine';

interface Props {
  field: CaptureField;
  value: Partial<CaptureMetadata>;
  onChange: (patch: Partial<CaptureMetadata>) => void;
  // defaults never carry OT — it fills from the save mapping at catch time
  defaultsMode?: boolean;
  // the mon's species constraint, narrowing the gender options
  genderLock?: GenderLock | null;
  idPrefix: string;
}

// one control per registry field, shared by the defaults form and the record
export function CaptureFieldControl ({ field, value, onChange, defaultsMode = false, genderLock = null, idPrefix }: Props) {
  const { t, locale } = useTranslation();
  const { saves, activeDexView } = useDexContext();

  const id = `${idPrefix}-${field.id}`;
  const blankLabel = t('common.unspecified');

  const wrap = (children: ReactNode) => (
    <div className="form-group" key={field.id}>
      <label htmlFor={id}>{t(field.labelKey)}</label>
      {children}
    </div>
  );

  const select = (
    selectId: string,
    current: string,
    options: { value: string; label: string; icon?: string }[],
    onSelect: (next: string) => void,
  ) => (
    <Dropdown blankLabel={blankLabel} id={selectId} onSelect={onSelect} options={options} value={current} />
  );

  const yesNoOptions = [
    { value: 'yes', label: t('common.yes') },
    { value: 'no', label: t('common.no') },
  ];

  switch (field.kind) {
    case 'select': {
      const key = field.keys[0];
      // favorite has no blank: unanswered shows as none, and a nickname floors the options
      if (field.id === 'favorite') {
        return wrap(
          <Dropdown
            id={id}
            onSelect={(next) => onChange({ favorite: next as CaptureMetadata['favorite'] })}
            options={favoriteOptions(locale, value)}
            value={value.favorite ?? 'none'}
          />,
        );
      }
      const options = field.id === 'gender' ? genderOptions(locale, genderLock) : field.options!(locale);
      return wrap(select(id, (value[key] as string) || '', options, (next) => onChange({ [key]: next || null })));
    }

    case 'text':
      return wrap(
        <DraftInput
          id={id}
          maxLength={field.maxLength?.(value) ?? 100}
          name={id}
          onCommit={(raw) => onChange({ [field.keys[0]]: raw || null })}
          type="text"
          value={(value[field.keys[0]] as string) || ''}
        />,
      );

    case 'number': {
      const key = field.keys[0];
      const committed = value[key] as number | null | undefined;
      return wrap(
        <DraftInput
          id={id}
          inputMode="numeric"
          max={field.max}
          min={field.min}
          name={id}
          onCommit={(raw) => {
            const parsed = parseInt(raw, 10);
            if (isNaN(parsed)) {
              onChange({ [key]: null });
              return;
            }
            onChange({ [key]: Math.min(field.max ?? Infinity, Math.max(field.min ?? -Infinity, parsed)) });
          }}
          type="number"
          value={typeof committed === 'number' ? String(committed) : ''}
        />,
      );
    }

    case 'date':
      return wrap(
        <DateInput
          id={id}
          onChange={(iso) => onChange({ catch_date: iso })}
          value={value.catch_date ?? null}
        />,
      );

    case 'yesno': {
      const key = field.keys[0];
      // two-state: unanswered reads as no
      const current = value[key] === true ? 'yes' : 'no';
      return wrap(
        <Dropdown
          id={id}
          onSelect={(next) => onChange({ [key]: next === 'yes' })}
          options={yesNoOptions}
          value={current}
        />,
      );
    }

    case 'save': {
      // derived from the game/language pair; picking writes through to it
      const matched = findSave(saves, value.origin_game ?? null, value.language ?? null);
      const current = matched ? matched.id : (value.origin_game || value.language ? NOT_MINE : '');

      const options = [
        ...saves.map((save) => ({ value: save.id, label: saveLabel(save, locale) })),
        { value: NOT_MINE, label: t('saves.notMine') },
      ];

      return wrap(select(id, current, options, (next) => {
        if (next === NOT_MINE) {
          // blanks the mapped trio for hand entry
          return onChange(defaultsMode
            ? { origin_game: null, language: null }
            : { origin_game: null, language: null, ot: null });
        }
        const save = saves.find((entry) => entry.id === next);
        if (!save) {
          return;
        }
        // an explicit pick restamps all three — foreign OTs are hand-edited after, and later wins
        onChange(defaultsMode
          ? { origin_game: save.game, language: save.language }
          : { origin_game: save.game, language: save.language, ot: save.ot });
      }));
    }

    case 'location': {
      const isHomeDex = activeDexView?.game.id === 'home';
      return (
        <div className="form-group" key={field.id}>
          <label htmlFor={id}>{t(field.labelKey)}</label>
          <Dropdown
            id={id}
            onSelect={(next) => onChange({ location: next as CaptureMetadata['location'] })}
            options={locationOptions(locale, value, isHomeDex)}
            value={value.location || ''}
          />
          {value.location === 'game' &&
            <div className="form-subgroup">
              <label htmlFor={`${id}-game`}>{t('location.whichGame')}</label>
              {select(
                `${id}-game`,
                value.location_save || '',
                saves.map((save) => ({ value: save.id, label: saveLabel(save, locale) })),
                (next) => onChange({ location_save: next || null }),
              )}
            </div>
          }
        </div>
      );
    }

    case 'nickname': {
      return (
        <div className="form-group" key={field.id}>
          <div className="checkbox">
            <label>
              <input
                checked={value.has_nickname === true}
                id={id}
                name={id}
                onChange={(e) => onChange({
                  has_nickname: e.target.checked,
                  // unchecking clears any text left behind
                  nickname: e.target.checked ? value.nickname ?? null : null,
                })}
                type="checkbox"
              />
              <span className="checkbox-custom"><span /></span>{t(field.labelKey)}
            </label>
          </div>
          {value.has_nickname === true &&
            <div className="form-subgroup">
              <DraftInput
                id={`${id}-text`}
                maxLength={field.maxLength?.(value) ?? NAME_MAX_FALLBACK}
                name={`${id}-text`}
                onCommit={(raw) => onChange({ nickname: raw || null })}
                type="text"
                value={value.nickname || ''}
              />
            </div>
          }
        </div>
      );
    }

    default:
      return null;
  }
}
