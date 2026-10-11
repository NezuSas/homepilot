import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../index.css';
import '../i18n';
import { UiLabelsBridge } from '../components/UiLabelsBridge';
import { DesignBook } from './DesignBook';

declare global {
  interface Window { __bookReady?: boolean }
}

const params = new URLSearchParams(window.location.search);
document.documentElement.classList.toggle('light', params.get('theme') === 'light');

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(
    <StrictMode>
      <UiLabelsBridge>
        <DesignBook only={params.get('only')} />
      </UiLabelsBridge>
    </StrictMode>,
  );
  void document.fonts.ready.then(() => {
    requestAnimationFrame(() => { window.__bookReady = true; });
  });
}
