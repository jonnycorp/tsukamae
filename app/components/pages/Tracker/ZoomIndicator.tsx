import classNames from 'classnames';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons';
import { useEffect, useState } from 'react';

const SHOWN_MS = 1000;

interface Props {
  zoom: number;
  // bumps on every zoom input, so hitting a limit still shows it
  nudges: number;
}

export function ZoomIndicator ({ zoom, nudges }: Props) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (nudges === 0) {
      return;
    }
    setShown(true);
    const timer = window.setTimeout(() => setShown(false), SHOWN_MS);
    return () => window.clearTimeout(timer);
  }, [nudges]);

  return (
    <div className={classNames('zoom-indicator', { shown })}>
      <FontAwesomeIcon icon={faMagnifyingGlass} />{Math.round(zoom * 100)}%
    </div>
  );
}
