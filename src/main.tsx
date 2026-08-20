import { StrictMode } from 'react';import { createRoot } from 'react-dom/client';import App from './App';import { AuthProvider } from './context/AuthContext';import { release } from './lib/release';import './styles.css'
const savedTheme=localStorage.getItem('roadshow-theme')||'light';const initialDark=savedTheme==='dark'||(savedTheme==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=initialDark?'dark':'light';document.documentElement.dataset.accent=localStorage.getItem('roadshow-color-scheme')||'forest';
document.title=`Roadshow Driver · ${release.label} ${release.version}`;
createRoot(document.getElementById('root')!).render(<StrictMode><AuthProvider><App/></AuthProvider></StrictMode>)
