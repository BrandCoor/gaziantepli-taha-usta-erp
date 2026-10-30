import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { installCloudAuth } from './services/cloudAuth';

installCloudAuth();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);