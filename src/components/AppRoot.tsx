import { NativeLifecycle } from './NativeLifecycle';
import { NativeExternalLinks } from './NativeExternalLinks';
import App from '../App';
import { AuthProvider } from '../context/AuthContext';
export default function AppRoot() { return <AuthProvider><NativeLifecycle /><NativeExternalLinks /><App /></AuthProvider>; }
