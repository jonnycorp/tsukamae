import classNames from 'classnames';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBookOpen, faCheck, faChevronDown, faListCheck, faPencilAlt, faTableCells, faTableList, faTimeline } from '@fortawesome/free-solid-svg-icons';
import { Fragment, useEffect, useRef, useState } from 'react';

import { DexIndicator } from '../../library/DexIndicator';
import { useDexContext } from '../../../hooks/contexts/use-dex-context';
import { useTranslation } from '../../../hooks/use-translation';

import type { DexLayout } from './ledger-model';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import type { ReactNode } from 'react';
import type { TranslationKey } from '../../../i18n/translations';

const LAYOUTS: { id: DexLayout; labelKey: TranslationKey; icon: IconDefinition }[] = [
  { id: 'boxes', labelKey: 'layout.boxes', icon: faTableCells },
  { id: 'ledger', labelKey: 'layout.ledger', icon: faTableList },
];

interface Props {
  layout: DexLayout;
  onLayout: (layout: DexLayout) => void;
  // unset in a checklist, which keeps no catch dates and no records to review
  onOpenTimeline?: () => void;
  onOpenReview?: () => void;
  onOpenAlmanac: () => void;
  onEditDex: () => void;
}

// the dex's name over a menu of what were the header's buttons, each with its key: the scenes (Timeline, Almanac,
// Review), the boxes or the ledger, and Edit Dex. In the nav menus' look (and their class, so the shortcuts stand down
// while it's open); closes on a pick, a press outside, or an Esc nothing else has claimed
export function DexMenu ({ layout, onEditDex, onLayout, onOpenAlmanac, onOpenReview, onOpenTimeline }: Props) {
  const { activeDex, activeDexView } = useDexContext();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handleMouseDown = (e: MouseEvent) => {
      if (e.target instanceof Node && !ref.current?.contains(e.target)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        e.preventDefault();
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const item = (icon: IconDefinition, label: string, key: string | null, run: () => void, extra: { checked?: boolean; className?: string } = {}): ReactNode => (
    <li
      aria-checked={extra.checked}
      className={classNames(extra.className, { checked: extra.checked })}
      onClick={() => {
        setOpen(false);
        run();
      }}
      role={extra.checked === undefined ? 'menuitem' : 'menuitemradio'}
    >
      <FontAwesomeIcon icon={icon} />
      <span className="dex-menu-label">{label}</span>
      {key && <kbd className="dex-menu-key">{key}</kbd>}
      {extra.checked && <FontAwesomeIcon className="dex-menu-check" icon={faCheck} />}
    </li>
  );

  return (
    <div className="header-row nav-menu dex-menu" ref={ref}>
      <h1>
        <button aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((prev) => !prev)} title={t('dexMenu.label')} type="button">
          <span className="dex-menu-name">{activeDex!.title}</span>
          <FontAwesomeIcon className={classNames('dex-menu-chevron', { open })} icon={faChevronDown} />
        </button>
      </h1>
      <DexIndicator dex={activeDexView!} />
      {open &&
        <ul className="nav-menu-dropdown dex-menu-dropdown" role="menu">
          {onOpenTimeline && item(faTimeline, t('timeline.open'), 'T', onOpenTimeline)}
          {item(faBookOpen, t('almanac.open'), 'A', onOpenAlmanac)}
          {onOpenReview && item(faListCheck, t('review.open'), 'W', onOpenReview)}
          {LAYOUTS.map((option, n) => (
            <Fragment key={option.id}>
              {item(option.icon, t(option.labelKey), 'V', () => onLayout(option.id), { checked: layout === option.id, className: n === 0 ? 'dex-menu-group' : undefined })}
            </Fragment>
          ))}
          {item(faPencilAlt, t('filter.editDex'), null, onEditDex, { className: 'dex-menu-group' })}
        </ul>
      }
    </div>
  );
}
