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
  // the menu's edge that lines up with the trigger's, where it's wider: start, or end for a trigger set to the right
  align?: 'start' | 'end';
}

const MENU_MAX_HEIGHT = 240;
const EDGE = 8;
// between the menu and its field
const GAP = 4;

// a label's click passes on to its control, which for a dropdown's trigger opened the menu from the field's name; the
// name only names the field and focuses it, as a native select's label does, and the trigger alone opens it. One
// listener for every dropdown, set up by the first
let labelsGuarded = false;
function guardLabels () {
  if (labelsGuarded) {
    return;
  }
  labelsGuarded = true;
  document.addEventListener('click', (e) => {
    const label = e.target instanceof Element ? e.target.closest('label') : null;
    const control = label?.control;
    if (control?.classList.contains('dropdown-trigger')) {
      e.preventDefault();
      control.focus({ preventScroll: true });
    }
  }, true);
}

// the menu is position: fixed so no overflow ancestor (modal, popover body) can clip it
export function Dropdown ({ id, value, options, onSelect, blankLabel, triggerClassName, align = 'start' }: Props) {
  const [open, setOpen] = useState(false);
  const [up, setUp] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);

  const all = blankLabel !== undefined ? [{ value: '', label: blankLabel }, ...options] : options;
  const selected = all.find((option) => option.value === value);
  // the option the keyboard is on while the menu's open; focus stays on the trigger
  const [active, setActive] = useState(-1);
  // set as a key moves it, so only then is the menu scrolled to keep it in sight (the pointer's is where it points)
  const keyedRef = useRef(false);

  useEffect(guardLabels, []);

  // under the trigger, or over it where there's no room below; as wide as its widest option, so none is cut off, and
  // never narrower than the trigger, kept inside the window. Placed by where it lands: what holds a fixed element isn't
  // always the window (an ancestor with a transform is: the batch bar, the review's stage), nor are its pixels always
  // the screen's (a zoomed ancestor scales them: the dex, a scene), so it's measured at 0, 0, unfurl held, and moved
  useLayoutEffect(() => {
    if (!open) {
      return;
    }
    // the button, which can reach past the wrapper (the sealed record's location is shaded into its row's padding)
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!trigger || !menu) {
      return;
    }
    const rect = trigger.getBoundingClientRect();
    const zoom = menu.currentCSSZoom;
    menu.style.animation = 'none';
    menu.style.minWidth = `${rect.width / zoom}px`;
    menu.style.left = '0px';
    menu.style.top = '0px';
    const origin = menu.getBoundingClientRect();
    const left = Math.max(EDGE, Math.min(align === 'end' ? rect.right - origin.width : rect.left, window.innerWidth - origin.width - EDGE));
    menu.style.left = `${(left - origin.left) / zoom}px`;
    const below = rect.bottom + MENU_MAX_HEIGHT * zoom <= window.innerHeight - EDGE;
    // the way it unfurls, on the menu itself before the unfurl starts, so it never starts one way and turns
    menu.toggleAttribute('data-up', !below);
    if (below) {
      menu.style.top = `${(rect.bottom + GAP * zoom - origin.top) / zoom}px`;
    } else {
      menu.style.top = '';
      menu.style.bottom = '0px';
      menu.style.bottom = `${(menu.getBoundingClientRect().bottom - rect.top + GAP * zoom) / zoom}px`;
    }
    // opened on what's chosen, near the menu's top: the option before it in view, the ones after it below (a long list,
    // My Game's or the balls', would otherwise leave it on the menu's edge). Set before the first paint, so the menu
    // opens already there rather than moving to it, and on the menu alone, as a scrollIntoView could scroll the page
    // under it too, which closes it
    const chosen = menu.querySelector<HTMLElement>('.dropdown-selected');
    if (chosen) {
      menu.scrollTop = ((chosen.previousElementSibling as HTMLElement | null) ?? chosen).offsetTop;
    }
    menu.style.animation = '';
    setUp(!below);
    setActive(Math.max(0, all.findIndex((option) => option.value === value)));
  }, [open]);

  // the option a key moved to kept in sight, by scrolling the menu alone; one the pointer's on is in sight already
  useEffect(() => {
    const menu = menuRef.current;
    const item = menu?.children[active] as HTMLElement | undefined;
    if (!open || !keyedRef.current || !menu || !item) {
      return;
    }
    keyedRef.current = false;
    if (item.offsetTop < menu.scrollTop) {
      menu.scrollTop = item.offsetTop;
    } else if (item.offsetTop + item.offsetHeight > menu.scrollTop + menu.clientHeight) {
      menu.scrollTop = item.offsetTop + item.offsetHeight - menu.clientHeight;
    }
  }, [open, active]);

  // a closed menu's keyboard place is forgotten, so the next opening starts from the chosen option, not the last one
  // the keyboard was on (which would scroll the menu back off it)
  useEffect(() => {
    if (!open) {
      setActive(-1);
    }
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
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      // not a pick: the menu closes, and the page's own Ctrl+Enter (the review's seal) goes ahead
      setOpen(false);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      keyedRef.current = true;
      setActive((index) => (index + (e.key === 'ArrowDown' ? 1 : -1) + all.length) % all.length);
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      keyedRef.current = true;
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
          keyedRef.current = true;
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
        ref={triggerRef}
        type="button"
      >
        <span className="dropdown-value">
          {selected?.icon && <img alt="" src={`/${selected.icon}`} />}
          {selected?.label ?? blankLabel ?? ''}
        </span>
        <FontAwesomeIcon className="dropdown-chevron" icon={faChevronDown} />
      </button>
      {open &&
        <ul className="dropdown-menu" data-up={up || undefined} ref={menuRef} role="listbox">
          {all.map((option, index) => (
            <li
              aria-selected={option.value === value}
              className={classNames({ 'dropdown-selected': option.value === value, 'dropdown-active': index === active })}
              key={option.value || '(blank)'}
              onClick={() => handlePick(option.value)}
              // the keyboard carries on from where the pointer is, which is in sight already (a key's move that changed
              // nothing could have left the menu set to scroll to it)
              onMouseEnter={() => {
                keyedRef.current = false;
                setActive(index);
              }}
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
