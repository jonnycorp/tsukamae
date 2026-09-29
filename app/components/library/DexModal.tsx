import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLongArrowAltRight } from '@fortawesome/free-solid-svg-icons';
import { useRef, useState } from 'react';

import { CaptureFieldControl } from './CaptureFieldControl';
import { Dropdown } from './Dropdown';
import { ModalShell } from './ModalShell';
import { DEFAULTABLE_BASELINES, DEFAULTABLE_FIELDS, STATUSES, statusOptions, withBaselines, withFieldInvariants } from '../../utils/capture-fields';
import { DEFAULT_CATALOG_KEY, DEX_CATALOG, getCatalogDex } from '../../utils/local-data';
import { localizeCatalogDexName, localizeCatalogGame, localizeDexType } from '../../i18n/names';
import { useDexContext } from '../../hooks/contexts/use-dex-context';
import { useDismissable } from '../../hooks/use-dismissable';
import { useTranslation } from '../../hooks/use-translation';

import type { CaptureMetadata, CaptureStatus } from '../../types';
import type { CatalogDex, PersonalDex } from '../../utils/local-data';
import type { ChangeEvent, FormEvent } from 'react';

interface CatalogGroup {
  game: CatalogDex['game'];
  entries: CatalogDex[];
}

const CATALOG_GROUPS = DEX_CATALOG.reduce<CatalogGroup[]>((groups, entry) => {
  const group = groups.find((existing) => existing.game.id === entry.game.id);
  if (group) {
    group.entries.push(entry);
  } else {
    groups.push({ game: entry.game, entries: [entry] });
  }
  return groups;
}, []);

interface Props {
  dex?: PersonalDex;
  onRequestClose: () => void;
}

export function DexModal ({ dex, onRequestClose }: Props) {
  const { createDex, updateDex } = useDexContext();
  const { t, locale } = useTranslation();
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
  // chosen at creation only and immutable — an existing dex must never convert
  const [checklist, setChecklist] = useState(Boolean(dex?.checklist));
  // a stored status this version doesn't write (a hand edit) shows, and saves, as the caught a click falls back to
  const [defaultStatus, setDefaultStatus] = useState<CaptureStatus>(() => {
    const stored = dex?.captureDefaults?.status;
    return stored && STATUSES.includes(stored) ? stored : 'caught';
  });
  const [defaults, setDefaults] = useState<Partial<CaptureMetadata>>(() => withBaselines({ ...dex?.captureDefaults }, DEFAULTABLE_BASELINES));

  const dexesForGame = CATALOG_GROUPS.find((group) => group.game.id === gameId)?.entries || [];

  const handleTitleChange = (e: ChangeEvent<HTMLInputElement>) => setTitle(e.target.value);

  const handleGameChange = (newGameId: string) => {
    // re-picking the game shown keeps the dex picked under it
    if (newGameId === gameId) {
      return;
    }
    setGameId(newGameId);
    const firstEntry = CATALOG_GROUPS.find((group) => group.game.id === newGameId)?.entries[0];
    if (firstEntry) {
      setCatalogKey(firstEntry.key);
    }
  };

  const handleShinyChange = (e: ChangeEvent<HTMLInputElement>) => setShiny(e.target.checked);
  const handleDefaultChange = (patch: Partial<CaptureMetadata>) =>
    setDefaults((prev) => ({ ...prev, ...patch, ...withFieldInvariants(prev, patch) }));

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const resolvedTitle = title.trim() || localizeCatalogDexName(locale, catalogKey, getCatalogDex(catalogKey).name);

    const captureDefaults = { ...defaults, status: defaultStatus };

    // a checklist has no defaults, and never had them to keep
    if (dex) {
      updateDex(dex.id, { title: resolvedTitle, shiny, captureDefaults: dex.checklist ? undefined : captureDefaults });
    } else {
      pendingActionRef.current = () => createDex({ title: resolvedTitle, catalogKey, shiny, checklist, captureDefaults: checklist ? undefined : captureDefaults });
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
                    options={CATALOG_GROUPS.map((group) => ({ value: group.game.id, label: localizeCatalogGame(locale, group.game.id, group.game.name) }))}
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
              {t('dexModal.defaults')} <span className="optional-tag">{t('common.optional')}</span>
            </div>
            <div className="form-row">
              <div className="form-column">
                <div className="form-group">
                  <label htmlFor="default_status">{t('info.status')}</label>
                  <Dropdown
                    id="default_status"
                    onSelect={(next) => setDefaultStatus(next as CaptureStatus)}
                    options={statusOptions(locale)}
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
