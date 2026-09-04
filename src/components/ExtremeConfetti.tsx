import { useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { launchConfetti } from "../lib/confetti";

export function ExtremeConfetti() {
  const { profile } = useAuth();
  useEffect(() => {
    if (!profile?.extreme_confetti) return;
    const celebrate = (event: MouseEvent) => launchConfetti({ x: event.clientX, y: event.clientY, pieces: 54, distance: 330 });
    document.addEventListener("click", celebrate);
    return () => document.removeEventListener("click", celebrate);
  }, [profile?.extreme_confetti]);
  return null;
}
