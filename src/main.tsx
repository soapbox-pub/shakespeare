import { createRoot } from 'react-dom/client';

// Import polyfills first
import './lib/polyfills.ts';

import App from './App.tsx';
import './index.css';

// Using Inter Variable font for modern, clean typography
import '@fontsource-variable/inter';

createRoot(document.getElementById("root")!).render(<App />);
