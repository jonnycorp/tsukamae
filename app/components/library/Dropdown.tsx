import classNames from 'classnames';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faChevronDown } from '@fortawesome/free-solid-svg-icons';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import type { KeyboardEvent as ReactKeyboardEvent } from 'react';

interface DropdownOption {
  value: string;
  label: string;
  icon?: string;
}

interface Props {
  id: string;
  value: string;
  options: DropdownOption[];
  onSelect: (value: string) => void;
  blankLabel?: string;
  triggerClassName?: string;
}

const MENU_MAX_HEIGHT = 240;

// the menu is position: fixed so no overflow ancestor (modal, popover body) can clip it
export function Dropdown ({ id, value, options, onSelect, blankLabel, triggerClassName }: Props) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<{ top?: number; bottom?: number; left: number; width: number }>({ left: 0, width: 0 });

  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);

  const all = blankLabel !== undefined ? [{ value: '', label: blankLabel }, ...options] : options;
  const selected = all.find((option) => option.value === value);
  // the option the keyboard is on while the menu's open; focus stays on the trigger
  const [active, setActive] = useState(-1);

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
    setActive(Math.max(0, all.findIndex((option) => option.value === value)));
    requestAnimationFrame(() => {
      menuRef.current?.querySelector('.dropdown-selected')?.scrollIntoView({ block: 'nearest' });
    });
  }, [open]);

  useEffect(() => {
    if (open && active >= 0) {
      menuRef.current?.children[active]?.scrollIntoView({ block: 'nearest' });
    }
  }, [open, active]);

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
    // first, in the capture phase, and claimed: the modal or popover around the dropdown listens for Escape too
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    };
    const handleScroll = (e: Event) => {
      if (e.target instanceof Node && menuRef.current?.contains(e.target)) {
        return;
      }
      close();
    };

    document.addEventListener('mousedown', handleMousedown);
    document.addEventListener('keydown', handleKeydown, true);
    document.addEventListener('scroll', handleScroll, { capture: true, passive: true });
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', handleMousedown);
      document.removeEventListener('keydown', handleKeydown, true);
      document.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  const handlePick = (next: string) => {
    setOpen(false);
    onSelect(next);
  };

  // what the native selects did: arrows, Home/End and a first letter move, Enter or Space picks, Tab moves on
  const handleKeyDown = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((index) => (index + (e.key === 'ArrowDown' ? 1 : -1) + all.length) % all.length);
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      setActive(e.key === 'Home' ? 0 : all.length - 1);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (all[active]) {
        handlePick(all[active].value);
      }
    } else if (e.key === 'Tab') {
      setOpen(false);
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // claimed like every key the open menu takes, so a letter meant for it never reaches the page's hotkeys
      e.preventDefault();
      const letter = e.key.toLocaleLowerCase();
      for (let step = 1; step <= all.length; step++) {
        const index = (active + step) % all.length;
        if (all[index].label.toLocaleLowerCase().startsWith(letter)) {
          setActive(index);
          break;
        }
      }
    }
  };

  return (
    <div className="dropdown" ref={rootRef}>
      <button
        aria-expanded={open}
        aria-haspopup="listbox"
        className={classNames('dropdown-trigger', triggerClassName ?? 'form-control')}
        id={id}
        onClick={() => setOpen((prev) => !prev)}
        onKeyDown={handleKeyDown}
        type="button"
      >
        <span className="dropdown-value">
          {selected?.icon && <img alt="" src={`/${selected.icon}`} />}
          {selected?.label ?? blankLabel ?? ''}
        </span>
        <FontAwesomeIcon className="dropdown-chevron" icon={faChevronDown} />
      </button>
      {open &&
        <ul className="dropdown-menu" ref={menuRef} role="listbox" style={menuStyle}>
          {all.map((option, index) => (
            <li
              aria-selected={option.value === value}
              className={classNames({ 'dropdown-selected': option.value === value, 'dropdown-active': index === active })}
              key={option.value || '(blank)'}
              onClick={() => handlePick(option.value)}
              role="option"
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
