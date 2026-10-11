import { isNativeApp } from '../lib/nativePlatform';
import { preloadNativeScreen } from '../native/preloadScreen';
import { NativeLifecycle } from './NativeLifecycle';
import { NativeExternalLinks } from './NativeExternalLinks';
import App from '../App';
import { AuthProvider } from '../context/AuthContext';
// This module loads only after NativeConfigurationGate permits startup.
if (isNativeApp()) void preloadNativeScreen(window.location.pathname);
export default function AppRoot() { return <AuthProvider><NativeLifecycle /><NativeExternalLinks /><App /></AuthProvider>; }
