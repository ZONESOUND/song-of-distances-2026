import React from 'react';
import {createRoot} from 'react-dom/client';
import './index.css';
import App from './App';

// React 18 replaced ReactDOM.render with createRoot. StrictMode is left off
// deliberately: it double-invokes effects, which would start the audio graph
// and the p5 sketch twice in development and make listening tests unreliable.
createRoot(document.getElementById('root')).render(<App />);
