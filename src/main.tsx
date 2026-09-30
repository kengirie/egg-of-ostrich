import { createRoot } from 'react-dom/client';

// Import polyfills first
import './lib/polyfills.ts';

// Latin-only display face: a couple of woff2 blobs, cheap to mirror into every nest site.
import '@fontsource/bagel-fat-one/latin-400.css';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
