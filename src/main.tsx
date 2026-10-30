import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { installWorkspaceHeader } from './utils/workspace';
import './index.css';
import './styles/design-system.css';
import './styles/public-menu.css';
import './styles/workspace.css';
import './styles/events.css';

installWorkspaceHeader();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Production only: in development Vite serves source files that a cached copy would hide.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => { void navigator.serviceWorker.register('/sw.js').catch(() => {}); });
}
