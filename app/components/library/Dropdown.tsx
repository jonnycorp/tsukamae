import classNames from 'classnames';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faChevronDown } from '@fortawesome/free-solid-svg-icons';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

export interface DropdownOption {
  value: string;
  label: string;
  icon?: string;
}

interface Props {
  id: string;
  value: string;
  options: DropdownOption[];
  onSelect: (value: string) => void;
  // prepended as the '' option when set
  blankLabel?: string;
  // replaces the default form-control trigger styling
  triggerClassName?: string;
  disabled?: boolean;
}

const MENU_MAX_HEIGHT = 240;

// custom select, congruent with the nav dropdowns; the menu is position: fixed
// so no overflow ancestor (modal, popover body) can clip it
export function Dropdown ({ id, value, options, onSelect, blankLabel, triggerClassName, disabled = false }: Props) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<{ top?: number; bottom?: number; left: number; width: number }>({ left: 0, width: 0 });

  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);

  const all = blankLabel !== undefined ? [{ value: '', label: blankLabel }, ...options] : options;
  const selected = all.find((option) => option.value === value);

  useLayoutEffect(() => {
    if (!open) {
      return;
    }
    const trigger = rootRef.current;
    if (!trigger) {
      return;
    }
    const rect = trigger.getBoundingClientRect();
    const fitsBelow = rect.bottom + MENU_MAX_HEIGHT <= window.innerHeight - 8;
    setMenuStyle(fitsBelow
      ? { top: rect.bottom, left: rect.left, width: rect.width }
      : { bottom: window.innerHeight - rect.top, left: rect.left, width: rect.width });
    // start at the selected option
    requestAnimationFrame(() => {
      menuRef.current?.querySelector('.dropdown-selected')?.scrollIntoView({ block: 'nearest' });
    });
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const close = () => setOpen(false);
    const handleMousedown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node) &&
          menuRef.current && !menuRef.current.contains(e.target as Node)) {
        close();
      }
    };
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
      }
    };
    const handleScroll = (e: Event) => {
      // the menu scrolls itself; anything else moving the page closes it
      if (e.target instanceof Node && menuRef.current?.contains(e.target)) {
        return;
      }
      close();
    };

    document.addEventListener('mousedown', handleMousedown);
    document.addEventListener('keydown', handleKeydown);
    document.addEventListener('scroll', handleScroll, { capture: true, passive: true });
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', handleMousedown);
      document.removeEventListener('keydown', handleKeydown);
      document.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  const handlePick = (next: string) => {
    setOpen(false);
    onSelect(next);
  };

  return (
    <div className="dropdown" ref={rootRef}>
      <button
        className={classNames('dropdown-trigger', triggerClassName ?? 'form-control')}
        disabled={disabled}
        id={id}
        onClick={() => setOpen((prev) => !prev)}
        type="button"
      >
        <span className="dropdown-value">
          {selected?.icon && <img alt="" src={`/${selected.icon}`} />}
          {selected?.label ?? blankLabel ?? ''}
        </span>
        <FontAwesomeIcon className="dropdown-chevron" icon={faChevronDown} />
      </button>
      {open &&
        <ul className="dropdown-menu" ref={menuRef} style={menuStyle}>
          {all.map((option) => (
            <li
              className={classNames({ 'dropdown-selected': option.value === value })}
              key={option.value || '(blank)'}
              onClick={() => handlePick(option.value)}
            >
              {option.icon && <img alt="" src={`/${option.icon}`} />}
              <span>{option.label}</span>
              {option.value === value && <FontAwesomeIcon className="dropdown-check" icon={faCheck} />}
            </li>
          ))}
        </ul>
      }
    </div>
  );
}
