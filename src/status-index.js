import { getStatusPageRedirect } from './utils/systemStatus';
import React from 'react';
import ReactDOM from 'react-dom/client';
import StatusPage from './pages/public/StatusPage';
import './index.css';
import './pages/public/StatusPage.css';

// StatusPage standalone - no routing, no auth, just the status page
const root = ReactDOM.createRoot(document.getElementById('root'));
const statusRedirect = getStatusPageRedirect(window.location, true);
if (statusRedirect) {
  window.location.replace(statusRedirect);
} else {
root.render(
  <React.StrictMode>
    <StatusPage />
  </React.StrictMode>
);
}
