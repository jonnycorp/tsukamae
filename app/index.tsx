import './styles';

import { QueryClientProvider } from '@tanstack/react-query';
import { createRoot } from 'react-dom/client';

import { App } from './components/pages/App';
import { LocalStorageContextProvider } from './hooks/contexts/use-local-storage-context';
import { bootstrapTheme } from './palette/apply-theme';
import { queryClient } from './utils/query-client';

function run () {
  // before first paint: the stored theme + soft dark, so launch doesn't flash the defaults
  bootstrapTheme();

  const root = createRoot(document.getElementById('root') as HTMLElement);

  root.render(
    <QueryClientProvider client={queryClient}>
      <LocalStorageContextProvider>
        <App />
      </LocalStorageContextProvider>
    </QueryClientProvider>
  );
}

if (document.getElementById('root')) {
  run();
} else {
  window.addEventListener('DOMContentLoaded', run);
}
