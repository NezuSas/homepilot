import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './i18n';
import App from './App';
import { configureApiClient } from './lib/apiClient';

// ─── Synchronous Bootstrap ───────────────────────────────────────────
// Configure the API client BEFORE any component mounts. This prevents
// race conditions where the first authenticated requests (e.g. settings)
// are sent without a token because the React useEffect hadn't run yet.
configureApiClient({
  getToken: () => localStorage.getItem('hp_session_token'),
  onUnauthorized: () => {
    // Robust logout fallback for 401s occurring outside React context.
    // This clears local state and forces a fresh start.
    localStorage.removeItem('hp_session_token');
    localStorage.removeItem('hp_user_ctx');
    window.location.href = '/';
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
