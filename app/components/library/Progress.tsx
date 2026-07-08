import { decimal } from '../../utils/formatting';

interface Props {
  caught: number;
  locked?: number;
  temporary?: number;
  total: number;
}

export function Progress ({ caught, locked = 0, temporary = 0, total }: Props) {
  const percent = 100 * caught / total;

  return (
    <div className="progress-container">
      <div className="progress-outer">
        <div className="progress-numbers"><b>{decimal(percent, 1)}%</b> done!<span className="mobile"> (<b>{caught}</b> caught, <b>{total - caught}</b> to go)</span></div>
        <div className="progress-inner" style={{ width: `${percent}%` }} />
      </div>
      <h3>(<b>{caught}</b> caught, <b>{total - caught}</b> to go{temporary > 0 && <>, <b className="temporary-count">{temporary}</b> temporary</>}{locked > 0 && <>, <b className="locked-count">{locked}</b> locked</>})</h3>
    </div>
  );
}
