import './styles';

import { QueryClientProvider } from '@tanstack/react-query';
import { render } from 'react-dom';

import { App } from './components/pages/App';
import { LocalStorageContextProvider } from './hooks/contexts/use-local-storage-context';
import { queryClient } from './utils/query-client';

function run () {
  render(
    <QueryClientProvider client={queryClient}>
      <LocalStorageContextProvider>
        <App />
      </LocalStorageContextProvider>
    </QueryClientProvider>,
    document.getElementById('root')
  );
}

if (document.getElementById('root')) {
  run();
} else {
  window.addEventListener('DOMContentLoaded', run);
}
