import { createRoot } from 'react-dom/client';

// Import polyfills first
import './lib/polyfills.ts';

// Import i18n configuration
import './lib/i18n';

import App from './App.tsx';
import './index.css';

// Using Inter Variable font for modern, clean typography
import '@fontsource-variable/inter';

// Prism syntax highlighting
import 'prismjs/themes/prism.css';

createRoot(document.getElementById("root")!).render(<App />);
