import { isNativeApp } from '../lib/nativePlatform';
export function LoadingScreen({ label = "Getting your roadshow ready…" }: { label?: string }) {
  if (isNativeApp()) return <main className="center-page native-loading" role="status" aria-live="polite">
    <img src="/native-launch-truck.png" width="112" height="112" alt="" aria-hidden="true" />
    <h1>Roadshow Driver</h1>
    <div className="loader" aria-hidden="true" />
    <p>{label}</p>
  </main>;
  return <main className="center-page" role="status" aria-live="polite"><div className="loader" aria-hidden="true" /><p>{label}</p></main>;
}
