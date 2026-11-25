import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { LOW_POWER } from './utils/lowPower.ts';

if (LOW_POWER) {
  document.documentElement.classList.add('low-power');
}

createRoot(document.getElementById('root')!).render(<App />);
