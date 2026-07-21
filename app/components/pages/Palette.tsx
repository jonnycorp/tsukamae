import { useEffect, useMemo, useState } from 'react';

import { Progress } from '../library/Progress';
import {
  PALETTE_BASES,
  PALETTE_DERIVED,
  PALETTE_PRESETS,
  PRESET_DOT_BASES,
  TOKEN_NAMES,
  colorsClose,
  contrastRatio,
  cssValue,
  hexToRgba,
  parseCssColor,
  resolvePalette,
  rgbaToHex,
} from '../../palette/tokens';

import { applyTheme } from '../../palette/apply-theme';
import { useLocalStorageContext } from '../../hooks/contexts/use-local-storage-context';
import { usePaletteBroadcastSender } from '../../palette/use-palette-broadcast';

import type { Rgba } from '../../palette/tokens';

// Dev-only palette workbench (?palette=1, not localized): live-overrides the :root tokens on top of the active theme; commit via the export block.

// Real text-on-surface pairs; `large` relaxes WCAG to 3:1.
const PAIRINGS: { label: string; fg: string; bg: string; large?: boolean }[] = [
  { label: 'Body text on page', fg: 'brand-secondary', bg: 'surface-light' },
  { label: 'Nav links on bar', fg: 'brand-secondary', bg: 'brand-primary' },
  { label: 'Nav links on hover', fg: 'brand-secondary', bg: 'brand-primary-l10' },
  { label: 'Headings on page', fg: 'brand-secondary', bg: '#ffffff', large: true },
  { label: 'Button text', fg: '#ffffff', bg: 'brand-secondary-light' },
  { label: 'Button text · delete', fg: '#ffffff', bg: 'release-danger' },
  { label: 'Button text · delete (soft dark)', fg: '#ffffff', bg: 'release-danger-soft' },
  { label: 'Popover body', fg: '#ffffff', bg: 'brand-secondary' },
  { label: 'Popover links', fg: '#ffffff', bg: 'brand-secondary-dark' },
  { label: 'Tile text · caught', fg: 'brand-secondary', bg: 'caught-light' },
  { label: 'Tile text · temporary', fg: 'brand-secondary', bg: 'temporary-light' },
  { label: 'Tile text · locked', fg: 'brand-secondary', bg: 'locked-light' },
];

function formatRatio (ratio: number): string {
  return `${(Math.round(ratio * 100) / 100).toFixed(2)}:1`;
}

export function Palette () {
  const { theme } = useLocalStorageContext();

  // Base-name → picked hex. Empty = untouched page showing the active theme.
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  // Tokens whose applied value disagrees with the JS mirror (files drifted).
  const [driftedTokens, setDriftedTokens] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  // The active theme is the working baseline; picks layer on top of it.
  const baseline = useMemo(() => ({ ...PALETTE_BASES, ...PALETTE_PRESETS[theme] }), [theme]);
  const resolved = useMemo(() => resolvePalette({ ...PALETTE_PRESETS[theme], ...overrides }), [theme, overrides]);
  const dirty = Object.keys(overrides).length > 0;
  const broadcast = usePaletteBroadcastSender();

  // Self-check: the applied :root values (build CSS or theme overrides) vs this page's JS mirror.
  useEffect(() => {
    const styles = getComputedStyle(document.documentElement);
    const expected = resolvePalette(PALETTE_PRESETS[theme]);
    const drifted = TOKEN_NAMES.filter((name) => {
      const built = parseCssColor(styles.getPropertyValue(`--${name}`));
      return !built || !colorsClose(built, expected[name]);
    });
    setDriftedTokens(drifted);
  }, [theme]);

  // Overrides rewrite every token on :root (+ broadcast); reset falls back to the active theme.
  useEffect(() => {
    const root = document.documentElement;
    if (dirty) {
      const values: Record<string, string> = {};
      for (const name of TOKEN_NAMES) {
        values[name] = cssValue(resolved[name]);
        root.style.setProperty(`--${name}`, values[name]);
      }
      broadcast(values);
    } else {
      applyTheme(theme);
      broadcast(null);
    }
    return () => applyTheme(theme);
  }, [resolved, dirty, theme]);

  const colorFor = (ref: string): Rgba => (ref.startsWith('#') ? hexToRgba(ref)! : resolved[ref]);

  const handleBaseChange = (name: string, hex: string) => {
    setOverrides((prev) => {
      const next = { ...prev, [name]: hex };
      if (hex.toLowerCase() === baseline[name]) {
        delete next[name];
      }
      return next;
    });
  };

  const exportText = useMemo(() => {
    const lines = Object.keys(PALETTE_BASES).map((name) => `  '${name}': ${rgbaToHex(resolved[name])},`);
    return `$palette-bases: (\n${lines.join('\n')}\n);`;
  }, [resolved]);

  const handleCopyClick = () => {
    navigator.clipboard.writeText(exportText).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="palette-page">
      <div className="palette-toolbar">
        <h1>Palette</h1>
        {driftedTokens.length > 0 &&
          <span className="palette-drift">
            variables.scss / tokens.ts drift: {driftedTokens.join(', ')}
          </span>
        }
        {driftedTokens.length === 0 && <span className="palette-ok">SCSS ↔ JS mirror in sync</span>}
        <button className="palette-reset" disabled={!dirty} onClick={() => setOverrides({})} type="button">
          Reset to theme
        </button>
      </div>

      <section>
        <h2>Presets <small>the shipped themes — load one, then tune with the pickers</small></h2>
        <div className="palette-presets">
          {Object.entries(PALETTE_PRESETS).map(([name, preset]) => (
            <button className="palette-preset" key={name} onClick={() => setOverrides({ ...preset })} type="button">
              <span className="palette-preset-dots">
                {PRESET_DOT_BASES.map((base) => (
                  <span className="palette-swatch" key={base} style={{ backgroundColor: preset[base] || PALETTE_BASES[base] }} />
                ))}
              </span>
              {name}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2>Bases <small>the only hand-picked colors — everything else derives</small></h2>
        <div className="palette-bases">
          {Object.keys(PALETTE_BASES).map((name) => (
            <label className="palette-base" key={name}>
              <span className="palette-swatch" style={{ backgroundColor: `var(--${name})` }} />
              <span className="palette-base-name">{name}</span>
              <input
                onChange={(e) => handleBaseChange(name, e.target.value)}
                type="color"
                value={rgbaToHex(resolved[name])}
              />
              <code>{rgbaToHex(resolved[name])}</code>
            </label>
          ))}
        </div>
      </section>

      <section>
        <h2>Derived <small>recomputed live from the bases</small></h2>
        <div className="palette-derived">
          {PALETTE_DERIVED.map(([name, spec]) => (
            <span className="palette-chip" key={name} title={`${name} = ${spec.fn}(${spec.source}, ${spec.amount}${spec.fn === 'alpha' ? '' : '%'})`}>
              <span className="palette-swatch" style={{ backgroundColor: `var(--${name})` }} />
              <span>{name}</span>
            </span>
          ))}
        </div>
      </section>

      <section>
        <h2>Pairings <small>WCAG advisory — {'≥'}4.5:1 text, {'≥'}3:1 large/UI</small></h2>
        <div className="palette-pairings">
          {PAIRINGS.map((pair) => {
            const ratio = contrastRatio(colorFor(pair.fg), colorFor(pair.bg));
            const target = pair.large ? 3 : 4.5;
            return (
              <div className="palette-pair" key={pair.label}>
                <span
                  className="palette-pair-sample"
                  style={{
                    backgroundColor: pair.bg.startsWith('#') ? pair.bg : `var(--${pair.bg})`,
                    color: pair.fg.startsWith('#') ? pair.fg : `var(--${pair.fg})`,
                  }}
                >
                  Aa 012
                </span>
                <span className="palette-pair-label">{pair.label}</span>
                <span className={`palette-pair-ratio ${ratio >= target ? 'pass' : 'fail'}`}>
                  {formatRatio(ratio)} {ratio >= target ? '✓' : `✗ (needs ${target}:1)`}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2>Live samples <small>real app classes — toggle soft dark in the nav</small></h2>
        <div className="palette-samples">
          <div className="palette-sample-tiles">
            <div className="pokemon">
              <div className="set-captured"><h4>Missing</h4><p>#0001</p></div>
            </div>
            <div className="pokemon captured">
              <div className="missing-meta-badge">!</div>
              <div className="set-captured"><h4>Caught</h4><p>#0002</p></div>
            </div>
            <div className="pokemon captured temporary">
              <div className="set-captured"><h4>Temporary</h4><p>#0003</p></div>
            </div>
            <div className="pokemon captured locked">
              <div className="set-captured"><h4>Locked</h4><p>#0004</p></div>
            </div>
            <div className="pokemon pending">
              <div className="set-captured"><h4>Pending</h4><p>#0005</p></div>
            </div>
          </div>

          <div className="palette-sample-progress">
            <Progress caught={412} locked={187} temporary={64} total={1025} />
          </div>

          <div className="palette-sample-buttons">
            <button className="btn btn-blue" type="button">Mark All</button>
            <button className="btn btn-delete" type="button">Delete Dex</button>
          </div>

          <div className="pokemon-popover palette-static">
            <div className="popover-header">
              <h1>Snorlax</h1>
              <h2>#0143</h2>
            </div>
            <div className="popover-body">
              <div className="form-group">
                <label>Origin Game</label>
                <select className="form-control"><option>Violet</option></select>
              </div>
            </div>
            <div className="popover-links">
              <a>Bulbapedia</a>
              <a>Serebii</a>
            </div>
            <div className="popover-footer">
              <button className="popover-release" type="button">Release</button>
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2>Export <small>paste into styles/variables.scss (and mirror any changes in palette/tokens.ts)</small></h2>
        <pre className="palette-export">{exportText}</pre>
        <button className="palette-copy" onClick={handleCopyClick} type="button">{copied ? 'Copied ✓' : 'Copy'}</button>
      </section>
    </div>
  );
}
