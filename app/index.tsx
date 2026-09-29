import './styles/index.scss';

import { createRoot } from 'react-dom/client';

import { App } from './components/pages/App';
import { LocalStorageContextProvider } from './hooks/contexts/use-local-storage-context';
import { bootstrapTheme } from './palette/apply-theme';

bootstrapTheme();

// the page itself never zooms (electron/main.js pins it at 100%), and a change of pixel ratio may be one
function watchPixelRatio () {
  matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`).addEventListener('change', () => {
    window.tracker?.pinZoom();
    watchPixelRatio();
  }, { once: true });
}
watchPixelRatio();

createRoot(document.getElementById('root')!).render(
  <LocalStorageContextProvider>
    <App />
  </LocalStorageContextProvider>,
);
