import type { ReactNode } from 'react';
export function NativeConfigurationGate({ error, children }: { error: string | null; children: ReactNode }) {
  if (error) return <main className="recovery-screen"><section className="recovery-card" role="alert"><h1>App setup needs attention</h1><p>{error}</p></section></main>;
  return <>{children}</>;
}
