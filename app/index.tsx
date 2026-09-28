import './styles/index.scss';

import { createRoot } from 'react-dom/client';

import { App } from './components/pages/App';
import { LocalStorageContextProvider } from './hooks/contexts/use-local-storage-context';
import { bootstrapTheme } from './palette/apply-theme';

bootstrapTheme();

createRoot(document.getElementById('root')!).render(
  <LocalStorageContextProvider>
    <App />
  </LocalStorageContextProvider>,
);
