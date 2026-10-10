import { isNativeApp } from "../lib/nativePlatform";
import { shellPlugin } from "../native/shellPlugin";
import { Bell, MessageCircle, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useShellPresentation } from "../native/useShellPresentation";

export function TopBar() {
  const { profile, updateAppearance } = useAuth();
  const { chats: unreadChats, notifications: unreadNotifications } = useShellPresentation();
  const [dark, setDark] = useState(() => document.documentElement.dataset.theme === "dark");
  useEffect(() => { setDark(document.documentElement.dataset.theme === "dark"); }, [profile?.theme_preference]);

  async function toggleTheme() {
    if (isNativeApp()) { await shellPlugin.showAppearance().catch(() => {}); return; }
    const next = dark ? "light" : "dark";
    setDark(!dark);
    await updateAppearance(next, profile?.color_scheme || "forest", Boolean(profile?.extreme_confetti));
  }

  return (
    <header className="top-bar">
      <button aria-label={isNativeApp() ? "iPhone appearance" : "Toggle dark mode"} onClick={() => void toggleTheme()}>{dark ? <Sun /> : <Moon />}</button>
      <Link to="/notifications" aria-label={`${unreadNotifications} unread notifications`}><Bell />{unreadNotifications > 0 && <span>{unreadNotifications > 9 ? "9+" : unreadNotifications}</span>}</Link>
      <Link to="/chat" aria-label={`${unreadChats} unread chats`}><MessageCircle />{unreadChats > 0 && <span>{unreadChats > 9 ? "9+" : unreadChats}</span>}</Link>
    </header>
  );
}
