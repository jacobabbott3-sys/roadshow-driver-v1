import { release } from "../lib/release";

export function ReleaseBadge({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`release-badge release-${release.channel}${compact ? " compact" : ""}`}>
      {release.label} <strong>{release.version}</strong>
    </span>
  );
}
