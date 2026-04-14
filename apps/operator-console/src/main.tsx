import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './i18n'
import App from './App'

// Monkey-patch global fetch to automatically append Authorization header and handle auth failures
const originalFetch = window.fetch;
window.fetch = async (...args) => {
  const [resource, config] = args;
  
  // Convert resource to string for inspection
  const urlStr = typeof resource === 'string' 
    ? resource 
    : (resource instanceof URL ? resource.toString() : (resource as Request).url);
    
  // standard endpoints to ignore auth (login, health, etc if needed)
  const isAuthWhitelisted = urlStr.includes('/api/v1/auth/login') || urlStr.includes('/health');
  
  let newConfig = { ...config };
  newConfig.headers = { ...newConfig.headers };
  
  // Only inject Authorization to non-whitelisted endpoints
  if (!isAuthWhitelisted) {
    const token = localStorage.getItem('hp_session_token');
    if (token) {
      (newConfig.headers as any)['Authorization'] = `Bearer ${token}`;
    }
  }

  const response = await originalFetch(resource, newConfig);

  // Global 401 Interceptor: Auto-logout on session expiration
  if (response.status === 401 && !isAuthWhitelisted) {
    // Only clear and reload if we actually thought we had a token
    if (localStorage.getItem('hp_session_token')) {
      localStorage.removeItem('hp_session_token');
      localStorage.removeItem('hp_user_ctx');
      // Using window.location.href to force a full clean reload to the root
      window.location.href = '/'; 
    }
  }

  return response;
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
