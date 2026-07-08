import { DexIndicator } from './DexIndicator';
import { useDexContext } from '../../hooks/contexts/use-dex-context';

export function Header () {
  const { activeDex, activeDexView } = useDexContext();

  return (
    <div className="header-row">
      <h1>{activeDex!.title}</h1>
      <DexIndicator dex={activeDexView!} />
    </div>
  );
}
