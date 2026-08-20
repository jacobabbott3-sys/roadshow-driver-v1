import { Bell, MessageCircle, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useAsync } from "../hooks/useAsync";
import { getChatThreads, getNotifications, isThreadUnread } from "../lib/communications";
import { supabase } from "../lib/supabase";
import { ReleaseBadge } from "./ReleaseBadge";

export function TopBar() {
  const { user, profile, updateAppearance } = useAuth();
  const location = useLocation();
  const chats = useAsync(getChatThreads, [user?.id, location.pathname]);
  const notifications = useAsync(() => getNotifications(user!.id), [user?.id, location.pathname]);
  const refreshChats = chats.refresh;
  const refreshNotifications = notifications.refresh;
  const [dark, setDark] = useState(() => document.documentElement.dataset.theme === "dark");

  useEffect(() => {
    setDark(document.documentElement.dataset.theme === "dark");
  }, [profile?.theme_preference]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void refreshChats();
      void refreshNotifications();
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [refreshChats, refreshNotifications]);

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`top-bar-${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, () => void refreshChats())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `recipient_id=eq.${user.id}` }, () => void refreshNotifications())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user?.id, refreshChats, refreshNotifications]);

  useEffect(() => {
    function refreshBadges() {
      void refreshChats();
      void refreshNotifications();
    }
    window.addEventListener("roadshow:chat-changed", refreshBadges);
    window.addEventListener("roadshow:notifications-changed", refreshBadges);
    return () => {
      window.removeEventListener("roadshow:chat-changed", refreshBadges);
      window.removeEventListener("roadshow:notifications-changed", refreshBadges);
    };
  }, [refreshChats, refreshNotifications]);

  const unreadChats = chats.data?.filter((thread) => isThreadUnread(thread, user!.id)).length || 0;
  const unreadNotifications = notifications.data?.filter((item) => !item.read_at).length || 0;

  async function toggleTheme() {
    const next = dark ? "light" : "dark";
    setDark(!dark);
    await updateAppearance(next, profile?.color_scheme || "forest");
  }

  return (
    <header className="top-bar">
      <span className="top-release"><ReleaseBadge compact /></span>
      <button aria-label="Toggle dark mode" onClick={() => void toggleTheme()}>{dark ? <Sun /> : <Moon />}</button>
      <Link to="/notifications" aria-label={`${unreadNotifications} unread notifications`}><Bell />{unreadNotifications > 0 && <span>{unreadNotifications > 9 ? "9+" : unreadNotifications}</span>}</Link>
      <Link to="/chat" aria-label={`${unreadChats} unread chats`}><MessageCircle />{unreadChats > 0 && <span>{unreadChats > 9 ? "9+" : unreadChats}</span>}</Link>
    </header>
  );
}
