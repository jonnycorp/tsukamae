import { DEX } from '../../utils/local-data';
import { DexIndicator } from './DexIndicator';

export function Header () {
  return (
    <div className="header-row">
      <h1>{DEX.title}</h1>
      <DexIndicator dex={DEX} />
    </div>
  );
}
