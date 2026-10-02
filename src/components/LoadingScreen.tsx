export function LoadingScreen({ label = "Getting your roadshow ready…" }: { label?: string }) {
  return <main className="center-page" role="status" aria-live="polite"><div className="loader" aria-hidden="true" /><p>{label}</p></main>;
}
