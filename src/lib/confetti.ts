const colors = ["#e46f3c", "#f4c95d", "#43a77b", "#4f8fc9", "#a774c7", "#f08aa5"];

export function launchConfetti(options: { x?: number; y?: number; pieces?: number; distance?: number } = {}) {
  if (typeof document === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const burst = document.createElement("div");
  burst.className = "confetti-burst";
  const originX = options.x ?? window.innerWidth / 2;
  const originY = options.y ?? window.innerHeight * 0.38;
  const pieces = options.pieces ?? 90;
  const distance = options.distance ?? 460;
  for (let index = 0; index < pieces; index += 1) {
    const piece = document.createElement("i");
    const angle = Math.random() * Math.PI * 2;
    const travel = distance * (0.35 + Math.random() * 0.65);
    piece.style.setProperty("--confetti-x", `${Math.cos(angle) * travel}px`);
    piece.style.setProperty("--confetti-y", `${Math.sin(angle) * travel + 180}px`);
    piece.style.setProperty("--confetti-rotation", `${Math.round(Math.random() * 1080 - 540)}deg`);
    piece.style.setProperty("--confetti-delay", `${Math.random() * 160}ms`);
    piece.style.left = `${originX}px`;
    piece.style.top = `${originY}px`;
    piece.style.background = colors[index % colors.length];
    piece.style.borderRadius = index % 3 === 0 ? "50%" : "2px";
    burst.appendChild(piece);
  }
  document.body.appendChild(burst);
  window.setTimeout(() => burst.remove(), 2200);
}
