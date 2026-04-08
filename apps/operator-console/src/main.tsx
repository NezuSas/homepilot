import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

// Monkey-patch global fetch to automatically append Authorization header
const originalFetch = window.fetch;
window.fetch = async (...args) => {
  const [resource, config] = args;
  
  // Convert resource to string for inspection
  const urlStr = typeof resource === 'string' 
    ? resource 
    : (resource instanceof URL ? resource.toString() : (resource as Request).url);
    
  const isLoginEndpoint = urlStr.endsWith('/api/v1/auth/login');
  
  let newConfig = config || {};
  
  // Only inject Authorization to non-login endpoints
  if (!isLoginEndpoint) {
    const token = localStorage.getItem('hp_session_token');
    if (token) {
      newConfig.headers = {
        ...newConfig.headers,
        'Authorization': `Bearer ${token}`
      };
    }
  }

  const response = await originalFetch(resource, newConfig);

  // Auto-logout mechanism for edge
  if (response.status === 401 && !isLoginEndpoint) {
    if (localStorage.getItem('hp_session_token')) {
      localStorage.removeItem('hp_session_token');
      localStorage.removeItem('hp_user_ctx');
      window.location.reload();
    }
  }

  return response;
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
