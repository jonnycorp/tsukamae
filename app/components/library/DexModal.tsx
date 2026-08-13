import classNames from 'classnames';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLongArrowAltRight, faXmark } from '@fortawesome/free-solid-svg-icons';
import { useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { CaptureFieldControl } from './CaptureFieldControl';
import { Dropdown } from './Dropdown';
import { DEFAULTABLE_FIELDS, withFieldInvariants } from '../../utils/capture-fields';
import { DEFAULT_CATALOG_KEY, DEX_CATALOG, getCatalogDex, progressToCaptures } from '../../utils/local-data';
import { localizeCatalogDexName, localizeCatalogGame, localizeDexType } from '../../i18n/names';
import { QueryKey } from '../../hooks/queries/captures';
import { useDexContext } from '../../hooks/contexts/use-dex-context';
import { useDismissable } from '../../hooks/use-dismissable';
import { useTranslation } from '../../hooks/use-translation';

import type { CaptureMetadata, CaptureStatus } from '../../types';
import type { CatalogDex, PersonalDex } from '../../utils/local-data';
import type { ChangeEvent, FormEvent, MouseEvent, ReactNode } from 'react';
import type { TranslationKey } from '../../i18n/translations';

const STATUS_OPTIONS: { value: CaptureStatus; labelKey: TranslationKey }[] = [
  { value: 'caught', labelKey: 'status.caught' },
  { value: 'temporary', labelKey: 'status.temporary' },
  { value: 'unobtainable', labelKey: 'status.unobtainable' },
];

interface ModalShellProps {
  children: ReactNode;
  // plays the overlay fade-out while true
  closing: boolean;
  contentLabel: string;
  onDismiss: () => void;
}

function ModalShell ({ children, closing, contentLabel, onDismiss }: ModalShellProps) {
  const { t } = useTranslation();

  const handleOverlayClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onDismiss();
    }
  };

  return (
    <div className={classNames('modal-overlay', { closing })} onClick={handleOverlayClick}>
      <div aria-label={contentLabel} className="modal" role="dialog">
        <button aria-label={t('popover.close')} className="modal-close" onClick={onDismiss} title={t('popover.close')} type="button">
          <FontAwesomeIcon icon={faXmark} />
        </button>
        {children}
      </div>
    </div>
  );
}

interface Props {
  // set to edit, absent to create
  dex?: PersonalDex;
  onRequestClose: () => void;
}

export function DexModal ({ dex, onRequestClose }: Props) {
  const { createDex, updateDex } = useDexContext();
  const { t, locale } = useTranslation();
  const queryClient = useQueryClient();
  const pendingActionRef = useRef<() => void>();
  const { closing, dismiss } = useDismissable({
    onDismissed: () => {
      pendingActionRef.current?.();
      onRequestClose();
    },
  });

  const initialCatalog = getCatalogDex(dex?.catalogKey || DEFAULT_CATALOG_KEY);

  const [title, setTitle] = useState(dex?.title || '');
  const [gameId, setGameId] = useState(initialCatalog.game.id);
  const [catalogKey, setCatalogKey] = useState(initialCatalog.key);
  const [shiny, setShiny] = useState(dex?.shiny || false);
  // creation-only and immutable — an existing dex must never convert
  const [checklist, setChecklist] = useState(false);
  const [defaultStatus, setDefaultStatus] = useState<CaptureStatus>(dex?.captureDefaults?.status || 'caught');
  const [defaults, setDefaults] = useState<Partial<CaptureMetadata>>(() => ({ ...dex?.captureDefaults }));

  const gamesWithDexes = useMemo(() => {
    const groups: { game: CatalogDex['game']; entries: CatalogDex[] }[] = [];
    const byGameId = new Map<string, { game: CatalogDex['game']; entries: CatalogDex[] }>();
    for (const entry of DEX_CATALOG) {
      let group = byGameId.get(entry.game.id);
      if (!group) {
        group = { game: entry.game, entries: [] };
        byGameId.set(entry.game.id, group);
        groups.push(group);
      }
      group.entries.push(entry);
    }
    return groups;
  }, []);

  const dexesForGame = useMemo(
    () => gamesWithDexes.find((group) => group.game.id === gameId)?.entries || [],
    [gamesWithDexes, gameId],
  );

  const handleTitleChange = (e: ChangeEvent<HTMLInputElement>) => setTitle(e.target.value);

  const handleGameChange = (newGameId: string) => {
    setGameId(newGameId);
    // default to the first dex of the newly selected game
    const firstEntry = gamesWithDexes.find((group) => group.game.id === newGameId)?.entries[0];
    if (firstEntry) {
      setCatalogKey(firstEntry.key);
    }
  };

  const handleShinyChange = (e: ChangeEvent<HTMLInputElement>) => setShiny(e.target.checked);
  const handleDefaultChange = (patch: Partial<CaptureMetadata>) =>
    setDefaults((prev) => ({ ...prev, ...patch, ...withFieldInvariants(prev, patch) }));

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // empty title falls back to the localized catalog name
    const resolvedTitle = title.trim() || localizeCatalogDexName(locale, catalogKey, getCatalogDex(catalogKey).name);

    const captureDefaults = { ...defaults, status: defaultStatus };

    if (dex) {
      updateDex(dex.id, { title: resolvedTitle, shiny, captureDefaults });
    } else {
      pendingActionRef.current = () => {
        const newDex = createDex({ title: resolvedTitle, catalogKey, shiny, checklist, captureDefaults: checklist ? undefined : captureDefaults });
        queryClient.setQueryData([QueryKey.ListCaptures, newDex.id], progressToCaptures(newDex));
      };
    }
    dismiss();
  };

  return (
    <ModalShell closing={closing} contentLabel={t(dex ? 'dexModal.editTitle' : 'dexModal.createTitle')} onDismiss={dismiss}>
      <div className="form">
        <h1>{t(dex ? 'dexModal.editTitle' : 'dexModal.createTitle')}</h1>
        <form className="dex-form" onSubmit={handleSubmit}>
          <div className="form-column">
            <div className="form-section-label">{t('dexModal.dexData')}</div>
            <div className="form-group">
              <label htmlFor="dex_title">{t('dexModal.titleLabel')}</label>
              <input
                className="form-control"
                id="dex_title"
                maxLength={300}
                name="dex_title"
                onChange={handleTitleChange}
                placeholder={localizeCatalogDexName(locale, catalogKey, getCatalogDex(catalogKey).name)}
                type="text"
                value={title}
              />
            </div>
            {!dex &&
              <>
                <div className="form-group">
                  <label htmlFor="dex_game">{t('dexModal.game')}</label>
                  <Dropdown
                    id="dex_game"
                    onSelect={handleGameChange}
                    options={gamesWithDexes.map((group) => ({ value: group.game.id, label: localizeCatalogGame(locale, group.game.id, group.game.name) }))}
                    value={gameId}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="dex_catalog">{t('dexModal.dex')}</label>
                  <Dropdown
                    id="dex_catalog"
                    onSelect={setCatalogKey}
                    options={dexesForGame.map((entry) => ({ value: entry.key, label: `${localizeDexType(locale, entry.dex_type.name)} (${entry.total})` }))}
                    value={catalogKey}
                  />
                </div>
              </>
            }
            <div className="form-group">
              <div className="checkbox">
                <label>
                  <input
                    checked={shiny}
                    id="shiny"
                    name="shiny"
                    onChange={handleShinyChange}
                    type="checkbox"
                  />
                  <span className="checkbox-custom"><span /></span>{t('common.shiny')}
                </label>
              </div>
            </div>
            {!dex &&
              <div className="form-group">
                <div className="checkbox">
                  <label>
                    <input
                      checked={checklist}
                      id="checklist"
                      name="checklist"
                      onChange={(e) => setChecklist(e.target.checked)}
                      type="checkbox"
                    />
                    <span className="checkbox-custom"><span /></span>{t('dexModal.checklist')}
                  </label>
                </div>
              </div>
            }
          </div>
          {!checklist && <>
            <div className="form-section-label">
              {t('dexModal.defaults')} <span className="optional-tag">({t('common.optional')})</span>
            </div>
            <div className="form-row">
              <div className="form-column">
                <div className="form-group">
                  <label htmlFor="default_status">{t('info.status')}</label>
                  <Dropdown
                    id="default_status"
                    onSelect={(next) => setDefaultStatus(next as CaptureStatus)}
                    options={STATUS_OPTIONS.map((option) => ({ value: option.value, label: t(option.labelKey) }))}
                    value={defaultStatus}
                  />
                </div>
                {DEFAULTABLE_FIELDS.slice(0, 2).map((field) => (
                  <CaptureFieldControl
                    defaultsMode
                    field={field}
                    idPrefix="default"
                    key={field.id}
                    onChange={handleDefaultChange}
                    value={defaults}
                  />
                ))}
              </div>
              <div className="form-column">
                {DEFAULTABLE_FIELDS.slice(2).map((field) => (
                  <CaptureFieldControl
                    defaultsMode
                    field={field}
                    idPrefix="default"
                    key={field.id}
                    onChange={handleDefaultChange}
                    value={defaults}
                  />
                ))}
              </div>
            </div>
          </>}
          <button className="btn btn-blue" type="submit">
            {t(dex ? 'dexModal.save' : 'dexModal.create')} <FontAwesomeIcon icon={faLongArrowAltRight} />
          </button>
        </form>
      </div>
    </ModalShell>
  );
}
